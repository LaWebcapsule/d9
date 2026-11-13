import api from '@/api';
import { VALIDATION_TYPES } from '@/constants';
import { i18n } from '@/lang';
import { useFieldsStore } from '@/stores/fields';
import { useRelationsStore } from '@/stores/relations';
import { APIError } from '@/types/error';
import {
	BASE_KEY,
	ConflictChoice,
	EditConflict,
	getBaseHashes,
	resolveEditConflicts,
	stripBases,
} from '@/utils/edit-conflicts';
import { notify } from '@/utils/notify';
import { translate } from '@/utils/translate-object-values';
import { unexpectedError } from '@/utils/unexpected-error';
import { validateItemConditions } from '@/utils/validate-item-conditions';
import { useCollection } from '@wbce-d9/composables';
import { getEndpoint } from '@wbce-d9/utils';
import { AxiosResponse } from 'axios';
import { cloneDeep, mergeWith, pick } from 'lodash';
import { computed, ComputedRef, isRef, Ref, ref, unref, watch } from 'vue';
import { usePermissions } from './use-permissions';
import { Field, Query, Relation } from '@wbce-d9/types';
import { getDefaultValuesFromFields } from '@/utils/get-default-values-from-fields';

type UsableItem = {
	edits: Ref<Record<string, any>>;
	hasEdits: Ref<boolean>;
	item: Ref<Record<string, any> | null>;
	error: Ref<any>;
	loading: Ref<boolean>;
	saving: Ref<boolean>;
	refresh: () => void;
	save: () => Promise<any>;
	isNew: ComputedRef<boolean>;
	remove: () => Promise<void>;
	deleting: Ref<boolean>;
	archive: () => Promise<void>;
	isArchived: ComputedRef<boolean | null>;
	archiving: Ref<boolean>;
	saveAsCopy: () => Promise<any>;
	isBatch: ComputedRef<boolean>;
	getItem: () => Promise<void>;
	validationErrors: Ref<any[]>;
	conflicts: Ref<EditConflict[] | null>;
	resolveConflicts: (choices: ConflictChoice[]) => Promise<any>;
};

