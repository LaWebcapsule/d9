import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { setActivePinia } from 'pinia';
import { beforeEach, expect, test, vi } from 'vitest';

import { cryptoStub } from '@/__utils__/crypto';
import { useFieldsStore } from '@/stores/fields';
import { useRelationsStore } from '@/stores/relations';
import { Field, Relation } from '@wbce-d9/types';
import VFieldTemplate from './v-field-template.vue';

vi.stubGlobal('crypto', cryptoStub);

const global = {
	stubs: {
		VMenu: { template: '<div><slot name="activator" :toggle="() => {}" /><slot /></div>' },
		VInput: { template: '<div><slot name="input" /><slot name="append" /></div>' },
		VIcon: true,
		VList: true,
	},
};

beforeEach(() => {
	setActivePinia(createTestingPinia({ createSpy: vi.fn, stubActions: false }));

	useFieldsStore().fields = [
		{
			collection: 'articles',
			field: 'slug',
			type: 'string',
			schema: {},
			meta: { id: 1, collection: 'articles', field: 'slug', special: null, group: null },
			name: 'Slug',
		},
	] as Field[];

	useRelationsStore().relations = [] as Relation[];
});

const languageField = {
	collection: 'articles',
	field: '$lang',
	name: 'Editing Language',
	type: 'string',
	schema: null,
	meta: null,
} as Field;

test('shows an injected field of a saved template as a field', () => {
	const wrapper = mount(VFieldTemplate, {
		props: {
			collection: 'articles',
			modelValue: 'https://example.com/{{$lang}}/{{slug}}',
			inject: { fields: [languageField], relations: [] },
		},
		global,
	});

	const buttons = wrapper.findAll('button');

	expect(buttons.map((button) => button.attributes('data-field'))).toEqual(['$lang', 'slug']);
	expect(buttons[0]!.text()).toBe('Editing Language');
});

test('drops a template variable that is not offered', () => {
	const wrapper = mount(VFieldTemplate, {
		props: { collection: 'articles', modelValue: 'https://example.com/{{$lang}}/{{slug}}' },
		global,
	});

	expect(wrapper.findAll('button').map((button) => button.attributes('data-field'))).toEqual(['slug']);
});
