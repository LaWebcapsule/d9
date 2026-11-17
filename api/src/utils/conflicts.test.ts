import type { SchemaOverview } from '@wbce-d9/types';
import { hashValue } from '@wbce-d9/utils';
import type { Knex } from 'knex';
import knex from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, ForbiddenException, InvalidPayloadException } from '../exceptions/index.js';
import { ItemsService } from '../services/items.js';
import { hashValue as hashValueAsync } from './conflicts.js';

let db: Knex;

vi.mock('../env', async () => {
	const actual = (await vi.importActual('../env')) as { default: Record<string, any> };
	const MOCK_ENV = { ...actual.default, CACHE_AUTO_PURGE: false };
	return { default: MOCK_ENV, getEnv: () => MOCK_ENV };
});

vi.mock('../cache', () => ({
	getCache: vi.fn().mockReturnValue({ cache: null, systemCache: { clear: vi.fn() } }),
}));

vi.mock('../database/index', () => ({
	default: () => db,
	getDatabaseClient: () => 'sqlite',
}));

function field(name: string, type: string, extra: Record<string, any> = {}) {
	return {
		field: name,
		defaultValue: null,
		nullable: true,
		generated: false,
		type,
		dbType: type,
		precision: null,
		scale: null,
		special: [],
		note: null,
		alias: false,
		validation: null,
		...extra,
	};
}

const schema = {
	collections: {
		articles: {
			collection: 'articles',
			primary: 'id',
			singleton: false,
			note: null,
			sortField: null,
			accountability: null,
			fields: {
				id: field('id', 'integer', { nullable: false, defaultValue: 'AUTO_INCREMENT' }),
				title: field('title', 'string'),
				status: field('status', 'string'),
				meta: field('meta', 'json', { special: ['cast-json'] }),
				author: field('author', 'integer'),
				date_updated: field('date_updated', 'timestamp', { special: ['date-updated'] }),
				translations: field('translations', 'alias', { alias: true, special: ['translations'] }),
			},
		},
		authors: {
			collection: 'authors',
			primary: 'id',
			singleton: false,
			note: null,
			sortField: null,
			accountability: null,
			fields: {
				id: field('id', 'integer', { nullable: false, defaultValue: 'AUTO_INCREMENT' }),
				name: field('name', 'string'),
			},
		},
		articles_translations: {
			collection: 'articles_translations',
			primary: 'id',
			singleton: false,
			note: null,
			sortField: null,
			accountability: null,
			fields: {
				id: field('id', 'integer', { nullable: false, defaultValue: 'AUTO_INCREMENT' }),
				articles_id: field('articles_id', 'integer'),
				languages_code: field('languages_code', 'string'),
				body: field('body', 'text'),
			},
		},
	},
	relations: [
		{
			collection: 'articles',
			field: 'author',
			related_collection: 'authors',
			schema: null,
			meta: {
				id: 2,
				many_collection: 'articles',
				many_field: 'author',
				one_collection: 'authors',
				one_field: null,
				one_allowed_collections: null,
				one_collection_field: null,
				one_deselect_action: 'nullify',
				junction_field: null,
				sort_field: null,
			},
		},
		{
			collection: 'articles_translations',
			field: 'articles_id',
			related_collection: 'articles',
			schema: null,
			meta: {
				id: 1,
				many_collection: 'articles_translations',
				many_field: 'articles_id',
				one_collection: 'articles',
				one_field: 'translations',
				one_allowed_collections: null,
				one_collection_field: null,
				one_deselect_action: 'delete',
				junction_field: null,
				sort_field: null,
			},
		},
	],
} as unknown as SchemaOverview;

const admin = { role: null, admin: true, user: 'ccd3fbd7-8dc0-4b0c-8a46-c8e3a63fdb08' };

function service(collection = 'articles') {
	return new ItemsService(collection, { knex: db, schema, accountability: admin });
}

