import api from '@/api';
import { useFieldsStore } from '@/stores/fields';
import { usePermissionsStore } from '@/stores/permissions';
import { useUserStore } from '@/stores/user';
import { EditConflict } from '@/utils/edit-conflicts';
import { createTestingPinia } from '@pinia/testing';
import { flushPromises, mount } from '@vue/test-utils';
import { setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createI18n } from 'vue-i18n';
import ConflictsDrawer from './conflicts-drawer.vue';

vi.mock('@/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: { data: [] } }) } }));

const i18n = createI18n({
	legacy: false,
	missingWarn: false,
	locale: 'en-US',
	messages: { 'en-US': { edit_conflicts: { changed_by: 'Changed by {user} {time}' } } },
});

beforeEach(() => {
	vi.mocked(api.get)
		.mockReset()
		.mockResolvedValue({ data: { data: [] } });
});

function mountDrawer(
	conflict: Partial<EditConflict>,
	edits: Record<string, any>,
	pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
) {
	return mount(ConflictsDrawer, {
		props: {
			active: true,
			collection: 'articles',
			primaryKey: 1,
			edits,
			conflicts: [{ collection: 'articles', key: 1, action: 'update', type: 'changed', ...conflict } as EditConflict],
		},
		global: {
			plugins: [i18n, pinia],
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

describe('last change', () => {
	const conflict = { field: 'title', current: 'Theirs' };
	const edits = { title: 'Mine' };
	const jane = { id: 'user-jane', first_name: 'Jane', last_name: 'Doe' };

	function mockApi(responses: Record<string, any>) {
		vi.mocked(api.get).mockImplementation(async (url: string) => {
			if (!(url in responses)) throw new Error('Forbidden');
			return { data: { data: responses[url] } };
		});
	}

	function setUser(admin: boolean, activityPermissions: Record<string, any> | null = null) {
		useUserStore().currentUser = { id: 'user-me', role: { id: 'editor', admin_access: admin } } as any;

		usePermissionsStore().permissions = activityPermissions
			? ([{ role: 'editor', collection: 'directus_activity', action: 'read', permissions: activityPermissions }] as any)
			: [];
	}

	function setFields(specials: Record<string, string>) {
		useFieldsStore().fields = [
			{ collection: 'articles', field: 'id', schema: { is_primary_key: true }, meta: null },
			...Object.entries(specials).map(([field, special]) => ({
				collection: 'articles',
				field,
				schema: {},
				meta: { special: [special] },
			})),
		] as any;
	}

	async function changedBy(prepare: () => void) {
		const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false });
		setActivePinia(pinia);
		prepare();

		const wrapper = mountDrawer(conflict, edits, pinia);
		await flushPromises();

		return wrapper.find('.changed-by');
	}

	test('is read from the fields of the item that track it', async () => {
		mockApi({
			'/items/articles': [{ user_updated: 'user-jane', date_updated: '2026-11-13T10:00:00.000Z' }],
			'/users': [jane],
		});

		const element = await changedBy(() => {
			setUser(false);
			setFields({ user_updated: 'user-updated', date_updated: 'date-updated' });
		});

		expect(element.text()).toContain('Jane Doe');

		expect(api.get).toHaveBeenCalledWith('/items/articles', {
			params: { filter: { id: { _eq: 1 } }, fields: ['user_updated', 'date_updated'], limit: 1 },
		});

		expect(api.get).not.toHaveBeenCalledWith('/activity', expect.anything());
	});

	test('is read from the activity when the item does not track it', async () => {
		mockApi({ '/activity': [{ user: 'user-jane', timestamp: '2026-11-13T10:00:00.000Z' }], '/users': [jane] });

		const element = await changedBy(() => {
			setUser(false, {});
			setFields({});
		});

		expect(element.text()).toContain('Jane Doe');
	});

	test('is not read from the activity when the user can only see a part of it', async () => {
		mockApi({ '/activity': [{ user: 'user-me', timestamp: '2026-11-13T10:00:00.000Z' }], '/users': [] });

		const element = await changedBy(() => {
			setUser(false, { user: { _eq: '$CURRENT_USER' } });
			setFields({});
		});

		expect(element.exists()).toBe(false);
		expect(api.get).not.toHaveBeenCalledWith('/activity', expect.anything());
	});

	test('is left out when it can not be read', async () => {
		mockApi({});

		const element = await changedBy(() => {
			setUser(false, {});
			setFields({ user_updated: 'user-updated', date_updated: 'date-updated' });
		});

		expect(element.exists()).toBe(false);
	});
});
