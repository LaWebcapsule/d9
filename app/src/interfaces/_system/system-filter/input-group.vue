<template>
	<!-- Operators that don't need a value -->
	<template v-if="['_null', '_nnull', '_empty', '_nempty'].includes(comparator)">
		<!-- No input needed for these operators -->
	</template>

	<!-- Single value operators -->
	<template v-else-if="singleValueOperators.includes(comparator)">
		<field-or-value-input
			:value="value"
			:type="fieldInfo?.type ?? 'unknown'"
			:choices="choices"
			:allow-field-comparison="allowFieldComparison"
			:collection="collection"
			:current-field="getField(field)"
			:input-component="interfaceType"
			@update:value="value = $event"
		/>
	</template>

	<!-- String pattern operators -->
	<template v-else-if="patternOperators.includes(comparator)">
		<field-or-value-input
			:value="value"
			type="string"
			:choices="choices"
			:allow-field-comparison="allowFieldComparison"
			:collection="collection"
			:current-field="getField(field)"
			input-component="interface-input"
			@update:value="value = $event"
		/>
	</template>

	<!-- IN / NOT IN lists -->
	<div
		v-else-if="['_in', '_nin'].includes(comparator)"
		class="list"
		:class="{ moveComma: interfaceType === 'interface-input' }"
	>
		<div v-for="(val, index) in value" :key="index" class="value">
			<field-or-value-input
				:value="val"
				:type="fieldInfo?.type ?? 'unknown'"
				:choices="choices"
				:focus="false"
				:allow-field-comparison="allowFieldComparison"
				:collection="collection"
				:current-field="getField(field)"
				:input-component="interfaceType"
				@update:value="setListValue(index, $event)"
			/>
		</div>
	</div>

	<!-- BETWEEN / NOT BETWEEN -->
	<template v-else-if="['_between', '_nbetween'].includes(comparator)">
		<field-or-value-input
			:value="value[0]"
			:type="fieldInfo?.type ?? 'unknown'"
			:choices="choices"
			:allow-field-comparison="allowFieldComparison"
			:collection="collection"
			:current-field="getField(field)"
			:input-component="interfaceType"
			@update:value="setValueAt(0, $event)"
		/>
		<div class="and">{{ t('interfaces.filter.and') }}</div>
		<field-or-value-input
			:value="value[1]"
			:type="fieldInfo?.type ?? 'unknown'"
			:choices="choices"
			:allow-field-comparison="allowFieldComparison"
			:collection="collection"
			:current-field="getField(field)"
			:input-component="interfaceType"
			@update:value="setValueAt(1, $event)"
		/>
	</template>

	<!-- Default: any other operator -->
	<template v-else>
		<field-or-value-input
			:value="value"
			:type="fieldInfo?.type ?? 'unknown'"
			:choices="choices"
			:allow-field-comparison="allowFieldComparison"
			:collection="collection"
			:current-field="getField(field)"
			:input-component="interfaceType"
			@update:value="value = $event"
		/>
	</template>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from 'vue';
import { useFieldsStore } from '@/stores/fields';
import { useI18n } from 'vue-i18n';
import { clone, get } from 'lodash';
import { FieldFilter } from '@wbce-d9/types';
import { fieldToFilter, getComparator, getField } from './utils';
import { useRelationsStore } from '@/stores/relations';
import FieldOrValueInput from './field-or-value-input.vue';

export default defineComponent({
	components: { FieldOrValueInput },
	props: {
		field: {
			type: Object as PropType<FieldFilter>,
			required: true,
		},
		collection: {
			type: String,
			required: true,
		},
		allowFieldComparison: {
			type: Boolean,
			default: false,
		},
	},
	emits: ['update:field'],
	setup(props, { emit }) {
		const singleValueOperators = ['_eq', '_ieq', '_neq', '_lt', '_gt', '_lte', '_gte'];

		const patternOperators = [
			'_contains',
			'_ncontains',
			'_icontains',
			'_starts_with',
			'_istarts_with',
			'_nstarts_with',
			'_nistarts_with',
			'_ends_with',
			'_nends_with',
			'_regex',
		];

		const fieldsStore = useFieldsStore();
		const relationsStore = useRelationsStore();
		const { t } = useI18n();

		const fieldInfo = computed(() => {
			const fieldInfo = fieldsStore.getField(props.collection, getField(props.field));

			// Alias uses the foreign key type
			if (fieldInfo?.type === 'alias') {
				const relations = relationsStore.getRelationsForField(props.collection, getField(props.field));

				if (relations[0]) {
					return fieldsStore.getField(relations[0].collection, relations[0].field);
				}
			}

			return fieldInfo;
		});

		const comparator = computed(() => {
			return getComparator(props.field);
		});

		const interfaceType = computed(() => {
			if (fieldInfo.value?.meta?.options?.choices) return 'select';

			const types: Record<string, string> = {
				bigInteger: 'input',
				binary: 'input',
				boolean: 'boolean',
				date: 'datetime',
				dateTime: 'datetime',
				decimal: 'input',
				float: 'input',
				integer: 'input',
				json: 'input-code',
				string: 'input',
				text: 'input-multiline',
				time: 'datetime',
				timestamp: 'datetime',
				uuid: 'input',
				csv: 'input',
				hash: 'input-hash',
				geometry: 'map',
			};

			return 'interface-' + types[fieldInfo.value?.type || 'string'];
		});

		const value = computed<any | any[]>({
			get() {
				const fieldPath = getField(props.field);
				const value = get(props.field, `${fieldPath}.${comparator.value}`);

				if (['_in', '_nin'].includes(comparator.value)) {
					return [...(value as string[]).filter((val) => val !== null && val !== ''), null];
				} else {
					return value;
				}
			},
			set(newVal) {
				const fieldPath = getField(props.field);

				let value;

				if (['_in', '_nin'].includes(comparator.value)) {
					value = (newVal as string[])
						.flatMap((val) => (typeof val === 'string' ? val.split(',').map((v) => v.trim()) : ''))
						.filter((val) => val !== null && val !== '');
				} else {
					value = newVal;
				}

				emit('update:field', fieldToFilter(fieldPath, comparator.value, value));
			},
		});

		const choices = computed(() => fieldInfo.value?.meta?.options?.choices ?? []);

		return {
			t,
			singleValueOperators,
			patternOperators,
			choices,
			fieldInfo,
			interfaceType,
			value,
			comparator,
			setValueAt,
			setListValue,
			getField,
		};

		function setValueAt(index: number, newVal: any) {
			let newArray = Array.isArray(value.value) ? clone(value.value) : new Array(index + 1);
			newArray[index] = newVal;
			value.value = newArray;
		}

		function setListValue(index: number, newVal: any) {
			if (typeof newVal === 'string' && newVal.includes(',')) {
				const parts = newVal.split(',');

				for (let i = 0; i < parts.length; i++) {
					setValueAt(index + i, parts[i]);
				}
			} else {
				setValueAt(index, newVal);
			}
		}
	},
});
</script>

<style lang="scss" scoped>
.value {
	display: flex;
	align-items: center;

	.v-icon {
		margin-right: 8px;
		margin-left: 12px;
		color: var(--foreground-subdued);
		cursor: pointer;

		&:hover {
			color: var(--danger);
		}
	}
}

.list {
	display: flex;

	.value:not(:last-child)::after {
		margin-right: 6px;
		content: ',';
	}

	&.moveComma .value:not(:last-child)::after {
		margin: 0 8px 0 -6px;
	}
}

.and {
	margin: 0px 8px;
}
</style>
