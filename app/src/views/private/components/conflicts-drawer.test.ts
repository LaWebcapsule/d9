import { EditConflict } from '@/utils/edit-conflicts';
import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { expect, test, vi } from 'vitest';
import { createI18n } from 'vue-i18n';
import ConflictsDrawer from './conflicts-drawer.vue';

vi.mock('@/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: { data: [] } }) } }));

const i18n = createI18n({ legacy: false, missingWarn: false, locale: 'en-US', messages: { 'en-US': {} } });

function mountDrawer(conflict: Partial<EditConflict>, edits: Record<string, any>) {
	return mount(ConflictsDrawer, {
		props: {
			active: true,
			collection: 'articles',
			primaryKey: 1,
			edits,
			conflicts: [{ collection: 'articles', key: 1, action: 'update', type: 'changed', ...conflict } as EditConflict],
		},
		global: {
			plugins: [i18n, createTestingPinia({ createSpy: vi.fn })],
			stubs: {
				'v-drawer': { template: '<div><slot name="actions" /><slot /></div>' },
				'v-notice': { template: '<div class="v-notice"><slot /></div>' },
				'v-radio': true,
				'v-button': true,
				'v-icon': true,
			},
			directives: { tooltip: () => undefined },
		},
	});
}

test('shows their version and mine like the changes of a revision', () => {
	const wrapper = mountDrawer(
		{ field: 'title', current: 'The quick brown fox jumps over the lazy dog' },
		{ title: 'The quick brown fox jumps over the sleeping dog' }
	);

	const theirs = wrapper.find('.change-line.deleted');
	const mine = wrapper.find('.change-line.added');

	expect(theirs.text()).toBe('The quick brown fox jumps over the lazy dog');
	expect(mine.text()).toBe('The quick brown fox jumps over the sleeping dog');

	expect(theirs.findAll('.changed').map((part) => part.text())).toEqual(['lazy']);
	expect(mine.findAll('.changed').map((part) => part.text())).toEqual(['sleeping']);
});

test('shows values that are not text', () => {
	const wrapper = mountDrawer({ field: 'featured', current: true }, { featured: false });

	expect(wrapper.find('.change-line.deleted').text()).toBe('true');
	expect(wrapper.find('.change-line.added').text()).toBe('false');
});

test('shows a notice instead of their version when the current value is unknown', () => {
	const wrapper = mountDrawer({ field: 'title' }, { title: 'Mine' });

	expect(wrapper.find('.change-line.deleted').exists()).toBe(false);
	expect(wrapper.find('.change-line.added').text()).toBe('Mine');
});
