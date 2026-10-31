<template>
	<div class="system-display-template">
		<v-notice v-if="collection === null" type="info">
			{{ t('interfaces.system-display-template.select_a_collection') }}
		</v-notice>

		<v-field-template
			v-else
			:collection="collection"
			:model-value="value"
			:disabled="disabled"
			:inject="injectFields"
			@update:model-value="$emit('input', $event)"
		/>
	</div>
</template>

<script lang="ts">
import { useI18n } from 'vue-i18n';
import { defineComponent, inject, ref, computed } from 'vue';
import { useCollectionsStore } from '@/stores/collections';
import { Field } from '@wbce-d9/types';

export default defineComponent({
	props: {
		disabled: {
			type: Boolean,
			default: false,
		},
		value: {
			type: String,
			default: null,
		},
		collectionField: {
			type: String,
			default: null,
		},
		collectionName: {
			type: String,
			default: null,
		},
		// Offers `{{$lang}}`, the content language being edited in a translations field, e.g. for the preview URL
		injectLanguageField: {
			type: Boolean,
			default: false,
		},
	},
	emits: ['input'],
	setup(props) {
		const { t } = useI18n();

		const collectionsStore = useCollectionsStore();

		const values = inject('values', ref<Record<string, any>>({}));

		const collection = computed(() => {
			if (!props.collectionField) {
				if (props.collectionName) return props.collectionName;
				return null;
			}

			const collectionName = values.value[props.collectionField];

			const collectionExists = !!collectionsStore.collections.find(
				(collection) => collection.collection === collectionName
			);

			if (collectionExists === false) return null;
			return collectionName;
		});

		const injectFields = computed(() => {
			if (!props.injectLanguageField || !collection.value) return null;

			const languageField: Field = {
				collection: collection.value,
				field: '$lang',
				name: t('interfaces.system-display-template.editing_language'),
				type: 'string',
				schema: null,
				meta: null,
			};

			return { fields: [languageField], relations: [] };
		});

		return { t, collection, injectFields };
	},
});
</script>
