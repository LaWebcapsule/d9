import { useFieldsStore } from '@/stores/fields';
import { usePermissionsStore } from '@/stores/permissions';
import { useRelationsStore } from '@/stores/relations';
import { useUserStore } from '@/stores/user';
import { createTestingPinia } from '@pinia/testing';
import { Field, Relation } from '@wbce-d9/types';
import { sha256Digest } from '@wbce-d9/utils';
import { setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { EditConflict, getOnlyIf, resolveEditConflicts, stripMeta, walkEdits, withOnlyIf } from './edit-conflicts';

function field(collection: string, name: string, type = 'string', primary = false): Field {
	return {
		collection,
		field: name,
		name,
		type,
		schema: type === 'alias' ? null : { is_primary_key: primary },
		meta: null,
	} as unknown as Field;
}

function mockSchema() {
	const fieldsStore = useFieldsStore();
	const relationsStore = useRelationsStore();

	fieldsStore.fields = [
		field('articles', 'id', 'integer', true),
		field('articles', 'title'),
		field('articles', 'author', 'uuid'),
		field('articles', 'translations', 'alias'),
		field('articles_translations', 'id', 'integer', true),
		field('articles_translations', 'articles_id', 'integer'),
		field('articles_translations', 'languages_code'),
		field('articles_translations', 'body', 'text'),
		field('languages', 'code', 'string', true),
		field('users', 'id', 'uuid', true),
	];

	relationsStore.relations = [
		{
			collection: 'articles',
			field: 'author',
			related_collection: 'users',
			meta: { one_field: null, junction_field: null },
		},
		{
			collection: 'articles_translations',
			field: 'articles_id',
			related_collection: 'articles',
			meta: { one_field: 'translations', junction_field: 'languages_code' },
		},
		{
			collection: 'articles_translations',
			field: 'languages_code',
			related_collection: 'languages',
			meta: { one_field: null, junction_field: 'articles_id' },
		},
	] as unknown as Relation[];
}

beforeEach(() => {
	setActivePinia(createTestingPinia({ createSpy: vi.fn, stubActions: false }));
	mockSchema();
});

describe('getOnlyIf', () => {
	test('hashes the original values of the given fields', () => {
		expect(getOnlyIf('articles', { id: 1, title: 'Title' }, ['title'])).toEqual({
			title: { _sha256: sha256Digest('Title') },
		});
	});

	test('skips the primary key, alias fields, unknown fields and fields that were not loaded', () => {
		const original = { id: 1, title: 'Title', translations: [1, 2], unknown: 'x' };

		expect(getOnlyIf('articles', original, ['id', 'translations', 'unknown', 'author', '$__meta'])).toEqual({});
	});

	test('uses the foreign key of nested many-to-one values', () => {
		const original = { languages_code: { code: 'en' }, body: 'English' };

		expect(getOnlyIf('articles_translations', original, ['languages_code', 'body'])).toEqual({
			languages_code: { _sha256: sha256Digest('en') },
			body: { _sha256: sha256Digest('English') },
		});
	});

	describe('empty many-to-one values', () => {
		const original = { id: 1, title: null, author: null };

		function setReadPermission(permissions: Record<string, any> | null, admin = false) {
			useUserStore().currentUser = { role: { id: 'editor', admin_access: admin } } as any;

			usePermissionsStore().permissions = permissions
				? ([{ role: 'editor', collection: 'users', action: 'read', permissions, fields: ['*'] }] as any)
				: [];
		}

		test('are hashed when the user can read every related item', () => {
			setReadPermission({});

			expect(getOnlyIf('articles', original, ['title', 'author'])).toEqual({
				title: { _sha256: sha256Digest(null) },
				author: { _sha256: sha256Digest(null) },
			});

			setReadPermission(null, true);

			expect(getOnlyIf('articles', original, ['author'])).toEqual({ author: { _sha256: sha256Digest(null) } });
		});

		test('are skipped when the related item could be hidden from the user', () => {
			setReadPermission({ id: { _eq: '$CURRENT_USER' } });

			expect(getOnlyIf('articles', original, ['title', 'author'])).toEqual({ title: { _sha256: sha256Digest(null) } });

			setReadPermission(null);

			expect(getOnlyIf('articles', original, ['author'])).toEqual({});
		});
	});
});

describe('withOnlyIf', () => {
	const original = { id: 1, title: 'Title', author: 'a1' };

	test('adds the conditions for the edited fields', () => {
		expect(withOnlyIf('articles', original, { id: 1, title: 'Mine' })).toEqual({
			id: 1,
			title: 'Mine',
			$__meta: { onlyIf: { title: { _sha256: sha256Digest('Title') } } },
		});
	});

	test('keeps existing conditions, they belong to the values the user saw first', () => {
		const edits = { title: 'Mine', $__meta: { onlyIf: { title: { _sha256: sha256Digest('First') } } } };

		expect(withOnlyIf('articles', original, edits)).toEqual({
			title: 'Mine',
			$__meta: { onlyIf: { title: { _sha256: sha256Digest('First') } } },
		});
	});

	test('drops conditions of fields that are not edited anymore, and an empty meta key', () => {
		const edits = { id: 1, $__meta: { onlyIf: { title: { _sha256: sha256Digest('First') } } } };

		expect(withOnlyIf('articles', original, edits)).toEqual({ id: 1 });
	});
});

describe('stripMeta', () => {
	test('removes base hashes at every level', () => {
		const edits = {
			title: 'Title',
			$__meta: { onlyIf: { title: 'hash' } },
			translations: {
				create: [],
				update: [{ id: 10, body: 'Body', $__meta: { onlyIf: { body: 'hash' } } }],
				delete: [11],
				$__meta: { deleteOnlyIf: { 11: { body: 'hash' } } },
			},
		};

		expect(stripMeta(edits)).toEqual({
			title: 'Title',
			translations: { create: [], update: [{ id: 10, body: 'Body' }], delete: [11] },
		});
	});
});

describe('walkEdits', () => {
	test('visits nested items and alterations with their collection', () => {
		const items: string[] = [];
		const alterations: string[] = [];

		walkEdits(
			'articles',
			{
				title: 'Title',
				author: { id: 'u1', name: 'Jane' },
				translations: { create: [{ body: 'new' }], update: [{ id: 10, body: 'changed' }], delete: [11] },
			},
			{
				item: (collection, item) => items.push(`${collection}:${item.id ?? 'new'}`),
				alterations: (collection) => alterations.push(collection),
			}
		);

		expect(items).toEqual(['articles:new', 'users:u1', 'articles_translations:new', 'articles_translations:10']);
		expect(alterations).toEqual(['articles_translations']);
	});
});

describe('resolveEditConflicts', () => {
	const changedTitle: EditConflict = {
		collection: 'articles',
		key: 1,
		action: 'update',
		type: 'changed',
		field: 'title',
		current: 'Theirs',
	};

	const changedBody: EditConflict = {
		collection: 'articles_translations',
		key: 10,
		action: 'update',
		type: 'changed',
		field: 'body',
		current: 'Their body',
	};

	const edits = () => ({
		title: 'Mine',
		translations: {
			create: [],
			update: [{ id: 10, body: 'My body', $__meta: { onlyIf: { body: { _sha256: sha256Digest('Body') } } } }],
			delete: [],
		},
	});

	function resolve(conflicts: EditConflict[], choices: ('mine' | 'theirs')[], input = edits()) {
		return resolveEditConflicts({
			collection: 'articles',
			primaryKey: '1',
			edits: input,
			rootOnlyIf: {},
			conflicts,
			choices,
		});
	}

	test('keeping mine checks against the current value on the next save', () => {
		const result = resolve([changedTitle, changedBody], ['mine', 'mine']);

		expect(result.edits.title).toBe('Mine');
		expect(result.rootOnlyIf).toEqual({ title: { _sha256: sha256Digest('Theirs') } });

		expect(result.edits.translations.update[0]).toEqual({
			id: 10,
			body: 'My body',
			$__meta: { onlyIf: { body: { _sha256: sha256Digest('Their body') } } },
		});
	});

	test('keeping theirs puts the current value into the edits', () => {
		const result = resolve([changedTitle, changedBody], ['theirs', 'theirs']);

		expect(result.edits.title).toBe('Theirs');
		expect(result.rootOnlyIf).toEqual({ title: { _sha256: sha256Digest('Theirs') } });
		expect(result.edits.translations.update[0].body).toBe('Their body');
	});

	test('restores a deleted nested item with the local changes, or discards them', () => {
		const deleted: EditConflict = { collection: 'articles_translations', key: 10, action: 'update', type: 'deleted' };

		const mine = resolve([deleted], ['mine']);
		expect(mine.edits.translations.update).toEqual([]);
		expect(mine.edits.translations.create).toEqual([{ body: 'My body' }]);

		const theirs = resolve([deleted], ['theirs']);
		expect(theirs.edits.translations.update).toEqual([]);
		expect(theirs.edits.translations.create).toEqual([]);
	});

	test('deletes a changed nested item anyway, or keeps it', () => {
		const deleteChanged: EditConflict = {
			collection: 'articles_translations',
			key: 11,
			action: 'delete',
			type: 'changed',
			field: 'body',
		};

		const input = () => ({
			translations: {
				create: [],
				update: [],
				delete: [11],
				$__meta: { deleteOnlyIf: { 11: { body: { _sha256: sha256Digest('Old') } } } },
			},
		});

		const mine = resolve([deleteChanged], ['mine'], input() as any);
		expect(mine.edits.translations.delete).toEqual([11]);
		expect(mine.edits.translations.$__meta.deleteOnlyIf).toEqual({});

		const theirs = resolve([deleteChanged], ['theirs'], input() as any);
		expect(theirs.edits.translations.delete).toEqual([]);
		expect(theirs.edits.translations.$__meta.deleteOnlyIf).toEqual({});
	});

	test('does not change the passed edits', () => {
		const input = edits();
		resolve([changedTitle, changedBody], ['theirs', 'theirs'], input);
		expect(input).toEqual(edits());
	});
});
