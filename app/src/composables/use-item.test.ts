import api from '@/api';
import { useCollection } from '@wbce-d9/composables';
import { AppCollection, Field } from '@wbce-d9/types';
import { createTestingPinia } from '@pinia/testing';
import { setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed, ref } from 'vue';

import { useFieldsStore } from '@/stores/fields';
import { unexpectedError } from '@/utils/unexpected-error';
import { hashValue } from '@wbce-d9/utils';
import { flushPromises } from '@vue/test-utils';
import { useItem } from './use-item';

vi.mock('@/utils/notify', () => ({
	notify: vi.fn(),
}));

vi.mock('@/api', () => {
	return {
		default: {
			get: vi.fn(),
			post: vi.fn(),
			patch: vi.fn(),
		},
	};
});

vi.mock('@wbce-d9/composables');

vi.mock('@/utils/unexpected-error', () => ({
	unexpectedError: vi.fn(),
}));

beforeEach(() => {
	setActivePinia(
		createTestingPinia({
			createSpy: vi.fn,
			stubActions: false,
		})
	);
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('Save As Copy', () => {
	const apiGetSpy = vi.spyOn(api, 'get');
	const apiPostSpy = vi.spyOn(api, 'post');

	const mockResponse = {
		data: {
			data: { id: 1 },
		},
	};

	const mockCollection = {
		collection: 'test',
		name: 'test',
		meta: {
			archive_field: null,
			singleton: false,
		},
		schema: {},
	} as AppCollection;

	test('should keep manual primary key', async () => {
		apiGetSpy.mockResolvedValue(mockResponse);
		apiPostSpy.mockResolvedValue(mockResponse);

		const mockPrimaryKeyFieldName = 'id';

		const mockPrimaryKeyField = {
			collection: 'test',
			field: mockPrimaryKeyFieldName,
			type: 'string',
			schema: {
				is_primary_key: true,
				is_generated: false,
			},
			meta: {
				collection: 'test',
				field: mockPrimaryKeyFieldName,
				special: null,
				options: null,
				display_options: null,
				note: null,
				validation_message: null,
			},
		} as Field;

		const mockFields = [
			mockPrimaryKeyField,
			{
				collection: 'test',
				field: 'name',
				type: 'string',
				schema: {},
				meta: {
					collection: 'test',
					field: 'name',
					options: null,
					display_options: null,
					note: null,
					validation_message: null,
				},
			},
		] as Field[];

		vi.mocked(useCollection).mockReturnValue({
			info: computed(() => mockCollection),
			primaryKeyField: computed(() => mockPrimaryKeyField),
			fields: computed(() => mockFields),
		} as any);

		const { saveAsCopy } = useItem(ref('test'), ref(1));

		await saveAsCopy();

		expect(apiPostSpy.mock.lastCall![1]).toHaveProperty(mockPrimaryKeyFieldName);
	});

	test('should omit auto incremented primary key', async () => {
		apiGetSpy.mockResolvedValue(mockResponse);
		apiPostSpy.mockResolvedValue(mockResponse);

		const mockPrimaryKeyFieldName = 'id';

		const mockPrimaryKeyField = {
			collection: 'test',
			field: mockPrimaryKeyFieldName,
			type: 'integer',
			schema: {
				has_auto_increment: true,
				is_primary_key: true,
				is_generated: false,
			},
			meta: {
				collection: 'test',
				field: mockPrimaryKeyFieldName,
				options: null,
				display_options: null,
				note: null,
				validation_message: null,
			},
		} as Field;

		const mockFields = [
			mockPrimaryKeyField,
			{
				collection: 'test',
				field: 'name',
				type: 'string',
				schema: {},
				meta: {
					collection: 'test',
					field: 'name',
					options: null,
					display_options: null,
					note: null,
					validation_message: null,
				},
			},
		] as Field[];

		vi.mocked(useCollection).mockReturnValue({
			info: computed(() => mockCollection),
			primaryKeyField: computed(() => mockPrimaryKeyField),
			fields: computed(() => mockFields),
		} as any);

		const { saveAsCopy } = useItem(ref('test'), ref(1));

		await saveAsCopy();

		expect(apiPostSpy.mock.lastCall![1]).not.toHaveProperty(mockPrimaryKeyFieldName);
	});

	test('should omit special uuid primary key', async () => {
		apiGetSpy.mockResolvedValue(mockResponse);
		apiPostSpy.mockResolvedValue(mockResponse);

		const mockPrimaryKeyFieldName = 'id';

		const mockPrimaryKeyField = {
			collection: 'test',
			field: mockPrimaryKeyFieldName,
			type: 'uuid',
			schema: {
				is_primary_key: true,
				has_auto_increment: false,
				is_generated: false,
			},
			meta: {
				collection: 'test',
				field: mockPrimaryKeyFieldName,
				options: null,
				display_options: null,
				note: null,
				special: ['uuid'],
				validation_message: null,
			},
		} as Field;

		const mockFields = [
			mockPrimaryKeyField,
			{
				collection: 'test',
				field: 'name',
				type: 'string',
				schema: {},
				meta: {
					collection: 'test',
					field: 'name',
					options: null,
					display_options: null,
					note: null,
					validation_message: null,
				},
			},
		] as Field[];

		vi.mocked(useCollection).mockReturnValue({
			info: computed(() => mockCollection),
			primaryKeyField: computed(() => mockPrimaryKeyField),
			fields: computed(() => mockFields),
		} as any);

		const { saveAsCopy } = useItem(ref('test'), ref(1));

		await saveAsCopy();

		expect(apiPostSpy.mock.lastCall![1]).not.toHaveProperty(mockPrimaryKeyFieldName);
	});
});

describe('Edit conflicts', () => {
	const primaryKeyField = {
		collection: 'test',
		field: 'id',
		type: 'integer',
		schema: { is_primary_key: true, has_auto_increment: true },
		meta: null,
	} as unknown as Field;

	const fields = [
		primaryKeyField,
		{ collection: 'test', field: 'title', type: 'string', schema: {}, meta: null },
		{ collection: 'test', field: 'status', type: 'string', schema: {}, meta: null },
	] as unknown as Field[];

	const conflict = {
		collection: 'test',
		key: 1,
		action: 'update',
		type: 'changed',
		field: 'title',
		current: 'Theirs',
	};

	const conflictError = {
		response: {
			status: 409,
			data: { errors: [{ message: 'Conflict', extensions: { code: 'CONFLICT', conflicts: [conflict] } }] },
		},
	};

	async function setup(singleton = false) {
		useFieldsStore().fields = fields;

		vi.mocked(useCollection).mockReturnValue({
			info: computed(() => ({ collection: 'test', meta: { singleton, archive_field: null } })),
			primaryKeyField: computed(() => primaryKeyField),
			fields: computed(() => fields),
		} as any);

		vi.mocked(api.get).mockResolvedValue({ data: { data: { id: 1, title: 'Title', status: 'draft' } } });

		const usable = useItem(ref('test'), ref(singleton ? null : 1));
		await flushPromises();
		return usable;
	}

	test('sends the hashes of the loaded values of the changed fields', async () => {
		vi.mocked(api.patch).mockResolvedValue({ data: { data: { id: 1, title: 'Mine', status: 'draft' } } });

		const { edits, save } = await setup();

		edits.value = { title: 'Mine' };
		await save();

		expect(api.patch).toHaveBeenCalledWith('/items/test/1', { title: 'Mine', $base: { title: hashValue('Title') } });
	});

	test('keeps the edits and exposes the conflicts on a 409', async () => {
		vi.mocked(api.patch).mockRejectedValue(conflictError);

		const { edits, save, conflicts } = await setup();

		edits.value = { title: 'Mine' };
		await expect(save()).rejects.toBe(conflictError);

		expect(edits.value).toEqual({ title: 'Mine' });
		expect(conflicts.value).toEqual([conflict]);
		expect(unexpectedError).not.toHaveBeenCalled();
	});

	test('saves again with the chosen versions', async () => {
		vi.mocked(api.patch).mockRejectedValueOnce(conflictError);
		vi.mocked(api.patch).mockResolvedValueOnce({ data: { data: { id: 1, title: 'Mine', status: 'draft' } } });

		const { edits, save, conflicts, resolveConflicts } = await setup();

		edits.value = { title: 'Mine' };
		await save().catch(() => undefined);
		await resolveConflicts(['mine']);

		expect(api.patch).toHaveBeenLastCalledWith('/items/test/1', {
			title: 'Mine',
			$base: { title: hashValue('Theirs') },
		});

		expect(conflicts.value).toBeNull();
		expect(edits.value).toEqual({});
	});

	test('keeps checking against the originally loaded values after a reload', async () => {
		vi.mocked(api.patch).mockResolvedValue({ data: { data: { id: 1, title: 'Mine', status: 'draft' } } });

		const { edits, save, getItem } = await setup();

		edits.value = { title: 'Mine' };

		vi.mocked(api.get).mockResolvedValue({ data: { data: { id: 1, title: 'Changed', status: 'published' } } });
		await getItem();

		edits.value = { title: 'Mine', status: 'archived' };
		await save();

		expect(api.patch).toHaveBeenCalledWith('/items/test/1', {
			title: 'Mine',
			status: 'archived',
			$base: { title: hashValue('Title'), status: hashValue('published') },
		});
	});

	test('resolves the conflicts of a singleton', async () => {
		vi.mocked(api.patch).mockRejectedValueOnce(conflictError);
		vi.mocked(api.patch).mockResolvedValueOnce({ data: { data: { id: 1, title: 'Theirs', status: 'draft' } } });

		const { edits, save, resolveConflicts } = await setup(true);

		edits.value = { title: 'Mine' };
		await save().catch(() => undefined);
		await resolveConflicts(['theirs']);

		expect(api.patch).toHaveBeenLastCalledWith('/items/test', {
			title: 'Theirs',
			$base: { title: hashValue('Theirs') },
		});
	});

	test('does not send base hashes when saving as a copy', async () => {
		vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 2 } } });

		const { edits, saveAsCopy } = await setup();

		edits.value = { title: 'Mine', meta: { $base: { a: 'hash' }, nested: true } };
		await saveAsCopy();

		expect(api.post).toHaveBeenCalledWith('/items/test', { title: 'Mine', status: 'draft', meta: { nested: true } });
	});
});