export function useItem(
	collection: Ref<string>,
	primaryKey: Ref<string | number | null>,
	query: Ref<Query> | Query = {}
): UsableItem {
	const { info: collectionInfo, primaryKeyField } = useCollection(collection);
	const item = ref<Record<string, any> | null>(null);
	const error = ref<any>(null);
	const validationErrors = ref<any[]>([]);
	const loading = ref(false);
	const saving = ref(false);
	const deleting = ref(false);
	const archiving = ref(false);
	const edits = ref<Record<string, any>>({});
	const conflicts = ref<EditConflict[] | null>(null);
	// Item as returned by the API, before translating system values. Used for the conflict check base.
	const loadedItem = ref<Record<string, any> | null>(null);
	// Base hashes chosen while resolving conflicts, `null` skips the check of a field
	const baseOverrides = ref<Record<string, string | null>>({});
	const hasEdits = computed(() => Object.keys(edits.value).length > 0);
	const isNew = computed(() => primaryKey.value === '+');
	const isBatch = computed(() => typeof primaryKey.value === 'string' && primaryKey.value.includes(','));
	const isSingle = computed(() => !!collectionInfo.value?.meta?.singleton);

	const isArchived = computed(() => {
		if (!collectionInfo.value?.meta?.archive_field) return null;

		if (collectionInfo.value.meta.archive_value === 'true') {
			return item.value?.[collectionInfo.value.meta.archive_field] === true;
		}

		return item.value?.[collectionInfo.value.meta.archive_field] === collectionInfo.value.meta.archive_value;
	});

	const { fields: fieldsWithPermissions } = usePermissions(collection, item, isNew);

	const itemEndpoint = computed(() => {
		if (isSingle.value) {
			return getEndpoint(collection.value);
		}

		return `${getEndpoint(collection.value)}/${encodeURIComponent(primaryKey.value as string)}`;
	});

	const defaultValues = getDefaultValuesFromFields(fieldsWithPermissions);

	watch([collection, primaryKey, ...(isRef(query) ? [query] : [])], refresh, { immediate: true });

	return {
		edits,
		hasEdits,
		item,
		error,
		loading,
		saving,
		refresh,
		save,
		isNew,
		remove,
		deleting,
		archive,
		isArchived,
		archiving,
		saveAsCopy,
		isBatch,
		getItem,
		validationErrors,
		conflicts,
		resolveConflicts,
	};

	async function getItem() {
		loading.value = true;
		error.value = null;

		try {
			const response = await api.get(itemEndpoint.value, { params: unref(query) });
			keepBaseOfEditedFields();
			setItemValueToResponse(response);
		} catch (err: any) {
			error.value = err;
		} finally {
			loading.value = false;
		}
	}

	async function save() {
		saving.value = true;
		validationErrors.value = [];

		const payloadToValidate = mergeWith(
			{},
			defaultValues.value,
			item.value,
			edits.value,
			function (from: any, to: any) {
				if (typeof to !== 'undefined') {
					return to;
				}
			}
		);

		const errors = validateItemConditions(payloadToValidate, fieldsWithPermissions.value, isNew.value);

		if (errors.length > 0) {
			validationErrors.value = errors;
			saving.value = false;
			throw errors;
		}

		try {
			let response;

			if (isNew.value === true) {
				response = await api.post(getEndpoint(collection.value), edits.value);

				notify({
					title: i18n.global.t('item_create_success', isBatch.value ? 2 : 1),
				});
			} else {
				response = await api.patch(itemEndpoint.value, withBase(edits.value));

				notify({
					title: i18n.global.t('item_update_success', isBatch.value ? 2 : 1),
				});
			}

			setItemValueToResponse(response);
			edits.value = {};
			baseOverrides.value = {};
			conflicts.value = null;
			return response.data.data;
		} catch (err: any) {
			saveErrorHandler(err);
		} finally {
			saving.value = false;
		}
	}

	/**
	 * Add the hashes of the loaded values of the changed fields, so the API can reject the save if someone
	 * else changed them in the meantime. Nested items get their hashes in useRelationMultiple.
	 */
	function withBase(payload: Record<string, any>) {
		if (isBatch.value || !loadedItem.value || !primaryKeyField.value) return payload;
		if (!(primaryKeyField.value.field in loadedItem.value)) return payload;

		const fields = Object.keys(payload);

		const base = pick({ ...getBaseHashes(collection.value, loadedItem.value, fields), ...baseOverrides.value }, fields);

		return Object.keys(base).length > 0 ? { ...payload, [BASE_KEY]: base } : payload;
	}

	/**
	 * When the item is reloaded while there are unsaved edits, the edited fields still have to be checked
	 * against the values the user saw when starting to edit them
	 */
	function keepBaseOfEditedFields() {
		if (!loadedItem.value || !hasEdits.value) {
			baseOverrides.value = {};
			return;
		}

		baseOverrides.value = {
			...getBaseHashes(collection.value, loadedItem.value, Object.keys(edits.value)),
			...baseOverrides.value,
		};
	}

	/**
	 * Apply the choices for the reported conflicts to the edits and save again
	 */
	async function resolveConflicts(choices: ConflictChoice[]) {
		// Singletons don't have the primary key in the route
		const key = isSingle.value ? loadedItem.value?.[primaryKeyField.value?.field ?? ''] : primaryKey.value;

		if (!conflicts.value || key === null || key === undefined) return;

		const resolved = resolveEditConflicts({
			collection: collection.value,
			primaryKey: key,
			edits: edits.value,
			rootBase: baseOverrides.value,
			conflicts: conflicts.value,
			choices,
		});

		edits.value = resolved.edits;
		baseOverrides.value = resolved.rootBase;
		conflicts.value = null;

		return await save();
	}

	async function saveAsCopy() {
		saving.value = true;
		validationErrors.value = [];

		const fields = collectionInfo.value?.meta?.item_duplication_fields || ['*'];

		const itemData = await api.get(itemEndpoint.value, { params: { fields } });

		const newItem: { [field: string]: any } = {
			...(itemData.data.data || {}),
			...edits.value,
		};

		// Make sure to delete the primary key if it's has auto increment enabled
		if (primaryKeyField.value && primaryKeyField.value.field in newItem) {
			if (primaryKeyField.value.schema?.has_auto_increment || primaryKeyField.value.meta?.special?.includes('uuid')) {
				delete newItem[primaryKeyField.value.field];
			}
		}

		// Make sure to delete nested relational primary keys
		const fieldsStore = useFieldsStore();
		const relationsStore = useRelationsStore();
		const relations = relationsStore.getRelationsForCollection(collection.value);

		for (const relation of relations) {
			const relatedPrimaryKeyField = fieldsStore.getPrimaryKeyFieldForCollection(relation.collection);

			const existsJunctionRelated = relationsStore.relations.find((r) => {
				return r.collection === relation.collection && r.meta?.many_field === relation.meta?.junction_field;
			});

			if (relation.meta?.one_field && relation.meta.one_field in newItem) {
				const fieldsToFetch = fields
					.filter((field) => field.startsWith(relation.meta!.one_field!))
					.map((field) => field.split('.').slice(1).join('.'));

				if (Array.isArray(newItem[relation.meta.one_field])) {
					const existingItems = await findExistingRelatedItems(
						newItem,
						relation,
						relatedPrimaryKeyField,
						fieldsToFetch
					);

					newItem[relation.meta.one_field] = newItem[relation.meta.one_field].map((relatedItem: any) => {
						if (typeof relatedItem !== 'object' && existingItems.length > 0) {
							relatedItem = existingItems.find((existingItem: any) => existingItem.id === relatedItem);
						}

						delete relatedItem[relatedPrimaryKeyField!.field];

						updateJunctionRelatedKey(relation, existsJunctionRelated, fieldsStore, relatedItem);
						return relatedItem;
					});
				} else {
					const createdRelatedItems = newItem[relation.meta.one_field]?.create;
					const updatedRelatedItems = newItem[relation.meta.one_field]?.update;
					const deletedRelatedItems = newItem[relation.meta.one_field]?.delete;

					let existingItems: any[] = await findExistingRelatedItems(
						item.value,
						relation,
						relatedPrimaryKeyField,
						fieldsToFetch
					);

					existingItems = existingItems.filter((i) => {
						return deletedRelatedItems.indexOf(i[relatedPrimaryKeyField!.field]) === -1;
					});

					for (const item of updatedRelatedItems) {
						updateJunctionRelatedKey(relation, existsJunctionRelated, fieldsStore, item);
					}

					for (const item of existingItems) {
						updateExistingRelatedItems(updatedRelatedItems, item, relatedPrimaryKeyField, relation);
					}

					updatedRelatedItems.length = 0;

					for (const item of existingItems) {
						delete item[relatedPrimaryKeyField!.field];
						createdRelatedItems.push(item);
					}
				}
			}
		}

		const errors = validateItemConditions(newItem, fieldsWithPermissions.value, isNew.value);

		if (errors.length > 0) {
			validationErrors.value = errors;
			saving.value = false;
			throw errors;
		}

		try {
			const response = await api.post(getEndpoint(collection.value), stripBases(newItem));

			notify({
				title: i18n.global.t('item_create_success', 1),
			});

			// Reset edits to the current item
			edits.value = {};

			return primaryKeyField.value ? response.data.data[primaryKeyField.value.field] : null;
		} catch (err: any) {
			saveErrorHandler(err);
		} finally {
			saving.value = false;
		}

		async function findExistingRelatedItems(
			item: any,
			relation: Relation,
			relatedPrimaryKeyField: Field | null,
			fieldsToFetch: string[]
		) {
			const existingIds = item?.[relation.meta!.one_field!].filter((item: any) => typeof item !== 'object');
			let existingItems: any[] = [];

			if (existingIds.length > 0) {
				const response = await api.get(getEndpoint(relation.collection), {
					params: {
						fields: [relatedPrimaryKeyField!.field, ...fieldsToFetch],
						[`filter[${relatedPrimaryKeyField!.field}][_in]`]: existingIds.join(','),
					},
				});

				existingItems = response.data.data;
			}

			return existingItems;
		}

		function updateExistingRelatedItems(
			updatedRelatedItems: any,
			item: any,
			relatedPrimaryKeyField: Field | null,
			relation: Relation
		) {
			for (const updatedItem of updatedRelatedItems) {
				copyUserEditValuesToExistingItem(item, relatedPrimaryKeyField, updatedItem, relation);
			}
		}

		function copyUserEditValuesToExistingItem(
			item: any,
			relatedPrimaryKeyField: Field | null,
			updatedItem: any,
			relation: Relation
		) {
			if (item[relatedPrimaryKeyField!.field] === updatedItem[relatedPrimaryKeyField!.field]) {
				const columns = fields.filter((s) => s.startsWith(relation.meta!.one_field!));

				for (const col of columns) {
					const colName = col.split('.')[1];
					item[colName] = updatedItem[colName];
				}
			}
		}
	}

	function updateJunctionRelatedKey(
		relation: Relation,
		existsJunctionRelated: Relation | undefined,
		fieldsStore: any,
		item: any
	) {
		if (relation.meta?.junction_field && existsJunctionRelated?.related_collection) {
			const junctionRelatedPrimaryKeyField = fieldsStore.getPrimaryKeyFieldForCollection(
				existsJunctionRelated.related_collection
			);

			if (relation.meta.junction_field in item && junctionRelatedPrimaryKeyField.schema!.is_generated) {
				delete item[relation.meta.junction_field][junctionRelatedPrimaryKeyField!.field];
			}
		}
	}

	function saveErrorHandler(err: any) {
		const conflictError = err?.response?.data?.errors?.find(
			(error: APIError) => error?.extensions?.code === 'CONFLICT'
		);

		if (conflictError) {
			conflicts.value = conflictError.extensions.conflicts ?? [];
			throw err;
		}

		if (err?.response?.data?.errors) {
			validationErrors.value = err.response.data.errors
				.filter((err: APIError) => VALIDATION_TYPES.includes(err?.extensions?.code))
				.map((err: APIError) => {
					return err.extensions;
				});

			const otherErrors = err.response.data.errors.filter(
				(err: APIError) => VALIDATION_TYPES.includes(err?.extensions?.code) === false
			);

			if (otherErrors.length > 0) {
				otherErrors.forEach(unexpectedError);
			}
		} else {
			unexpectedError(err);
		}

		throw err;
	}

	async function archive() {
		if (!collectionInfo.value?.meta?.archive_field) return;

		archiving.value = true;

		const field = collectionInfo.value.meta.archive_field;

		let archiveValue: any = collectionInfo.value.meta.archive_value;
		if (archiveValue === 'true') archiveValue = true;
		if (archiveValue === 'false') archiveValue = false;

		let unarchiveValue: any = collectionInfo.value.meta.unarchive_value;
		if (unarchiveValue === 'true') unarchiveValue = true;
		if (unarchiveValue === 'false') unarchiveValue = false;

		try {
			let value: any = item.value && item.value[field] === archiveValue ? unarchiveValue : archiveValue;

			if (value === 'true') value = true;
			if (value === 'false') value = false;

			await api.patch(itemEndpoint.value, {
				[field]: value,
			});

			item.value = {
				...item.value,
				[field]: value,
			};

			notify({
				title:
					value === archiveValue
						? i18n.global.t('item_delete_success', isBatch.value ? 2 : 1)
						: i18n.global.t('item_update_success', isBatch.value ? 2 : 1),
			});
		} catch (err: any) {
			unexpectedError(err);
			throw err;
		} finally {
			archiving.value = false;
		}
	}

	async function remove() {
		deleting.value = true;

		try {
			await api.delete(itemEndpoint.value);

			item.value = null;

			notify({
				title: i18n.global.t('item_delete_success', isBatch.value ? 2 : 1),
			});
		} catch (err: any) {
			unexpectedError(err);
			throw err;
		} finally {
			deleting.value = false;
		}
	}

	function refresh() {
		error.value = null;
		loading.value = false;
		saving.value = false;
		deleting.value = false;

		conflicts.value = null;

		if (isNew.value === true) {
			item.value = null;
			loadedItem.value = null;
		} else {
			getItem();
		}
	}

	function setItemValueToResponse(response: AxiosResponse) {
		loadedItem.value = isBatch.value ? null : cloneDeep(response.data.data);

		if (
			(collection.value.startsWith('directus_') && collection.value !== 'directus_collections') ||
			(collection.value === 'directus_collections' && response.data.data.collection?.startsWith('directus_'))
		) {
			response.data.data = translate(response.data.data);
		}

		if (isBatch.value === false) {
			item.value = response.data.data;
		} else {
			const valuesThatAreEqual = { ...response.data.data[0] };

			response.data.data.forEach((existingItem: any) => {
				for (const [key, value] of Object.entries(existingItem)) {
					if (valuesThatAreEqual[key] !== value) {
						delete valuesThatAreEqual[key];
					}
				}
			});

			item.value = valuesThatAreEqual;
		}
	}
}
