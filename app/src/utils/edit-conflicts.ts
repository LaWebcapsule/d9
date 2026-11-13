import { useFieldsStore } from '@/stores/fields';
import { useRelationsStore } from '@/stores/relations';
import { hashValue } from '@wbce-d9/utils';
import { cloneDeep, isPlainObject } from 'lodash';

export const BASE_KEY = '$base';
export const DELETE_BASE_KEY = '$deleteBase';

/**
 * Conflict as reported by the API in a 409 CONFLICT response
 */
export type EditConflict = {
	collection: string;
	key: string | number;
	action: 'update' | 'delete';
	type: 'changed' | 'deleted';
	field?: string;
	current?: unknown;
	user?: string | null;
	timestamp?: string | null;
};

/**
 * `mine` keeps the local change (update / delete / restore the row), `theirs` accepts the current state
 */
export type ConflictChoice = 'mine' | 'theirs';

/**
 * Hashes of the original values of the given fields, the API compares them with the current values
 * before saving
 */
export function getBaseHashes(
	collection: string,
	original: Record<string, any>,
	fields: string[]
): Record<string, string> {
	const fieldsStore = useFieldsStore();
	const primaryKeyField = fieldsStore.getPrimaryKeyFieldForCollection(collection)?.field;

	const base: Record<string, string> = {};

	for (const field of fields) {
		if (field.startsWith('$') || field === primaryKeyField || !(field in original)) continue;

		const fieldInfo = fieldsStore.getField(collection, field);
		if (!fieldInfo || fieldInfo.type === 'alias') continue;

		base[field] = hashValue(getStoredValue(collection, field, original[field]));
	}

	return base;
}

/**
 * Many-to-one values can be loaded as nested objects, the API compares the stored foreign key
 */
function getStoredValue(collection: string, field: string, value: unknown) {
	if (!isPlainObject(value)) return value;

	const relation = useRelationsStore().getRelationForField(collection, field);

	if (relation?.collection !== collection || relation.field !== field || !relation.related_collection) return value;

	const relatedPrimaryKeyField = useFieldsStore().getPrimaryKeyFieldForCollection(relation.related_collection)?.field;

	return relatedPrimaryKeyField ? (value as Record<string, any>)[relatedPrimaryKeyField] : value;
}

/**
 * Remove all base hashes, eg. when the edits are saved as a new item
 */
export function stripBases<T>(value: T): T {
	if (Array.isArray(value)) return value.map(stripBases) as T;
	if (!isPlainObject(value)) return value;

	const result: Record<string, any> = {};

	for (const [key, child] of Object.entries(value as Record<string, any>)) {
		if (key !== BASE_KEY && key !== DELETE_BASE_KEY) result[key] = stripBases(child);
	}

	return result as T;
}

type Visitor = {
	item?: (collection: string, item: Record<string, any>) => void;
	alterations?: (collection: string, alterations: Record<string, any>) => void;
};

/**
 * Call the visitor for every (nested) item and o2m alterations object in an edits payload
 */
export function walkEdits(collection: string, item: Record<string, any>, visitor: Visitor) {
	const relationsStore = useRelationsStore();

	visitor.item?.(collection, item);

	for (const [field, value] of Object.entries(item)) {
		if (field.startsWith('$') || !value || typeof value !== 'object') continue;

		for (const relation of relationsStore.getRelationsForField(collection, field)) {
			if (relation.related_collection === collection && relation.meta?.one_field === field) {
				const children = Array.isArray(value) ? value : [...(value.create ?? []), ...(value.update ?? [])];

				if (!Array.isArray(value)) visitor.alterations?.(relation.collection, value);

				for (const child of children) {
					if (isPlainObject(child)) walkEdits(relation.collection, child, visitor);
				}
			} else if (relation.collection === collection && relation.field === field && isPlainObject(value)) {
				const relatedCollection =
					relation.related_collection ??
					(relation.meta?.one_collection_field ? item[relation.meta.one_collection_field] : null);

				if (relatedCollection) walkEdits(relatedCollection, value, visitor);
			}
		}
	}
}

/**
 * Apply the choices for the reported conflicts to the edits, so they can be saved again. Returns the
 * changed edits and the base hashes to use for the root item.
 */
export function resolveEditConflicts(options: {
	collection: string;
	primaryKey: string | number;
	edits: Record<string, any>;
	rootBase: Record<string, string | null>;
	conflicts: EditConflict[];
	choices: ConflictChoice[];
}): { edits: Record<string, any>; rootBase: Record<string, string | null> } {
	const { collection, primaryKey, conflicts, choices } = options;
	const fieldsStore = useFieldsStore();

	const edits = cloneDeep(options.edits);
	const rootBase = { ...options.rootBase };

	const isSameKey = (a: unknown, b: unknown) => String(a) === String(b);

	conflicts.forEach((conflict, index) => {
		const choice = choices[index] ?? 'mine';
		const primaryKeyField = fieldsStore.getPrimaryKeyFieldForCollection(conflict.collection)?.field;
		const hasCurrent = 'current' in conflict;

		if (conflict.collection === collection && isSameKey(conflict.key, primaryKey)) {
			if (conflict.type !== 'changed' || !conflict.field) return;

			applyFieldChoice(edits, rootBase, conflict.field, choice, conflict.current, hasCurrent);
			return;
		}

		walkEdits(collection, edits, {
			alterations(childCollection, alterations) {
				if (childCollection !== conflict.collection) return;

				if (conflict.action === 'delete') {
					if (!(alterations.delete ?? []).some((key: unknown) => isSameKey(key, conflict.key))) return;

					if (choice === 'theirs') {
						alterations.delete = alterations.delete.filter((key: unknown) => !isSameKey(key, conflict.key));
					}

					// Deleting anyway doesn't need a check anymore
					if (alterations[DELETE_BASE_KEY]) delete alterations[DELETE_BASE_KEY][String(conflict.key)];

					return;
				}

				if (conflict.type !== 'deleted' || !primaryKeyField) return;

				const index = (alterations.update ?? []).findIndex((item: Record<string, any>) =>
					isSameKey(item[primaryKeyField], conflict.key)
				);

				if (index === -1) return;

				const [removed] = alterations.update.splice(index, 1);

				// Restore the deleted item with the local changes
				if (choice === 'mine') {
					const { [primaryKeyField]: _key, [BASE_KEY]: _base, ...values } = removed;
					alterations.create = [...(alterations.create ?? []), values];
				}
			},
			item(itemCollection, item) {
				if (conflict.action !== 'update' || conflict.type !== 'changed' || !conflict.field) return;
				if (itemCollection !== conflict.collection || !primaryKeyField) return;
				if (!isSameKey(item[primaryKeyField], conflict.key) || !(BASE_KEY in item)) return;

				applyFieldChoice(item, item[BASE_KEY], conflict.field, choice, conflict.current, hasCurrent);
			},
		});
	});

	return { edits, rootBase };
}

function applyFieldChoice(
	item: Record<string, any>,
	base: Record<string, string | null>,
	field: string,
	choice: ConflictChoice,
	current: unknown,
	hasCurrent: boolean
) {
	if (choice === 'theirs') {
		if (hasCurrent) {
			// Show the current value in the form; saving it again doesn't change anything
			item[field] = current;
			base[field] = hashValue(current);
		} else {
			delete item[field];
			base[field] = null;
		}
	} else if (hasCurrent) {
		base[field] = hashValue(current);
	} else {
		// The current value can't be read, keeping the local change means overwriting it
		base[field] = null;
	}
}
