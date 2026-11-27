import { useFieldsStore } from '@/stores/fields';
import { usePermissionsStore } from '@/stores/permissions';
import { useRelationsStore } from '@/stores/relations';
import { useUserStore } from '@/stores/user';
import { sha256Digest } from '@wbce-d9/utils';
import { cloneDeep, isPlainObject, pick } from 'lodash';

/**
 * Reserved key for information about a change that is not part of the item itself: items contain `onlyIf`,
 * o2m alterations `deleteOnlyIf`
 */
export const META_KEY = '$__meta';

/**
 * Conditions the current values have to meet for a change to be saved, by field. The API only saves when
 * the SHA-256 digest of the current value is the same.
 */
export type OnlyIf = Record<string, { _sha256: string }>;

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
};

/**
 * `mine` keeps the local change (update / delete / restore the row), `theirs` accepts the current state
 */
export type ConflictChoice = 'mine' | 'theirs';

/**
 * Conditions with the digests of the original values of the given fields, the API compares them with the
 * current values before saving
 */
export function getOnlyIf(collection: string, original: Record<string, any>, fields: string[]): OnlyIf {
	// Nothing to base conditions on, don't touch the stores
	if (!fields.some((field) => field in original)) return {};

	const fieldsStore = useFieldsStore();
	const primaryKeyField = fieldsStore.getPrimaryKeyFieldForCollection(collection)?.field;

	const onlyIf: OnlyIf = {};

	for (const field of fields) {
		if (field.startsWith('$') || field === primaryKeyField || !(field in original)) continue;

		const fieldInfo = fieldsStore.getField(collection, field);
		if (!fieldInfo || fieldInfo.type === 'alias') continue;

		// A related item the user isn't allowed to read is loaded as `null`, like an empty relation. Its hash
		// would never match the stored foreign key.
		if (original[field] === null && !canReadAllRelatedItems(collection, field, original)) continue;

		onlyIf[field] = { _sha256: sha256Digest(getStoredValue(collection, field, original[field])) };
	}

	return onlyIf;
}

/**
 * Add the conditions for the edited fields of an item, with the digests of the values the edits are based on.
 * Conditions that already exist are kept: they belong to the values the user saw when starting to edit.
 */
export function withOnlyIf(collection: string, original: Record<string, any>, edits: Record<string, any>) {
	const { [META_KEY]: meta, ...values } = edits;
	const fields = Object.keys(values).filter((field) => !field.startsWith('$'));

	const onlyIf: OnlyIf = pick({ ...getOnlyIf(collection, original, fields), ...(meta?.onlyIf ?? {}) }, fields);

	return Object.keys(onlyIf).length > 0 ? { ...values, [META_KEY]: { onlyIf } } : values;
}

function canReadAllRelatedItems(collection: string, field: string, item: Record<string, any>) {
	const relation = useRelationsStore().getRelationForField(collection, field);

	if (relation?.collection !== collection || relation.field !== field) return true;

	const relatedCollection =
		relation.related_collection ??
		(relation.meta?.one_collection_field ? item[relation.meta.one_collection_field] : null);

	if (!relatedCollection) return true;

	return canReadAllItems(relatedCollection);
}

/**
 * Whether the user can read every item of a collection, so nothing is hidden from them
 */
export function canReadAllItems(collection: string) {
	if (useUserStore().isAdmin) return true;

	const permission = usePermissionsStore().getPermissionsForUser(collection, 'read');

	return !!permission && Object.keys(permission.permissions ?? {}).length === 0;
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
 * Remove all conditions, eg. when the edits are saved as a new item
 */
export function stripMeta<T>(value: T): T {
	if (Array.isArray(value)) return value.map(stripMeta) as T;
	if (!isPlainObject(value)) return value;

	const result: Record<string, any> = {};

	for (const [key, child] of Object.entries(value as Record<string, any>)) {
		if (key !== META_KEY) result[key] = stripMeta(child);
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
 * changed edits and the conditions to use for the root item.
 */
export function resolveEditConflicts(options: {
	collection: string;
	primaryKey: string | number;
	edits: Record<string, any>;
	rootOnlyIf: OnlyIf;
	conflicts: EditConflict[];
	choices: ConflictChoice[];
}): { edits: Record<string, any>; rootOnlyIf: OnlyIf } {
	const { collection, primaryKey, conflicts, choices } = options;
	const fieldsStore = useFieldsStore();

	const edits = cloneDeep(options.edits);
	const rootOnlyIf = { ...options.rootOnlyIf };

	const isSameKey = (a: unknown, b: unknown) => String(a) === String(b);

	conflicts.forEach((conflict, index) => {
		const choice = choices[index] ?? 'mine';
		const primaryKeyField = fieldsStore.getPrimaryKeyFieldForCollection(conflict.collection)?.field;

		if (conflict.collection === collection && isSameKey(conflict.key, primaryKey)) {
			if (conflict.type !== 'changed' || !conflict.field) return;

			applyFieldChoice(edits, rootOnlyIf, conflict.field, choice, conflict.current);
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
					delete alterations[META_KEY]?.deleteOnlyIf?.[String(conflict.key)];

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
					const { [primaryKeyField]: _key, [META_KEY]: _meta, ...values } = removed;
					alterations.create = [...(alterations.create ?? []), values];
				}
			},
			item(itemCollection, item) {
				if (conflict.action !== 'update' || conflict.type !== 'changed' || !conflict.field) return;
				if (itemCollection !== conflict.collection || !primaryKeyField) return;
				if (!isSameKey(item[primaryKeyField], conflict.key) || !item[META_KEY]?.onlyIf) return;

				applyFieldChoice(item, item[META_KEY].onlyIf, conflict.field, choice, conflict.current);
			},
		});
	});

	return { edits, rootOnlyIf };
}

function applyFieldChoice(
	item: Record<string, any>,
	onlyIf: OnlyIf,
	field: string,
	choice: ConflictChoice,
	current: unknown
) {
	// Their version is shown in the form; saving it again doesn't change anything
	if (choice === 'theirs') item[field] = current;

	// Either way, the save is now based on the current value
	onlyIf[field] = { _sha256: sha256Digest(current) };
}
