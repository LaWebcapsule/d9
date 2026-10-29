<template>
	<div class="indexes-section">
		<interface-presentation-divider :title="t('indexes')" icon="storage" />

		<v-notice v-if="capabilities && !capabilities.supported" type="warning">
			{{ t('indexes_not_supported') }}
		</v-notice>

		<template v-else>
			<v-notice v-if="!loading && indexes.length === 0" type="info">
				{{ t('no_indexes_copy') }}
			</v-notice>

			<v-list v-else>
				<v-list-item v-for="item in indexes" :key="item.name" block :dense="indexes.length > 4">
					<div class="index-info">
						<span class="name monospace">{{ item.name }}</span>
						<small class="columns">{{ item.columns.join(', ') }}</small>
					</div>

					<div class="spacer" />

					<v-icon v-if="item.unique" v-tooltip="t('index_unique')" name="check" class="badge" />
					<v-icon
						v-if="item.partial"
						v-tooltip="item.predicate ?? t('index_partial')"
						name="filter_alt"
						class="badge"
					/>
					<v-icon
						v-if="!item.deletable"
						v-tooltip="t(`index_undeletable_${item.delete_blocked_reason}`)"
						name="lock"
						class="badge"
					/>
					<v-icon
						v-else
						v-tooltip="t('delete_index')"
						name="delete"
						class="badge delete"
						clickable
						@click.stop="confirmDelete(item)"
					/>
				</v-list-item>
			</v-list>

			<div class="actions">
				<v-button :disabled="!capabilities?.supported" @click="createIndex">{{ t('create_index') }}</v-button>
			</div>
		</template>

		<index-detail v-model="createActive" :collection="collection" :capabilities="capabilities" @saved="refresh" />

		<v-dialog v-model="deleteActive" @esc="deleteActive = false">
			<v-card>
				<v-card-title>{{ t('delete_index_are_you_sure', { index: deleteTarget?.name }) }}</v-card-title>
				<v-card-text>{{ t('delete_index_copy') }}</v-card-text>
				<v-card-actions>
					<v-button secondary @click="deleteActive = false">{{ t('cancel') }}</v-button>
					<v-button kind="danger" :loading="deleting" @click="removeIndex">{{ t('delete_label') }}</v-button>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</div>
</template>

<script lang="ts" setup>
import { useIndexes } from '@/composables/use-indexes';
import { useFieldsStore } from '@/stores/fields';
import { unexpectedError } from '@/utils/unexpected-error';
import type { CollectionIndex } from '@wbce-d9/types';
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import IndexDetail from './index-detail.vue';

const props = defineProps<{
	collection: string;
}>();

const { t } = useI18n();
const fieldsStore = useFieldsStore();

const { indexes, capabilities, loading, refresh, remove } = useIndexes(() => props.collection);

const createActive = ref(false);
const deleteActive = ref(false);
const deleteTarget = ref<CollectionIndex | null>(null);
const deleting = ref(false);

onMounted(async () => {
	await fieldsStore.hydrate();
});

watch(
	() => props.collection,
	() => refresh(),
	{ immediate: true }
);

function createIndex() {
	createActive.value = true;
}

function confirmDelete(item: CollectionIndex) {
	deleteTarget.value = item;
	deleteActive.value = true;
}

async function removeIndex() {
	const target = deleteTarget.value;

	if (!target) return;

	deleting.value = true;

	try {
		await remove(target.name);
		deleteActive.value = false;
		deleteTarget.value = null;
	} catch (err: any) {
		unexpectedError(err);
	} finally {
		deleting.value = false;
	}
}
</script>

<style lang="scss" scoped>
.indexes-section {
	max-width: 800px;
	margin-bottom: 48px;
}

.index-info {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.name {
	font-weight: 600;
}

.columns {
	color: var(--foreground-subdued);
	font-family: var(--family-monospace);
}

.badge {
	margin-left: 8px;
	color: var(--foreground-subdued);
}

.delete:hover {
	color: var(--danger);
}

.monospace {
	font-family: var(--family-monospace);
}

.actions {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-top: 16px;
}
</style>
