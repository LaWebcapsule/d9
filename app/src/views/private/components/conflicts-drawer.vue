<template>
	<v-drawer
		:model-value="active"
		:title="t('edit_conflicts.title')"
		icon="warning"
		persistent
		@cancel="$emit('cancel')"
	>
		<template #actions>
			<v-button
				v-tooltip.bottom="t('edit_conflicts.resolve')"
				icon
				rounded
				:loading="saving"
				:disabled="!resolvable"
				@click="$emit('resolve', choices)"
			>
				<v-icon name="check" />
			</v-button>
		</template>

		<div class="content">
			<v-notice type="warning">{{ t('edit_conflicts.description') }}</v-notice>

			<div v-for="group in groups" :key="group.id" class="group">
				<div class="group-header">
					<span class="type-label">{{ group.title }}</span>
					<span v-if="group.changedBy" class="changed-by">{{ group.changedBy }}</span>
				</div>

				<v-notice v-if="group.kind === 'item-deleted'" type="danger">
					{{ t('edit_conflicts.item_deleted') }}
				</v-notice>

				<template v-else-if="group.kind === 'deleted' || group.kind === 'delete'">
					<p>{{ t(group.kind === 'deleted' ? 'edit_conflicts.nested_deleted' : 'edit_conflicts.delete_changed') }}</p>

					<div class="choices">
						<v-radio
							block
							value="mine"
							:model-value="choices[group.indexes[0]!]"
							:label="t(group.kind === 'deleted' ? 'edit_conflicts.restore_mine' : 'edit_conflicts.delete_anyway')"
							@update:model-value="setGroupChoice(group, 'mine')"
						/>
						<v-radio
							block
							value="theirs"
							:model-value="choices[group.indexes[0]!]"
							:label="t(group.kind === 'deleted' ? 'edit_conflicts.discard_mine' : 'edit_conflicts.keep_item')"
							@update:model-value="setGroupChoice(group, 'theirs')"
						/>
					</div>
				</template>

				<template v-else>
					<div v-for="index in group.indexes" :key="index" class="field">
						<div class="field-name type-label">{{ getFieldName(conflicts[index]!) }}</div>

						<div class="versions">
							<div class="version" :class="{ selected: choices[index] === 'theirs' }">
								<v-radio
									block
									value="theirs"
									:model-value="choices[index]"
									:label="t('edit_conflicts.keep_theirs')"
									@update:model-value="choices[index] = 'theirs'"
								/>
								<v-notice v-if="!('current' in conflicts[index]!)" type="info">
									{{ t('edit_conflicts.no_access') }}
								</v-notice>
								<pre v-else class="value">{{ formatValue(conflicts[index]!.current) }}</pre>
							</div>

							<div class="version" :class="{ selected: choices[index] === 'mine' }">
								<v-radio
									block
									value="mine"
									:model-value="choices[index]"
									:label="t('edit_conflicts.keep_mine')"
									@update:model-value="choices[index] = 'mine'"
								/>
								<pre class="value">{{ formatValue(getMyValue(conflicts[index]!)) }}</pre>
							</div>
						</div>
					</div>
				</template>
			</div>
		</div>
	</v-drawer>
</template>

<script setup lang="ts">
import api from '@/api';
import { useCollectionsStore } from '@/stores/collections';
import { useFieldsStore } from '@/stores/fields';
import { ConflictChoice, EditConflict, walkEdits } from '@/utils/edit-conflicts';
import { localizedFormatDistance } from '@/utils/localized-format-distance';
import { userName } from '@/utils/user-name';
import { User } from '@wbce-d9/types';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

interface Props {
	active: boolean;
	collection: string;
	primaryKey: string | number | null;
	edits: Record<string, any>;
	conflicts: EditConflict[];
	saving?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	saving: false,
});

defineEmits<{
	(e: 'resolve', choices: ConflictChoice[]): void;
	(e: 'cancel'): void;
}>();

const { t } = useI18n();

const collectionsStore = useCollectionsStore();
const fieldsStore = useFieldsStore();

const choices = ref<ConflictChoice[]>([]);
const users = ref<Record<string, Partial<User>>>({});

watch(
	() => props.conflicts,
	(conflicts) => {
		// Keeping the local changes is the default, nothing gets lost by accident
		choices.value = conflicts.map(() => 'mine');
		loadUsers(conflicts);
	},
	{ immediate: true }
);

