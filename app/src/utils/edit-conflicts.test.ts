import { useFieldsStore } from '@/stores/fields';
import { useRelationsStore } from '@/stores/relations';
import { createTestingPinia } from '@pinia/testing';
import { Field, Relation } from '@wbce-d9/types';
import { hashValue } from '@wbce-d9/utils';
import { setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { EditConflict, getBaseHashes, resolveEditConflicts, stripBases, walkEdits } from './edit-conflicts';

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

describe('getBaseHashes', () => {
	test('hashes the original values of the given fields', () => {
		expect(getBaseHashes('articles', { id: 1, title: 'Title' }, ['title'])).toEqual({ title: hashValue('Title') });
	});

	test('skips the primary key, alias fields, unknown fields and fields that were not loaded', () => {
		const original = { id: 1, title: 'Title', translations: [1, 2], unknown: 'x' };

		expect(getBaseHashes('articles', original, ['id', 'translations', 'unknown', 'author', '$base'])).toEqual({});
	});

	test('uses the foreign key of nested many-to-one values', () => {
		const original = { languages_code: { code: 'en' }, body: 'English' };

		expect(getBaseHashes('articles_translations', original, ['languages_code', 'body'])).toEqual({
			languages_code: hashValue('en'),
			body: hashValue('English'),
		});
	});
});

describe('stripBases', () => {
	test('removes base hashes at every level', () => {
		const edits = {
			title: 'Title',
			$base: { title: 'hash' },
			translations: {
				create: [],
				update: [{ id: 10, body: 'Body', $base: { body: 'hash' } }],
				delete: [11],
				$deleteBase: { 11: { body: 'hash' } },
			},
		};

		expect(stripBases(edits)).toEqual({
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
			update: [{ id: 10, body: 'My body', $base: { body: hashValue('Body') } }],
			delete: [],
		},
	});

	function resolve(conflicts: EditConflict[], choices: ('mine' | 'theirs')[], input = edits()) {
		return resolveEditConflicts({
			collection: 'articles',
			primaryKey: '1',
			edits: input,
			rootBase: {},
			conflicts,
			choices,
		});
	}

	test('keeping mine checks against the current value on the next save', () => {
		const result = resolve([changedTitle, changedBody], ['mine', 'mine']);

		expect(result.edits.title).toBe('Mine');
		expect(result.rootBase).toEqual({ title: hashValue('Theirs') });

		expect(result.edits.translations.update[0]).toEqual({
			id: 10,
			body: 'My body',
			$base: { body: hashValue('Their body') },
		});
	});

	test('keeping theirs puts the current value into the edits', () => {
		const result = resolve([changedTitle, changedBody], ['theirs', 'theirs']);

		expect(result.edits.title).toBe('Theirs');
		expect(result.rootBase).toEqual({ title: hashValue('Theirs') });
		expect(result.edits.translations.update[0].body).toBe('Their body');
	});

	test('without read access, mine overwrites and theirs drops the change', () => {
		const { current: _title, ...hiddenTitle } = changedTitle;
		const { current: _body, ...hiddenBody } = changedBody;

		const mine = resolve([hiddenTitle, hiddenBody], ['mine', 'mine']);
		expect(mine.rootBase).toEqual({ title: null });
		expect(mine.edits.translations.update[0].$base).toEqual({ body: null });

		const theirs = resolve([hiddenTitle, hiddenBody], ['theirs', 'theirs']);
		expect(theirs.edits).not.toHaveProperty('title');
		expect(theirs.edits.translations.update[0]).not.toHaveProperty('body');
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
			translations: { create: [], update: [], delete: [11], $deleteBase: { 11: { body: hashValue('Old') } } },
		});

		const mine = resolve([deleteChanged], ['mine'], input() as any);
		expect(mine.edits.translations.delete).toEqual([11]);
		expect(mine.edits.translations.$deleteBase).toEqual({});

		const theirs = resolve([deleteChanged], ['theirs'], input() as any);
		expect(theirs.edits.translations.delete).toEqual([]);
		expect(theirs.edits.translations.$deleteBase).toEqual({});
	});

	test('does not change the passed edits', () => {
		const input = edits();
		resolve([changedTitle, changedBody], ['theirs', 'theirs'], input);
		expect(input).toEqual(edits());
	});
});