function permission(collection: string, action: string, fields = ['*'], permissions: Record<string, any> = {}) {
	return { id: 1, role: 'editor', collection, action, permissions, validation: {}, presets: {}, fields };
}

function editorService(permissions: ReturnType<typeof permission>[], collection = 'articles') {
	return new ItemsService(collection, {
		knex: db,
		schema,
		accountability: { role: 'editor', admin: false, user: admin.user, permissions } as any,
	});
}

async function conflictOf(promise: Promise<unknown>): Promise<ConflictException> {
	const error = await promise.then(
		() => undefined,
		(err: ConflictException) => err
	);

	expect(error).toBeInstanceOf(ConflictException);
	return error!;
}

beforeAll(async () => {
	db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });

	await db.schema.createTable('articles', (table) => {
		table.increments('id');
		table.string('title');
		table.string('status');
		table.text('meta');
		table.timestamp('date_updated');
		table.integer('author');
	});

	await db.schema.createTable('authors', (table) => {
		table.increments('id');
		table.string('name');
	});

	await db.schema.createTable('articles_translations', (table) => {
		table.increments('id');
		table.integer('articles_id');
		table.string('languages_code');
		table.text('body');
	});
});

afterAll(async () => {
	await db.destroy();
});

beforeEach(async () => {
	await db('articles').delete();
	await db('authors').delete();
	await db('articles_translations').delete();

	await db('authors').insert({ id: 5, name: 'Jane' });

	await db('articles').insert({
		id: 1,
		title: 'Title',
		status: 'draft',
		meta: JSON.stringify({ b: 1, a: 2 }),
		author: 5,
	});

	await db('articles_translations').insert([
		{ id: 10, articles_id: 1, languages_code: 'en', body: 'English' },
		{ id: 11, articles_id: 1, languages_code: 'de', body: 'Deutsch' },
	]);
});

