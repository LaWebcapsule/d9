<template>
	<v-drawer
		:model-value="modelValue"
		:title="t('create_index')"
		persistent
		@cancel="cancel"
		@update:model-value="cancel"
	>
		<template #subtitle>
			<v-breadcrumb :items="[{ name: collectionName, disabled: true }]" />
		</template>

		<div class="drawer-item-content">
			<v-form
				v-model="edits"
				:fields="formFields"
				:initial-values="initialValues"
				:show-no-visible-fields="false"
				autofocus
				primary-key="+"
			/>
		</div>

		<v-dialog v-model="confirmLeave" @esc="confirmLeave = false">
			<v-card>
				<v-card-title>{{ t('unsaved_changes') }}</v-card-title>
				<v-card-text>{{ t('unsaved_changes_copy') }}</v-card-text>
				<v-card-actions>
					<v-button secondary @click="discardAndLeave">{{ t('discard_changes') }}</v-button>
					<v-button @click="confirmLeave = false">{{ t('keep_editing') }}</v-button>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<template #actions>
			<v-button v-tooltip.bottom="t('save')" icon rounded :disabled="!canSave" :loading="saving" @click="save">
				<v-icon name="check" />
			</v-button>
		</template>
	</v-drawer>
</template>

<script lang="ts" setup>
import api from '@/api';
import { useCollectionsStore } from '@/stores/collections';
import { useFieldsStore } from '@/stores/fields';
import { unexpectedError } from '@/utils/unexpected-error';
import type { Field, Filter, IndexCapabilities, IndexPayload } from '@wbce-d9/types';
import { cloneDeep, isEqual } from 'lodash';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import indexFieldsYaml from './index-fields.yaml';

type ColumnItem = { field: string };

type IndexForm = {
	collection: string;
	name: string;
	columns: ColumnItem[];
	where: Filter | null;
};

const props = defineProps<{
	modelValue: boolean;
	collection: string;
	capabilities: IndexCapabilities | null;
}>();

const emit = defineEmits<{
	(e: 'update:modelValue', value: boolean): void;
	(e: 'saved'): void;
}>();

const { t } = useI18n();
const fieldsStore = useFieldsStore();
const collectionsStore = useCollectionsStore();

const edits = ref<IndexForm>(emptyForm());
const initialValues = ref<IndexForm>(emptyForm());
const saving = ref(false);
const confirmLeave = ref(false);

const collectionName = computed(() => collectionsStore.getCollection(props.collection)?.name ?? props.collection);
const collectionKey = computed(() => props.collection.replace(/\.|-/g, '_').toLowerCase());
const namePrefix = computed(() => `${collectionKey.value}_`);
const nameSuffix = '_index';
const canSave = computed(() => edits.value.columns.some((column) => !!column.field));
const hasEdits = computed(() => !isEqual(edits.value, initialValues.value));

/**
 * The form structure lives in `index-fields.yaml`. Only the runtime-dependent bits are injected
 * here: the list of indexable fields and the partial tab availability.
 */
const formFields = computed<Field[]>(() => {
	const fields = cloneDeep(indexFieldsYaml) as unknown as Field[];

	const choices = (fieldsStore.getFieldsForCollection(props.collection) ?? [])
		.filter((field) => field.type !== 'alias' && field.schema?.is_primary_key !== true)
		.map((field) => ({ text: field.field, value: field.field }));

	const columnsField = fields.find((field) => field.field === 'columns') as any;

	if (columnsField?.meta?.options?.fields?.[0]) {
		columnsField.meta.options.fields[0].meta = {
			...(columnsField.meta.options.fields[0].meta ?? {}),
			options: { choices },
		};
	}

	const nameField = fields.find((field) => field.field === 'name') as any;

	if (nameField?.meta) {
		nameField.meta.options = { ...(nameField.meta.options ?? {}), prefix: namePrefix.value, suffix: nameSuffix };
	}

	if (!props.capabilities?.where) {
		const whereField = fields.find((field) => field.field === 'where');

		if (whereField?.meta) whereField.meta.hidden = true;
	}

	return fields;
});

watch(
	() => [props.modelValue] as const,
	([open]) => {
		if (!open) return;

		edits.value = emptyForm();
		initialValues.value = emptyForm();
		confirmLeave.value = false;
	},
	{ immediate: true }
);

function emptyForm(): IndexForm {
	return { collection: props.collection, name: '', columns: [], where: null };
}

function cancel() {
	if (hasEdits.value) {
		confirmLeave.value = true;
		return;
	}

	emit('update:modelValue', false);
}

function discardAndLeave() {
	confirmLeave.value = false;
	emit('update:modelValue', false);
}

async function save() {
	saving.value = true;

	try {
		const payload: IndexPayload = {
			columns: edits.value.columns.map((column) => column.field).filter((field): field is string => !!field),
		};

		if (props.capabilities?.where && edits.value.where) {
			payload.where = edits.value.where;
		}

		const middle = edits.value.name.trim();

		if (middle) payload.name = `${namePrefix.value}${middle}${nameSuffix}`;

		await api.post(`/indexes/${props.collection}`, payload);

		emit('saved');
		emit('update:modelValue', false);
	} catch (err: any) {
		unexpectedError(err);
	} finally {
		saving.value = false;
	}
}
</script>

<style lang="scss" scoped>
.drawer-item-content {
	padding: var(--content-padding);
	padding-bottom: var(--content-padding-bottom);
}
</style>
