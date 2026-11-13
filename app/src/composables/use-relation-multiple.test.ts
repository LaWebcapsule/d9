import { RelationQueryMultiple, useRelationMultiple } from '@/composables/use-relation-multiple';
import { useFieldsStore } from '@/stores/fields';
import { useRelationsStore } from '@/stores/relations';
import { createTestingPinia } from '@pinia/testing';
import { Field, Relation } from '@wbce-d9/types';
import { hashValue } from '@wbce-d9/utils';
import { flushPromises, mount } from '@vue/test-utils';
import { cloneDeep } from 'lodash';
import { setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { computed, defineComponent, h, ref, toRefs } from 'vue';
import { RelationM2A } from './use-relation-m2a';
import { RelationM2M } from './use-relation-m2m';
import { RelationO2M } from './use-relation-o2m';

vi.mock('@/api', () => {
	return {
		default: {
			get: (path: string, { params }: { params: Record<string, any> }) => {
				if (path === '/items/worker' && params?.aggregate?.count === 'id') {
					return Promise.resolve({
						data: {
							data: [{ count: { id: workerData.length } }],
						},
					});
				} else if (path === '/items/worker') {
					return Promise.resolve({
						data: {
							data: workerData,
						},
					});
				} else if (path === '/items/articles_translations' && params?.aggregate?.count === 'id') {
					return Promise.resolve({ data: { data: [{ count: { id: translationsData.length } }] } });
				} else if (path === '/items/articles_translations') {
					return Promise.resolve({ data: { data: translationsData } });
				} else if (path === '/items/article_m2a' && params?.aggregate?.count === 'id') {
					return Promise.resolve({
						data: {
							data: [{ count: { id: m2aData.length } }],
						},
					});
				} else {
					return Promise.resolve({
						data: {
							data: m2aData,
						},
					});
				}
			},
		},
	};
});

vi.mock('@/utils/unexpected-error', () => {
	return {
		unexpectedError: (error: any) => {
			throw error;
		},
	};
});

const relationO2M: RelationO2M = {
	relatedCollection: {
		name: 'Worker',
		collection: 'worker',
		icon: 'user',
		meta: null,
		schema: null,
		type: 'table',
	},
	relatedPrimaryKeyField: {
		name: 'ID',
		collection: 'worker',
		field: 'id',
		type: 'integer',
		meta: null,
		schema: null,
	},
	reverseJunctionField: {
		name: 'Facility',
		collection: 'facility',
		field: 'facility',
		type: 'integer',
		meta: null,
		schema: null,
	},
	relation: {
		collection: 'worker',
		field: 'facility',
		related_collection: 'facility',
		meta: null,
		schema: null,
	},
	type: 'o2m',
};

const workerData: Record<string, any>[] = [
	{ id: 1, name: 'test', facility: 1 },
	{ id: 2, name: 'test2', facility: 1 },
	{ id: 3, name: 'test3', facility: 1 },
	{ id: 4, name: 'test4', facility: 1 },
];

// eslint-disable-next-line vue/one-component-per-file
const TestComponent = defineComponent({
	props: ['value', 'relation', 'id'], // eslint-disable-line vue/require-prop-types
	emits: ['update:value'],
	setup(props) {
		const valueRef = ref(props.value);
		const { relation, id } = toRefs(props);

		const query = computed<RelationQueryMultiple>(() => {
			const q: RelationQueryMultiple = {
				limit: 15,
				page: 1,
				fields: ['id'],
			};

			return q;
		});

		// eslint-disable-next-line vue/no-dupe-keys
		return { value: valueRef, ...useRelationMultiple(valueRef, query, relation, id) };
	},
	render: () => h('div'),
});

/*
Facility                 Worker
┌─────────────┐          ┌─────────────────┐
│id: number   │◄────┐    │id: number       │
│name: string │     │    │name: string     │
│workers      │     └────┤facility: number │
│             │          │                 │
│             │          │                 │
└─────────────┘          └─────────────────┘
 */

describe('test o2m relation', () => {
	test('creating an item', async () => {
		const wrapper = mount(TestComponent, {
			props: { relation: relationO2M, value: [], id: 1 },
		});

		wrapper.vm.create({
			name: 'test5',
			facility: 1,
		});

		await flushPromises();

		expect(wrapper.vm.displayItems).toEqual([
			...workerData,
			{ name: 'test5', facility: 1, $type: 'created', $index: 0 },
		]);

		expect(wrapper.vm.value).toEqual({
			create: [
				{
					name: 'test5',
					facility: 1,
				},
			],
			update: [],
			delete: [],
		});
	});

	test('editing a created item', async () => {
		const wrapper = mount(TestComponent, {
			props: { relation: relationO2M, value: [], id: 1 },
		});

		wrapper.vm.create({
			name: 'test5',
			facility: 1,
		});

		wrapper.vm.update({
			name: 'test5 edited',
			facility: 2,
			$type: 'created',
			$index: 0,
		});

		await flushPromises();

		expect(wrapper.vm.displayItems).toEqual([
			...workerData,
			{ name: 'test5 edited', facility: 2, $type: 'created', $index: 0 },
		]);

		expect(wrapper.vm.value).toEqual({
			create: [
				{
					name: 'test5 edited',
					facility: 2,
				},
			],
			update: [],
			delete: [],
		});
	});

	test('removing a created item', async () => {
		const wrapper = mount(TestComponent, {
			props: { relation: relationO2M, value: [], id: 1 },
		});

		wrapper.vm.create({ name: 'test5', facility: 1 });

		wrapper.vm.remove({ name: 'test5', facility: 1, $type: 'created', $index: 0 });

		await flushPromises();

		expect(wrapper.vm.displayItems).toEqual(workerData);

		expect(wrapper.vm.value).toEqual(undefined);
	});

	test('updating an item', async () => {
		const wrapper = mount(TestComponent, {
			props: { relation: relationO2M, value: [], id: 1 },
		});

		wrapper.vm.update({ id: 2, name: 'test2-edited' });

		await flushPromises();

		const changes = cloneDeep(workerData);
		changes.splice(1, 1, { id: 2, name: 'test2-edited', facility: 1, $edits: 0, $type: 'updated', $index: 0 });

		expect(wrapper.vm.displayItems).toEqual(changes);

		expect(wrapper.vm.value).toEqual({
			create: [],
			update: [
				{
					id: 2,
					name: 'test2-edited',
				},
			],
			delete: [],
		});
	});

	test('removing an item', async () => {
		const wrapper = mount(TestComponent, {
			props: { relation: relationO2M, value: [], id: 1 },
		});

		wrapper.vm.remove({ id: 2 });

		await flushPromises();

		const changes = cloneDeep(workerData);
		changes.splice(1, 1, { id: 2, name: 'test2', facility: 1, $type: 'deleted', $index: 0 });

		expect(wrapper.vm.displayItems).toEqual(changes);
		expect(wrapper.vm.value).toEqual({ create: [], update: [], delete: [2] });
	});

	test('removing an edited item', async () => {
		const wrapper = mount(TestComponent, {
			props: { relation: relationO2M, value: [], id: 1 },
		});

		wrapper.vm.update({ id: 2, name: 'test2-edited' });
		wrapper.vm.remove({ id: 1 });
		wrapper.vm.remove({ id: 2 });

		await flushPromises();

		const changes = cloneDeep(workerData);
		changes.splice(1, 1, { id: 2, name: 'test2-edited', facility: 1, $type: 'deleted', $index: 1, $edits: 0 });
		changes.splice(0, 1, { id: 1, name: 'test', facility: 1, $type: 'deleted', $index: 0 });

		expect(wrapper.vm.displayItems).toEqual(changes);

		expect(wrapper.vm.value).toEqual({
			create: [],
			update: [
				{
					id: 2,
					name: 'test2-edited',
				},
			],
			delete: [1, 2],
		});
	});

	test('get item edits', async () => {
		const wrapper = mount(TestComponent, {
			props: { relation: relationO2M, value: [], id: 1 },
		});

		wrapper.vm.update({ id: 2, name: 'test2-edited' });

		await flushPromises();

		expect(wrapper.vm.getItemEdits(wrapper.vm.displayItems.find((item) => item.id === 2) as any)).toEqual({
			id: 2,
			name: 'test2-edited',
			$type: 'updated',
			$index: 0,
		});
	});
});

const relationM2A: RelationM2A = {
	allowedCollections: [
		{
			name: 'Text',
			collection: 'text',
			icon: 'user',
			meta: null,
			schema: null,
			type: 'table',
		},
		{
			name: 'Code',
			collection: 'code',
			icon: 'user',
			meta: null,
			schema: null,
			type: 'table',
		},
	],
	collectionField: {
		name: 'Collection',
		collection: 'article_m2a',
		field: 'collection',
		type: 'string',
		meta: null,
		schema: null,
	},
	junction: {
		collection: 'article_m2a',
		field: 'article_id',
		related_collection: 'article',
		meta: {
			id: 1,
			junction_field: 'item',
			many_collection: 'article_m2a',
			many_field: 'article_id',
			one_allowed_collections: null,
			one_collection: 'article',
			one_collection_field: null,
			one_deselect_action: 'nullify',
			one_field: 'content',
			sort_field: 'sort',
		},
		schema: null,
	},
	relation: {
		collection: 'article_m2a',
		field: 'item',
		related_collection: null,
		meta: {
			id: 2,
			junction_field: 'many_id',
			many_collection: 'article_m2a',
			many_field: 'item',
			one_allowed_collections: ['text', 'code'],
			one_collection: null,
			one_collection_field: 'collection',
			one_deselect_action: 'nullify',
			one_field: null,
			sort_field: null,
		},
		schema: null,
	},
	junctionCollection: {
		collection: 'article_m2a',
		name: 'Article M2A',
		icon: 'import_export',
		type: 'table',
		schema: null,
		meta: null,
	},
	junctionField: {
		collection: 'article_m2a',
		field: 'item',
		type: 'string',
		name: 'Item',
		meta: null,
		schema: null,
	},
	junctionPrimaryKeyField: {
		collection: 'article_m2a',
		field: 'id',
		type: 'integer',
		name: 'ID',
		meta: null,
		schema: null,
	},
	relationPrimaryKeyFields: {
		text: {
			collection: 'text',
			field: 'id',
			type: 'integer',
			name: 'ID',
			meta: null,
			schema: null,
		},
		code: {
			collection: 'code',
			field: 'id',
			type: 'integer',
			name: 'ID',
			meta: null,
			schema: null,
		},
	},
	reverseJunctionField: {
		collection: 'article_m2a',
		field: 'article_id',
		type: 'integer',
		name: 'Article ID',
		meta: null,
		schema: null,
	},
	sortField: 'sort',
	type: 'm2a',
};

const m2aData: Record<string, any>[] = [
	{ id: 1, article_id: 1, item: { id: 1 }, collection: 'text', sort: 1 },
	{ id: 2, article_id: 1, item: { id: 2 }, collection: 'text', sort: 2 },
	{ id: 3, article_id: 1, item: { id: 1 }, collection: 'code', sort: 3 },
];

// eslint-disable-next-line vue/one-component-per-file
const TestComponentM2A = defineComponent({
	props: ['value', 'relation', 'id'], // eslint-disable-line vue/require-prop-types
	emits: ['update:value'],
	setup(props) {
		const valueRef = ref(props.value);
		const { relation, id } = toRefs(props);

		const query = computed<RelationQueryMultiple>(() => {
			const q: RelationQueryMultiple = {
				limit: 15,
				page: 1,
				fields: ['id'],
			};

			return q;
		});

		// eslint-disable-next-line vue/no-dupe-keys
		return { value: valueRef, ...useRelationMultiple(valueRef, query, relation, id) };
	},
	render: () => h('div'),
});

/*
Article           Many|Any: article_m2a                    ┌─Text
┌─────────┐       ┌────────────────────────────────┐       │ ┌─────────┐
│id       ├───┐   │id: junctionPKField             │    ┌──┼─┤id       │
│content  │   └──►│article_id: reverseJunctionField│    │  │ │text     │
└─────────┘       │item: junctionField             │◄───┤  │ └─────────┘
				      │sort: sortField                 │    │  │
				      │collection: collectionField     │◄───┼──┤
				      └────────────────────────────────┘    │  │
														              │  └─Code
				AllowedCollection: [Text,Code]		        │    ┌─────────┐
				relatedPKFields: {Text: id,Code: id}        └────┤id       │
															                │code     │
															                └─────────┘
*/

const translationsData: Record<string, any>[] = [
	{ id: 10, articles_id: 1, languages_code: { code: 'en' }, body: 'English' },
	{ id: 11, articles_id: 1, languages_code: { code: 'de' }, body: 'Deutsch' },
];

const relationTranslations = {
	relatedCollection: { collection: 'languages' },
	relatedPrimaryKeyField: { collection: 'languages', field: 'code' },
	junctionCollection: { collection: 'articles_translations' },
	junctionPrimaryKeyField: { collection: 'articles_translations', field: 'id' },
	junctionField: { collection: 'articles_translations', field: 'languages_code' },
	reverseJunctionField: { collection: 'articles_translations', field: 'articles_id' },
	type: 'm2m',
} as unknown as RelationM2M;

describe('edit conflict base hashes', () => {
	beforeEach(() => {
		setActivePinia(createTestingPinia({ createSpy: vi.fn, stubActions: false }));

		useFieldsStore().fields = [
			{ collection: 'worker', field: 'id', type: 'integer', schema: { is_primary_key: true }, meta: null },
			{ collection: 'worker', field: 'name', type: 'string', schema: {}, meta: null },
			{ collection: 'worker', field: 'facility', type: 'integer', schema: {}, meta: null },
			{
				collection: 'articles_translations',
				field: 'id',
				type: 'integer',
				schema: { is_primary_key: true },
				meta: null,
			},
			{ collection: 'articles_translations', field: 'languages_code', type: 'string', schema: {}, meta: null },
			{ collection: 'articles_translations', field: 'body', type: 'text', schema: {}, meta: null },
			{ collection: 'languages', field: 'code', type: 'string', schema: { is_primary_key: true }, meta: null },
		] as unknown as Field[];

		useRelationsStore().relations = [
			{
				collection: 'articles_translations',
				field: 'languages_code',
				related_collection: 'languages',
				meta: { one_field: null, junction_field: 'articles_id' },
			},
		] as unknown as Relation[];
	});

	test('hashes the foreign key of the junction field of translations', async () => {
		const wrapper = mount(TestComponent, {
			props: { relation: relationTranslations, value: [], id: 1 },
		});

		await flushPromises();

		wrapper.vm.update({ id: 10, languages_code: { code: 'en' }, body: 'English (edited)' });

		expect(wrapper.vm.value.update).toEqual([
			{
				id: 10,
				languages_code: { code: 'en' },
				body: 'English (edited)',
				$base: { languages_code: hashValue('en'), body: hashValue('English') },
			},
		]);
	});

	test('adds the hashes of the loaded values when updating a loaded item', async () => {
		const wrapper = mount(TestComponent, {
			props: { relation: relationO2M, value: [], id: 1 },
		});

		await flushPromises();

		wrapper.vm.update({ id: 2, name: 'test2-edited' });

		expect(wrapper.vm.value.update).toEqual([{ id: 2, name: 'test2-edited', $base: { name: hashValue('test2') } }]);
	});

	test('keeps the existing hashes when editing again', async () => {
		const wrapper = mount(TestComponent, {
			props: { relation: relationO2M, value: [], id: 1 },
		});

		await flushPromises();

		wrapper.vm.update({ id: 2, name: 'first' });
		wrapper.vm.update({ ...wrapper.vm.displayItems[1], name: 'second' });

		expect(wrapper.vm.value.update).toEqual([
			{ id: 2, name: 'second', facility: 1, $base: { name: hashValue('test2'), facility: hashValue(1) } },
		]);
	});

	test('adds the hashes of the loaded values when deleting an item, and drops them on undo', async () => {
		const wrapper = mount(TestComponent, {
			props: { relation: relationO2M, value: [], id: 1 },
		});

		await flushPromises();

		wrapper.vm.remove({ id: 2 });

		expect(wrapper.vm.value).toEqual({
			create: [],
			update: [],
			delete: [2],
			$deleteBase: { 2: { name: hashValue('test2'), facility: hashValue(1) } },
		});

		wrapper.vm.remove(wrapper.vm.displayItems[1]);

		expect(wrapper.vm.value?.$deleteBase ?? {}).toEqual({});
	});
});

describe('test m2a relation', () => {
	test('sorting an item', async () => {
		const wrapper = mount(TestComponentM2A, {
			props: {
				relation: relationM2A,
				value: [],
				id: 1,
			},
		});

		wrapper.vm.update(
			{ id: 1, item: { id: 1 }, collection: 'text', sort: 2 },
			{ id: 2, item: { id: 2 }, collection: 'text', sort: 3 },
			{ id: 3, item: { id: 1 }, collection: 'code', sort: 1 }
		);

		await flushPromises();

		expect(wrapper.vm.displayItems).toEqual([
			{
				id: 3,
				article_id: 1,
				item: { id: 1 },
				collection: 'code',
				sort: 1,
				$type: 'updated',
				$index: 2,
				$edits: 2,
			},
			{
				id: 1,
				article_id: 1,
				item: { id: 1 },
				collection: 'text',
				sort: 2,
				$type: 'updated',
				$index: 0,
				$edits: 0,
			},
			{
				id: 2,
				article_id: 1,
				item: { id: 2 },
				collection: 'text',
				sort: 3,
				$type: 'updated',
				$index: 1,
				$edits: 1,
			},
		]);
	});
});
