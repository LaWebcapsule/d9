import type { SchemaOverview } from '@wbce-d9/types';
import { sha256Digest } from '@wbce-d9/utils';
import type { Knex } from 'knex';
import knex from 'knex';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import emitter from '../emitter.js';
import { ConflictException, ForbiddenException, InvalidPayloadException } from '../exceptions/index.js';
import { ItemsService } from '../services/items.js';
import { sha256DigestAsync } from './conflicts.js';

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
				secret: field('secret', 'string', { special: ['conceal'] }),
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
const otherUser = '4b3c2d1e-0f9a-4b8c-8d7e-6f5a4b3c2d1e';

/**
 * Delete an item like the API does, with the activity of the deletion
 */
async function deleteWithActivity(collection: string, key: number, user = otherUser) {
	await db(collection).where({ id: key }).delete();
	await db('directus_activity').insert({ action: 'delete', user, collection, item: String(key) });
}

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
		table.string('secret');
		table.integer('author');
	});

	await db.schema.createTable('directus_activity', (table) => {
		table.increments('id');
		table.string('action');
		table.uuid('user');
		table.string('collection');
		table.string('item');
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
				$__meta: {
					onlyIf: { title: { _sha256: sha256Digest('Title') }, meta: { _sha256: sha256Digest({ a: 2, b: 1 }) } },
				},
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
					$__meta: {
						onlyIf: { title: { _sha256: sha256Digest('Title') }, status: { _sha256: sha256Digest('draft') } },
					},
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

	it('ignores unknown fields, concealed fields and fields without a condition', async () => {
		await db('articles').where({ id: 1 }).update({ secret: 'changed', status: 'archived' });

		await service().updateOne(
			1,
			{
				title: 'Mine',
				status: 'published',
				$__meta: {
					onlyIf: {
						title: { _sha256: sha256Digest('Title') },
						secret: { _sha256: sha256Digest(null) },
						unknown: { _sha256: sha256Digest('x') },
					},
				},
			},
			{ emitEvents: false }
		);

		expect((await db('articles').first()).title).toBe('Mine');
	});

	it('checks system fields, like the date of the last update', async () => {
		await db('articles').where({ id: 1 }).update({ date_updated: '2026-11-13 10:00:00' });

		const error = await conflictOf(
			service().updateOne(
				1,
				{ title: 'Mine', $__meta: { onlyIf: { date_updated: { _eq: null } } } },
				{ emitEvents: false }
			)
		);

		expect(error.extensions['conflicts']).toMatchObject([{ field: 'date_updated', type: 'changed' }]);
		expect((await db('articles').first()).title).toBe('Title');
	});

	it('compares plain values with _eq', async () => {
		await service().updateOne(
			1,
			{
				title: 'Mine',
				$__meta: { onlyIf: { title: { _eq: 'Title' }, meta: { _eq: { a: 2, b: 1 } }, author: { _eq: 5 } } },
			},
			{ emitEvents: false }
		);

		expect((await db('articles').first()).title).toBe('Mine');

		const error = await conflictOf(
			service().updateOne(
				1,
				{ status: 'published', $__meta: { onlyIf: { title: { _eq: 'Title' }, meta: { _eq: { a: 2 } } } } },
				{ emitEvents: false }
			)
		);

		expect(error.extensions['conflicts']).toMatchObject([
			{ field: 'title', current: 'Mine' },
			{ field: 'meta', current: { a: 2, b: 1 } },
		]);
	});

	it('compares plain values exactly, whatever their type', async () => {
		await db('articles')
			.where({ id: 1 })
			.update({ meta: JSON.stringify(['b', 'a']) });

		const update = (onlyIf: Record<string, unknown>) =>
			service().updateOne(1, { status: 'published', $__meta: { onlyIf } }, { emitEvents: false });

		await update({ meta: { _eq: ['b', 'a'] }, author: { _eq: 5 } });

		expect((await conflictOf(update({ meta: { _eq: ['a', 'b'] } }))).extensions['conflicts']).toMatchObject([
			{ field: 'meta', current: ['b', 'a'] },
		]);

		expect((await conflictOf(update({ author: { _eq: '5' } }))).extensions['conflicts']).toMatchObject([
			{ field: 'author', current: 5 },
		]);
	});

	it.each([
		['a value instead of a condition', { title: 'Title' }],
		['an empty value', { title: null }],
		['another operator', { title: { _neq: 'Title' } }],
		['more than one operator', { title: { _sha256: sha256Digest('Title'), _eq: 'Title' } }],
		['a digest that is not a string', { title: { _sha256: 1 } }],
		['a digest that is not a SHA-256 hex digest', { title: { _sha256: 'Title' } }],
	])('rejects %s in the conditions', async (_title, onlyIf) => {
		await expect(service().updateOne(1, { title: 'Mine', $__meta: { onlyIf } }, { emitEvents: false })).rejects.toThrow(
			InvalidPayloadException
		);

		expect((await db('articles').first()).title).toBe('Title');
	});

	it('digests values like the clients do', async () => {
		const values = [null, undefined, '', 'Straße', 7, 1.5, true, ['b', 'a'], { b: 1, a: { d: [1, 2], c: null } }];

		for (const value of values) {
			expect(await sha256DigestAsync(value)).toBe(sha256Digest(value));
		}

		expect(await sha256DigestAsync(new Date('2026-11-13T10:00:00.000Z'))).toBe(
			sha256Digest('2026-11-13T10:00:00.000Z')
		);
	});

	it('only conflicts on the translation that was changed', async () => {
		await db('articles_translations').where({ id: 11 }).update({ body: 'Deutsch (geändert)' });

		await service().updateOne(
			1,
			{
				translations: {
					create: [],
					update: [
						{ id: 10, body: 'English (mine)', $__meta: { onlyIf: { body: { _sha256: sha256Digest('English') } } } },
					],
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
					$__meta: { onlyIf: { title: { _sha256: sha256Digest('Title') } } },
					translations: {
						create: [{ languages_code: 'fr', body: 'Français' }],
						update: [
							{ id: 10, body: 'English (mine)', $__meta: { onlyIf: { body: { _sha256: sha256Digest('English') } } } },
							{ id: 11, body: 'Deutsch (mine)', $__meta: { onlyIf: { body: { _sha256: sha256Digest('Deutsch') } } } },
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
		await deleteWithActivity('articles_translations', 10);

		const error = await conflictOf(
			service().updateOne(
				1,
				{
					translations: {
						create: [],
						update: [
							{ id: 10, body: 'English (mine)', $__meta: { onlyIf: { body: { _sha256: sha256Digest('English') } } } },
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
					deleteOnlyIf: {
						10: { body: { _sha256: sha256Digest('English') }, languages_code: { _sha256: sha256Digest('en') } },
					},
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
					{ id: 1, status: 'published', $__meta: { onlyIf: { status: { _sha256: sha256Digest('draft') } } } },
					{ id: 2, status: 'published', $__meta: { onlyIf: { status: { _sha256: sha256Digest('draft') } } } },
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
		await deleteWithActivity('articles', 1);

		const error = await conflictOf(
			service().updateOne(
				1,
				{ title: 'Mine', $__meta: { onlyIf: { title: { _sha256: sha256Digest('Title') } } } },
				{ emitEvents: false }
			)
		);

		expect(error.extensions['conflicts']).toMatchObject([{ collection: 'articles', key: 1, type: 'deleted' }]);
	});

	it('does not report items that never existed as deleted', async () => {
		await service().updateOne(
			999,
			{ title: 'Mine', $__meta: { onlyIf: { title: { _sha256: sha256Digest('Title') } } } },
			{ emitEvents: false }
		);

		expect(await db('articles').where({ id: 999 })).toHaveLength(0);
	});

	it('ignores conditions when creating an item', async () => {
		await service().createOne(
			{ id: 2, title: 'New', $__meta: { onlyIf: { title: { _sha256: sha256Digest('Other') } } } },
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
					author: { id: 5, name: 'Jane Doe', $__meta: { onlyIf: { name: { _sha256: sha256Digest('Jane') } } } },
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
						$__meta: {
							onlyIf: { title: { _sha256: sha256Digest('Title') }, status: { _sha256: sha256Digest('draft') } },
						},
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
						$__meta: { deleteOnlyIf: { 10: { body: { _sha256: sha256Digest('guess') } } } },
					},
				},
				{ emitEvents: false }
			);

			// A conflict would tell that the guessed value is wrong
			expect(await db('articles_translations').where({ id: 10 })).toHaveLength(0);
		});

		it('reports a deleted item to users who can read the activity of the deletion', async () => {
			await deleteWithActivity('articles', 1);

			const editor = editorService([
				permission('articles', 'read'),
				permission('articles', 'update', ['*'], { status: { _eq: 'draft' } }),
				permission('directus_activity', 'read', ['*'], { collection: { _eq: 'articles' } }),
			]);

			const error = await conflictOf(
				editor.updateOne(
					1,
					{ title: 'Mine', $__meta: { onlyIf: { title: { _sha256: sha256Digest('Title') } } } },
					{ emitEvents: false }
				)
			);

			expect(error.extensions['conflicts']).toMatchObject([{ collection: 'articles', key: 1, type: 'deleted' }]);
		});

		it.each([
			['no read permission for the activity', []],
			[
				'no read permission for the activity of others',
				[permission('directus_activity', 'read', ['*'], { user: { _eq: admin.user } })],
			],
		])('does not report a deleted item to users with %s', async (_title, activityPermissions) => {
			await deleteWithActivity('articles', 1);

			const editor = editorService([
				permission('articles', 'read'),
				permission('articles', 'update'),
				...activityPermissions,
			]);

			await expect(
				editor.updateOne(
					1,
					{ title: 'Mine', $__meta: { onlyIf: { title: { _sha256: sha256Digest('Title') } } } },
					{ emitEvents: false }
				)
			).rejects.toThrow(ForbiddenException);
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

		it('does not tell whether a nested item was deleted without access to the activity', async () => {
			await deleteWithActivity('articles_translations', 10);

			const editor = editorService([
				permission('articles', 'read'),
				permission('articles', 'update'),
				permission('articles_translations', 'read'),
				permission('articles_translations', 'update'),
			]);

			await expect(
				editor.updateOne(
					1,
					{
						translations: {
							create: [],
							update: [
								{ id: 10, body: 'English (mine)', $__meta: { onlyIf: { body: { _sha256: sha256Digest('English') } } } },
							],
							delete: [],
						},
					},
					{ emitEvents: false }
				)
			).rejects.toThrow(ForbiddenException);
		});
	});

	describe('hooks', () => {
		afterEach(() => {
			emitter.offFilter('articles_translations.items.read', hideTranslations);
		});

		function hideTranslations(items: unknown) {
			return (items as Record<string, any>[]).filter((item) => item['id'] !== 10);
		}

		it('does not compare items that read hooks hide from the user', async () => {
			await db('articles_translations').where({ id: 10 }).update({ body: 'English (changed)' });

			emitter.onFilter('articles_translations.items.read', hideTranslations);

			const update = {
				translations: {
					create: [],
					update: [
						{ id: 10, body: 'English (mine)', $__meta: { onlyIf: { body: { _sha256: sha256Digest('English') } } } },
					],
					delete: [],
				},
			};

			await service().updateOne(1, update);

			expect((await db('articles_translations').where({ id: 10 }).first()).body).toBe('English (mine)');
		});
	});
});
