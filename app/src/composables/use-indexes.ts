import api from '@/api';
import type { CollectionIndex, IndexCapabilities, IndexPayload } from '@wbce-d9/types';
import { isRef, ref, type Ref } from 'vue';

type CollectionSource = string | Ref<string> | (() => string);

function resolveCollection(collection: CollectionSource): string {
	if (typeof collection === 'function') return collection();
	if (isRef(collection)) return collection.value;
	return collection;
}

export function useIndexes(collection: CollectionSource) {
	const indexes = ref<CollectionIndex[]>([]);
	const capabilities = ref<IndexCapabilities | null>(null);
	const loading = ref(false);
	const error = ref<any>(null);

	const collectionName = () => resolveCollection(collection);

	async function refresh() {
		loading.value = true;
		error.value = null;

		try {
			const response = await api.get(`/indexes/${collectionName()}`);

			indexes.value = response.data.data;
			capabilities.value = response.data.meta?.capabilities ?? null;
		} catch (err: any) {
			error.value = err;
		} finally {
			loading.value = false;
		}
	}

	async function create(payload: IndexPayload) {
		await api.post(`/indexes/${collectionName()}`, payload);
		await refresh();
	}

	async function remove(name: string) {
		await api.delete(`/indexes/${collectionName()}/${encodeURIComponent(name)}`);
		await refresh();
	}

	return { indexes, capabilities, loading, error, refresh, create, remove };
}
