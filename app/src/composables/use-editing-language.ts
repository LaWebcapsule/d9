import { computed, reactive, Ref, unref } from 'vue';

/**
 * Content language being edited in the translations interface of an item, by `collection:primaryKey`
 */
const editingLanguages = reactive<Record<string, string | undefined>>({});

function getKey(collection: string | null | undefined, primaryKey: string | number | null | undefined) {
	if (!collection || primaryKey === null || primaryKey === undefined) return null;
	return `${collection}:${primaryKey}`;
}

export function setEditingLanguage(
	collection: string | null | undefined,
	primaryKey: string | number | null | undefined,
	language: string | undefined
) {
	const key = getKey(collection, primaryKey);
	if (key) editingLanguages[key] = language;
}

export function useEditingLanguage(
	collection: Ref<string | null | undefined> | string,
	primaryKey: Ref<string | number | null | undefined>
) {
	return computed(() => {
		const key = getKey(unref(collection), primaryKey.value);
		return key ? editingLanguages[key] : undefined;
	});
}
