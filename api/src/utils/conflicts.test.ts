import type { SchemaOverview } from '@wbce-d9/types';
import { hashValue } from '@wbce-d9/utils';
import type { Knex } from 'knex';
import knex from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, ForbiddenException, InvalidPayloadException } from '../exceptions/index.js';
import { ItemsService } from '../services/items.js';

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
				user_updated: field('user_updated', 'uuid', { special: ['user-updated'] }),
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
		directus_activity: {
			collection: 'directus_activity',
			primary: 'id',
			singleton: false,
			note: null,
			sortField: null,
			accountability: null,
			fields: {
				id: field('id', 'integer', { nullable: false, defaultValue: 'AUTO_INCREMENT' }),
				action: field('action', 'string'),
				user: field('user', 'uuid'),
				timestamp: field('timestamp', 'timestamp'),
				collection: field('collection', 'string'),
				item: field('item', 'string'),
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

const otherUser = '3e0ba0f1-6a52-4d1b-8a63-1f0e3e6b1d8b';

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

async function addActivity(collection: string, item: string, user = otherUser) {
	await db('directus_activity').insert({
		action: 'update',
		user,
		timestamp: '2026-11-13T10:00:00.000Z',
		collection,
		item,
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
		table.uuid('user_updated');
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

	await db.schema.createTable('directus_activity', (table) => {
		table.increments('id');
		table.string('action');
		table.uuid('user');
		table.timestamp('timestamp');
		table.string('collection');
		table.string('item');
	});
});

afterAll(async () => {
	await db.destroy();
});

beforeEach(async () => {
	await db('articles').delete();
	await db('authors').delete();
	await db('articles_translations').delete();
	await db('directus_activity').delete();

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
	it('keeps last-write-wins behaviour without a base', async () => {
		await db('articles').where({ id: 1 }).update({ title: 'Changed by someone else' });

		await service().updateOne(1, { title: 'Mine' }, { emitEvents: false });

		expect((await db('articles').first()).title).toBe('Mine');
	});

	it('saves when the base matches the current values', async () => {
		await service().updateOne(
			1,
			{
				title: 'Mine',
				meta: { a: 3 },
				$__meta: { base: { title: hashValue('Title'), meta: hashValue({ a: 2, b: 1 }) } },
			},
			{ emitEvents: false }
		);

		const row = await db('articles').first();
		expect(row.title).toBe('Mine');
		expect(JSON.parse(row.meta)).toEqual({ a: 3 });
	});

	it('rejects the whole save when a field was changed in the meantime', async () => {
		await db('articles').where({ id: 1 }).update({ title: 'Changed by someone else' });

		await addActivity('articles', '1');

		const error = await conflictOf(
			service().updateOne(
				1,
				{
					title: 'Mine',
					status: 'published',
					$__meta: { base: { title: hashValue('Title'), status: hashValue('draft') } },
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
				user: otherUser,
				timestamp: '2026-11-13T10:00:00.000Z',
			},
		]);

		const row = await db('articles').first();
		expect(row.title).toBe('Changed by someone else');
		expect(row.status).toBe('draft');
	});

	it('ignores system fields, unknown fields and fields without a base hash', async () => {
		await db('articles').where({ id: 1 }).update({ date_updated: '2026-11-13 10:00:00', status: 'archived' });

		await service().updateOne(
			1,
			{
				title: 'Mine',
				status: 'published',
				$__meta: { base: { title: hashValue('Title'), status: null, date_updated: hashValue(null), unknown: 'x' } },
			},
			{ emitEvents: false }
		);

		expect((await db('articles').first()).title).toBe('Mine');
	});

	it('rejects an invalid base', async () => {
		await expect(
			service().updateOne(1, { title: 'Mine', $__meta: { base: { title: 1 } } }, { emitEvents: false })
		).rejects.toThrow(InvalidPayloadException);
	});

	it('only conflicts on the translation that was changed', async () => {
		await db('articles_translations').where({ id: 11 }).update({ body: 'Deutsch (geändert)' });

		await service().updateOne(
			1,
			{
				translations: {
					create: [],
					update: [{ id: 10, body: 'English (mine)', $__meta: { base: { body: hashValue('English') } } }],
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
					$__meta: { base: { title: hashValue('Title') } },
					translations: {
						create: [{ languages_code: 'fr', body: 'Français' }],
						update: [
							{ id: 10, body: 'English (mine)', $__meta: { base: { body: hashValue('English') } } },
							{ id: 11, body: 'Deutsch (mine)', $__meta: { base: { body: hashValue('Deutsch') } } },
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
						update: [{ id: 10, body: 'English (mine)', $__meta: { base: { body: hashValue('English') } } }],
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

	describe('deleteBase', () => {
		const deleteEnglish = {
			translations: {
				create: [],
				update: [],
				delete: [10],
				$__meta: { deleteBase: { 10: { body: hashValue('English'), languages_code: hashValue('en') } } },
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
					{ id: 1, status: 'published', $__meta: { base: { status: hashValue('draft') } } },
					{ id: 2, status: 'published', $__meta: { base: { status: hashValue('draft') } } },
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
			service().updateOne(1, { title: 'Mine', $__meta: { base: { title: hashValue('Title') } } }, { emitEvents: false })
		);

		expect(error.extensions['conflicts']).toMatchObject([{ collection: 'articles', key: 1, type: 'deleted' }]);
	});

	it('ignores a base when creating an item', async () => {
		await service().createOne(
			{ id: 2, title: 'New', $__meta: { base: { title: hashValue('Other') } } },
			{ emitEvents: false }
		);

		expect((await db('articles').where({ id: 2 }).first()).title).toBe('New');
	});

	it('checks nested many-to-one items', async () => {
		await db('authors').where({ id: 5 }).update({ name: 'Jane (changed)' });

		const error = await conflictOf(
			service().updateOne(
				1,
				{ title: 'Mine', author: { id: 5, name: 'Jane Doe', $__meta: { base: { name: hashValue('Jane') } } } },
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
			service().updateOne(1, { title: 'Mine', $__meta: { deleteBase: {} } }, { emitEvents: false })
		).rejects.toThrow(InvalidPayloadException);

		await expect(
			service().updateOne(
				1,
				{ translations: { create: [], update: [], delete: [10], $__meta: { base: {} } } },
				{ emitEvents: false }
			)
		).rejects.toThrow(InvalidPayloadException);
	});

	describe('last change', () => {
		const mine = { title: 'Mine', $__meta: { base: { title: hashValue('Title') } } };

		it('prefers the user-updated and date-updated fields of the item over the activity', async () => {
			await db('articles').where({ id: 1 }).update({
				title: 'Changed by someone else',
				user_updated: otherUser,
				date_updated: '2026-11-14T08:30:00.000Z',
			});

			await addActivity('articles', '1', admin.user);

			const error = await conflictOf(service().updateOne(1, mine, { emitEvents: false }));

			expect(error.extensions['conflicts']).toMatchObject([
				{ field: 'title', user: otherUser, timestamp: '2026-11-14T08:30:00.000Z' },
			]);
		});

		it('omits them when the user can read neither these fields nor the activity', async () => {
			await db('articles').where({ id: 1 }).update({
				title: 'Changed by someone else',
				user_updated: otherUser,
				date_updated: '2026-11-14T08:30:00.000Z',
			});

			await addActivity('articles', '1');

			const editor = editorService([permission('articles', 'read', ['id', 'title']), permission('articles', 'update')]);
			const error = await conflictOf(editor.updateOne(1, mine, { emitEvents: false }));
			const [conflict] = error.extensions['conflicts'];

			expect(conflict).toMatchObject({ field: 'title', current: 'Changed by someone else' });
			expect(conflict).not.toHaveProperty('user');
			expect(conflict).not.toHaveProperty('timestamp');
		});

		it('only uses an activity the user is allowed to read', async () => {
			await db('articles').where({ id: 1 }).update({ title: 'Changed by someone else' });
			await addActivity('articles', '1', admin.user);
			await addActivity('articles', '1', otherUser);

			const articles = [permission('articles', 'read', ['id', 'title']), permission('articles', 'update')];

			// The latest activity is not their own, the one before must not be reported instead
			const ownActivity = permission('directus_activity', 'read', ['*'], { user: { _eq: admin.user } });

			const restricted = await conflictOf(
				editorService([...articles, ownActivity]).updateOne(1, mine, { emitEvents: false })
			);

			expect(restricted.extensions['conflicts'][0]).not.toHaveProperty('user');

			const allActivity = permission('directus_activity', 'read');

			const allowed = await conflictOf(
				editorService([...articles, allActivity]).updateOne(1, mine, { emitEvents: false })
			);

			expect(allowed.extensions['conflicts']).toMatchObject([
				{ field: 'title', user: otherUser, timestamp: '2026-11-13T10:00:00.000Z' },
			]);
		});
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
					{ title: 'Mine', $__meta: { base: { title: hashValue('Title'), status: hashValue('draft') } } },
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
						$__meta: { deleteBase: { 10: { body: hashValue('guess') } } },
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
				editor.updateOne(1, { title: 'Mine', $__meta: { base: { title: hashValue('Title') } } }, { emitEvents: false })
			);

			expect(error.extensions['conflicts']).toMatchObject([{ collection: 'articles', key: 1, type: 'deleted' }]);
		});

		it.each([
			['a filtered update permission', [permission('articles', 'update', ['*'], { status: { _eq: 'draft' } })]],
			['no update permission', [permission('articles', 'read')]],
		])('does not tell users with %s whether an item exists', async (_title, permissions) => {
			await db('articles').where({ id: 1 }).update({ status: 'published' });

			const update = (key: number) =>
				editorService(permissions).updateOne(key, { title: 'Mine', $__meta: { base: {} } }, { emitEvents: false });

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
							update: [{ id: 10, body: 'English (mine)', $__meta: { base: { body: hashValue('English') } } }],
							delete: [],
						},
					},
					{ emitEvents: false }
				)
			).rejects.toThrow(ForbiddenException);
		});
	});
});