type Group = {
	id: string;
	kind: 'changed' | 'deleted' | 'delete' | 'item-deleted';
	title: string;
	changedBy: string | null;
	indexes: number[];
};

const groups = computed<Group[]>(() => {
	const groups: Record<string, Group> = {};

	props.conflicts.forEach((conflict, index) => {
		const isRoot = isRootItem(conflict);
		const id = `${conflict.collection}:${conflict.key}:${conflict.action}:${conflict.type}`;

		if (!groups[id]) {
			let kind: Group['kind'] = 'changed';
			if (conflict.action === 'delete') kind = 'delete';
			else if (conflict.type === 'deleted') kind = isRoot ? 'item-deleted' : 'deleted';

			const collectionName = collectionsStore.getCollection(conflict.collection)?.name ?? conflict.collection;

			groups[id] = {
				id,
				kind,
				title: isRoot ? collectionName : `${collectionName} #${conflict.key}`,
				changedBy: getChangedBy(conflict),
				indexes: [],
			};
		}

		groups[id]!.indexes.push(index);
	});

	return Object.values(groups);
});

const resolvable = computed(() => groups.value.every((group) => group.kind !== 'item-deleted'));

function isRootItem(conflict: EditConflict) {
	return conflict.collection === props.collection && String(conflict.key) === String(props.primaryKey);
}

function setGroupChoice(group: Group, choice: ConflictChoice) {
	for (const index of group.indexes) choices.value[index] = choice;
}

function getFieldName(conflict: EditConflict) {
	if (!conflict.field) return '';
	return fieldsStore.getField(conflict.collection, conflict.field)?.name ?? conflict.field;
}

function getMyValue(conflict: EditConflict) {
	if (!conflict.field) return undefined;
	if (isRootItem(conflict)) return props.edits[conflict.field];

	const primaryKeyField = fieldsStore.getPrimaryKeyFieldForCollection(conflict.collection)?.field;
	let value: unknown;

	walkEdits(props.collection, props.edits, {
		item(collection, item) {
			if (collection !== conflict.collection || !primaryKeyField) return;
			if (String(item[primaryKeyField]) === String(conflict.key) && conflict.field! in item)
				value = item[conflict.field!];
		},
	});

	return value;
}

function getChangedBy(conflict: EditConflict) {
	if (!conflict.timestamp) return null;

	const user = conflict.user ? users.value[conflict.user] : undefined;

	return t('edit_conflicts.changed_by', {
		user: user ? userName(user) : t('unknown_user'),
		time: localizedFormatDistance(new Date(conflict.timestamp), new Date(), { addSuffix: true }),
	});
}

function formatValue(value: unknown) {
	if (value === null || value === undefined) return '--';
	if (typeof value === 'string') return value;
	return JSON.stringify(value, null, 2);
}

async function loadUsers(conflicts: EditConflict[]) {
	const ids = [...new Set(conflicts.map((conflict) => conflict.user).filter((id): id is string => !!id))].filter(
		(id) => !(id in users.value)
	);

	if (ids.length === 0) return;

	try {
		const response = await api.get('/users', {
			params: { filter: { id: { _in: ids } }, fields: ['id', 'first_name', 'last_name', 'email'] },
		});

		for (const user of response.data.data) users.value[user.id] = user;
	} catch {
		// Without permission to read users, the change is shown without a name
	}
}
</script>

<style lang="scss" scoped>
.content {
	padding: var(--content-padding);
	padding-top: 0;
	padding-bottom: var(--content-padding-bottom);
}

.group {
	margin-top: 32px;
}

.group-header {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 12px;
	padding-bottom: 8px;
	border-bottom: var(--border-width) solid var(--border-subdued);
}

.changed-by {
	color: var(--foreground-subdued);
}

.choices {
	display: grid;
	gap: 8px;
	margin-top: 12px;
}

.field + .field {
	margin-top: 20px;
}

.field-name {
	margin-bottom: 8px;
}

.versions {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
	gap: 12px;
}

.version {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 8px;
	border: var(--border-width) solid var(--border-subdued);
	border-radius: var(--border-radius);

	&.selected {
		border-color: var(--primary);
	}
}

.value {
	max-height: 240px;
	margin: 0;
	padding: 8px;
	overflow: auto;
	font-family: var(--family-monospace);
	white-space: pre-wrap;
	word-break: break-word;
	background-color: var(--background-subdued);
	border-radius: var(--border-radius);
}
</style>