describe('edit conflicts', () => {
	it('keeps last-write-wins behaviour without conditions', async () => {
		await db('articles').where({ id: 1 }).update({ title: 'Changed by someone else' });

		await service().updateOne(1, { title: 'Mine' }, { emitEvents: false });

		expect((await db('articles').first()).title).toBe('Mine');
	});

	it('saves when the current values meet the conditions', async () => {
		await service().updateOne(
			1,
			{
				title: 'Mine',
				meta: { a: 3 },
				$__meta: { onlyIf: { title: { _hash: hashValue('Title') }, meta: { _hash: hashValue({ a: 2, b: 1 }) } } },
			},
			{ emitEvents: false }
		);

		const row = await db('articles').first();
		expect(row.title).toBe('Mine');
		expect(JSON.parse(row.meta)).toEqual({ a: 3 });
	});

	it('rejects the whole save when a field was changed in the meantime', async () => {
		await db('articles').where({ id: 1 }).update({ title: 'Changed by someone else' });

		const error = await conflictOf(
			service().updateOne(
				1,
				{
					title: 'Mine',
					status: 'published',
					$__meta: { onlyIf: { title: { _hash: hashValue('Title') }, status: { _hash: hashValue('draft') } } },
				},
				{ emitEvents: false }
			)
		);

		expect(error.status).toBe(409);
		expect(error.code).toBe('CONFLICT');

		expect(error.extensions['conflicts']).toEqual([
			{
				collection: 'articles',
				key: 1,
				action: 'update',
				type: 'changed',
				field: 'title',
				current: 'Changed by someone else',
			},
		]);

		const row = await db('articles').first();
		expect(row.title).toBe('Changed by someone else');
		expect(row.status).toBe('draft');
	});

	it('ignores system fields, unknown fields and fields without a condition', async () => {
		await db('articles').where({ id: 1 }).update({ date_updated: '2026-11-13 10:00:00', status: 'archived' });

		await service().updateOne(
			1,
			{
				title: 'Mine',
				status: 'published',
				$__meta: {
					onlyIf: {
						title: { _hash: hashValue('Title') },
						date_updated: { _hash: hashValue(null) },
						unknown: { _hash: 'x' },
					},
				},
			},
			{ emitEvents: false }
		);

		expect((await db('articles').first()).title).toBe('Mine');
	});

	it.each([
		['a value instead of a condition', { title: 'Title' }],
		['an empty value', { title: null }],
		['another operator', { title: { _eq: 'Title' } }],
		['more than one operator', { title: { _hash: 'x', _eq: 'Title' } }],
		['a hash that is not a string', { title: { _hash: 1 } }],
	])('rejects %s in the conditions', async (_title, onlyIf) => {
		await expect(service().updateOne(1, { title: 'Mine', $__meta: { onlyIf } }, { emitEvents: false })).rejects.toThrow(
			InvalidPayloadException
		);

		expect((await db('articles').first()).title).toBe('Title');
	});

	it('hashes values like the clients do', async () => {
		const values = [null, undefined, '', 'Straße', 7, 1.5, true, ['b', 'a'], { b: 1, a: { d: [1, 2], c: null } }];

		for (const value of values) {
			expect(await hashValueAsync(value)).toBe(hashValue(value));
		}

		expect(await hashValueAsync(new Date('2026-11-13T10:00:00.000Z'))).toBe(hashValue('2026-11-13T10:00:00.000Z'));
	});

	it('only conflicts on the translation that was changed', async () => {
		await db('articles_translations').where({ id: 11 }).update({ body: 'Deutsch (geändert)' });

		await service().updateOne(
			1,
			{
				translations: {
					create: [],
					update: [{ id: 10, body: 'English (mine)', $__meta: { onlyIf: { body: { _hash: hashValue('English') } } } }],
					delete: [],
				},
			},
			{ emitEvents: false }
		);

		expect((await db('articles_translations').where({ id: 10 }).first()).body).toBe('English (mine)');
	});

	it('collects conflicts of all levels and rolls back everything', async () => {
		await db('articles').where({ id: 1 }).update({ title: 'Changed by someone else' });
		await db('articles_translations').where({ id: 11 }).update({ body: 'Deutsch (geändert)' });

		const error = await conflictOf(
			service().updateOne(
				1,
				{
					title: 'Mine',
					$__meta: { onlyIf: { title: { _hash: hashValue('Title') } } },
					translations: {
						create: [{ languages_code: 'fr', body: 'Français' }],
						update: [
							{ id: 10, body: 'English (mine)', $__meta: { onlyIf: { body: { _hash: hashValue('English') } } } },
							{ id: 11, body: 'Deutsch (mine)', $__meta: { onlyIf: { body: { _hash: hashValue('Deutsch') } } } },
						],
						delete: [],
					},
				},
				{ emitEvents: false }
			)
		);

		expect(error.extensions['conflicts']).toMatchObject([
			{ collection: 'articles', key: 1, field: 'title', type: 'changed' },
			{ collection: 'articles_translations', key: 11, field: 'body', type: 'changed', current: 'Deutsch (geändert)' },
		]);

		expect((await db('articles').first()).title).toBe('Changed by someone else');
		expect((await db('articles_translations').where({ id: 10 }).first()).body).toBe('English');
		expect(await db('articles_translations').where({ languages_code: 'fr' })).toHaveLength(0);
	});

	it('reports a conflict when an edited translation was deleted in the meantime', async () => {
		await db('articles_translations').where({ id: 10 }).delete();

		const error = await conflictOf(
			service().updateOne(
				1,
				{
					translations: {
						create: [],
						update: [
							{ id: 10, body: 'English (mine)', $__meta: { onlyIf: { body: { _hash: hashValue('English') } } } },
						],
						delete: [],
					},
				},
				{ emitEvents: false }
			)
		);

		expect(error.extensions['conflicts']).toMatchObject([
			{ collection: 'articles_translations', key: 10, action: 'update', type: 'deleted' },
		]);

		expect(await db('articles_translations').where({ id: 10 })).toHaveLength(0);
	});

	describe('deleteOnlyIf', () => {
		const deleteEnglish = {
			translations: {
				create: [],
				update: [],
				delete: [10],
				$__meta: {
					deleteOnlyIf: { 10: { body: { _hash: hashValue('English') }, languages_code: { _hash: hashValue('en') } } },
				},
			},
		};

		it('deletes a row that is unchanged', async () => {
			await service().updateOne(1, deleteEnglish, { emitEvents: false });

			expect(await db('articles_translations').where({ id: 10 })).toHaveLength(0);
		});

		it('rejects deleting a row that was changed in the meantime', async () => {
			await db('articles_translations').where({ id: 10 }).update({ body: 'English (changed)' });

			const error = await conflictOf(service().updateOne(1, deleteEnglish, { emitEvents: false }));

			expect(error.extensions['conflicts']).toMatchObject([
				{ collection: 'articles_translations', key: 10, action: 'delete', type: 'changed', field: 'body' },
			]);

			expect(await db('articles_translations').where({ id: 10 })).toHaveLength(1);
		});

		it('accepts deleting a row that is already gone', async () => {
			await db('articles_translations').where({ id: 10 }).delete();

			await service().updateOne(1, deleteEnglish, { emitEvents: false });

			expect(await db('articles_translations')).toHaveLength(1);
		});
	});

	it('collects the conflicts of all items in a batch update', async () => {
		await db('articles').insert({ id: 2, title: 'Second', status: 'draft' });
		await db('articles').update({ status: 'archived' });

		const error = await conflictOf(
			service().updateBatch(
				[
					{ id: 1, status: 'published', $__meta: { onlyIf: { status: { _hash: hashValue('draft') } } } },
					{ id: 2, status: 'published', $__meta: { onlyIf: { status: { _hash: hashValue('draft') } } } },
				],
				{ emitEvents: false }
			)
		);

		expect(error.extensions['conflicts']).toMatchObject([
			{ key: 1, field: 'status' },
			{ key: 2, field: 'status' },
		]);

		expect(await db('articles').where({ status: 'published' })).toHaveLength(0);
	});

	it('reports a conflict when the item itself was deleted in the meantime', async () => {
		await db('articles').where({ id: 1 }).delete();

		const error = await conflictOf(
			service().updateOne(
				1,
				{ title: 'Mine', $__meta: { onlyIf: { title: { _hash: hashValue('Title') } } } },
				{ emitEvents: false }
			)
		);

		expect(error.extensions['conflicts']).toMatchObject([{ collection: 'articles', key: 1, type: 'deleted' }]);
	});

	it('ignores conditions when creating an item', async () => {
		await service().createOne(
			{ id: 2, title: 'New', $__meta: { onlyIf: { title: { _hash: hashValue('Other') } } } },
			{ emitEvents: false }
		);

		expect((await db('articles').where({ id: 2 }).first()).title).toBe('New');
	});

	it('checks nested many-to-one items', async () => {
		await db('authors').where({ id: 5 }).update({ name: 'Jane (changed)' });

		const error = await conflictOf(
			service().updateOne(
				1,
				{
					title: 'Mine',
					author: { id: 5, name: 'Jane Doe', $__meta: { onlyIf: { name: { _hash: hashValue('Jane') } } } },
				},
				{ emitEvents: false }
			)
		);

		expect(error.extensions['conflicts']).toMatchObject([
			{ collection: 'authors', key: 5, field: 'name', current: 'Jane (changed)' },
		]);

		expect((await db('articles').first()).title).toBe('Title');
	});

	it('rejects unknown keys in the reserved meta key', async () => {
		await expect(
			service().updateOne(1, { title: 'Mine', $__meta: { deleteOnlyIf: {} } }, { emitEvents: false })
		).rejects.toThrow(InvalidPayloadException);

		await expect(
			service().updateOne(
				1,
				{ translations: { create: [], update: [], delete: [10], $__meta: { onlyIf: {} } } },
				{ emitEvents: false }
			)
		).rejects.toThrow(InvalidPayloadException);
	});

	describe('permissions', () => {
		it('does not compare fields the user is not allowed to read', async () => {
			await db('articles').where({ id: 1 }).update({ title: 'Changed by someone else', status: 'archived' });

			const editor = editorService([
				permission('articles', 'read', ['id', 'status']),
				permission('articles', 'update'),
			]);

			const error = await conflictOf(
				editor.updateOne(
					1,
					{
						title: 'Mine',
						$__meta: { onlyIf: { title: { _hash: hashValue('Title') }, status: { _hash: hashValue('draft') } } },
					},
					{ emitEvents: false }
				)
			);

			// A conflict on the title would tell that the guessed value is wrong
			expect(error.extensions['conflicts']).toMatchObject([{ field: 'status', current: 'archived' }]);
			expect(error.extensions['conflicts']).toHaveLength(1);
		});

		it('does not compare items the user is not allowed to read', async () => {
			await db('articles_translations').where({ id: 10 }).update({ body: 'English (changed)' });

			const editor = editorService([
				permission('articles', 'read'),
				permission('articles', 'update'),
				permission('articles_translations', 'read', ['*'], { languages_code: { _eq: 'de' } }),
				permission('articles_translations', 'delete'),
			]);

			await editor.updateOne(
				1,
				{
					translations: {
						create: [],
						update: [],
						delete: [10],
						$__meta: { deleteOnlyIf: { 10: { body: { _hash: hashValue('guess') } } } },
					},
				},
				{ emitEvents: false }
			);

			// A conflict would tell that the guessed value is wrong
			expect(await db('articles_translations').where({ id: 10 })).toHaveLength(0);
		});

		it('reports a deleted item to users who can update every item of the collection', async () => {
			await db('articles').where({ id: 1 }).delete();

			const editor = editorService([permission('articles', 'read'), permission('articles', 'update')]);

			const error = await conflictOf(
				editor.updateOne(
					1,
					{ title: 'Mine', $__meta: { onlyIf: { title: { _hash: hashValue('Title') } } } },
					{ emitEvents: false }
				)
			);

			expect(error.extensions['conflicts']).toMatchObject([{ collection: 'articles', key: 1, type: 'deleted' }]);
		});

		it.each([
			['a filtered update permission', [permission('articles', 'update', ['*'], { status: { _eq: 'draft' } })]],
			['no update permission', [permission('articles', 'read')]],
		])('does not tell users with %s whether an item exists', async (_title, permissions) => {
			await db('articles').where({ id: 1 }).update({ status: 'published' });

			const update = (key: number) =>
				editorService(permissions).updateOne(key, { title: 'Mine', $__meta: { onlyIf: {} } }, { emitEvents: false });

			// Exists, but isn't theirs to update
			await expect(update(1)).rejects.toThrow(ForbiddenException);
			// Doesn't exist
			await expect(update(999)).rejects.toThrow(ForbiddenException);
		});

		it('does not tell whether a nested item exists without access to all items of its collection', async () => {
			await db('articles_translations').where({ id: 10 }).delete();

			const editor = editorService([
				permission('articles', 'read'),
				permission('articles', 'update'),
				permission('articles_translations', 'read'),
				permission('articles_translations', 'update', ['*'], { languages_code: { _eq: 'en' } }),
			]);

			await expect(
				editor.updateOne(
					1,
					{
						translations: {
							create: [],
							update: [
								{ id: 10, body: 'English (mine)', $__meta: { onlyIf: { body: { _hash: hashValue('English') } } } },
							],
							delete: [],
						},
					},
					{ emitEvents: false }
				)
			).rejects.toThrow(ForbiddenException);
		});
	});
});
