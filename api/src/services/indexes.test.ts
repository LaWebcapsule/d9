import type { SchemaOverview } from '@wbce-d9/types';
import knex from 'knex';
import type { Knex } from 'knex';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getIndexCapabilities } from '../database/helpers/schema/capabilities.js';
import { ForbiddenException, InvalidPayloadException } from '../exceptions/index.js';
import logger from '../logger.js';
import { IndexesService } from './indexes.js';

vi.mock('../database/helpers/schema/capabilities.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../database/helpers/schema/capabilities.js')>();

	return { ...actual, getIndexCapabilities: vi.fn(actual.getIndexCapabilities) };
});

const field = (name: string, type: string) =>
	({
		field: name,
		type,
		alias: false,
		special: [],
		dbType: type,
		defaultValue: null,
		nullable: true,
		generated: false,
		precision: null,
		scale: null,
		note: null,
		validation: null,
	} as any);

const schema: SchemaOverview = {
	collections: {
		articles: {
			collection: 'articles',
			primary: 'id',
			singleton: false,
			sortField: null,
			note: null,
			accountability: 'all',
			fields: {
				id: field('id', 'integer'),
				title: field('title', 'string'),
				status: field('status', 'string'),
			},
		},
		directus_activity: {
			collection: 'directus_activity',
			primary: 'id',
			singleton: false,
			sortField: null,
			note: null,
			accountability: null,
			fields: {
				id: field('id', 'integer'),
				action: field('action', 'string'),
				user: field('user', 'uuid'),
				timestamp: field('timestamp', 'dateTime'),
				ip: field('ip', 'string'),
				user_agent: field('user_agent', 'string'),
				collection: field('collection', 'string'),
				item: field('item', 'string'),
				comment: field('comment', 'string'),
				origin: field('origin', 'string'),
				session_id: field('session_id', 'string'),
			},
		},
		directus_users: {
			collection: 'directus_users',
			primary: 'id',
			singleton: false,
			sortField: null,
			note: null,
			accountability: null,
			fields: {
				id: field('id', 'uuid'),
				first_name: field('first_name', 'string'),
				last_name: field('last_name', 'string'),
				email: field('email', 'string'),
			},
		},
	},
	relations: [],
};

const admin = {
	admin: true,
	user: '00000000-0000-4000-8000-000000000000',
	role: '00000000-0000-4000-8000-000000000001',
	ip: '127.0.0.1',
	userAgent: 'vitest',
	origin: 'http://localhost',
	session_id: 'test-session',
} as any;

describe('Services / Indexes (SQLite)', () => {
	let db: Knex;
	let service: IndexesService;

	beforeAll(() => {
		db = ((knex as any).default ?? knex)({
			client: 'sqlite3',
			connection: { filename: ':memory:' },
			useNullAsDefault: true,
		});
	});

	afterAll(async () => {
		await db.destroy();
	});

	beforeEach(async () => {
		await db.schema.dropTableIfExists('directus_activity');
		await db.schema.dropTableIfExists('directus_users');
		await db.schema.dropTableIfExists('articles');
		await db.schema.dropTableIfExists('other');

		await db.schema.createTable('directus_users', (table) => {
			table.string('id').primary();
			table.string('first_name');
			table.string('last_name');
			table.string('email');
		});

		await db('directus_users').insert({
			id: admin.user,
			first_name: 'Admin',
			last_name: 'User',
			email: 'admin@example.com',
		});

		await db.schema.createTable('directus_activity', (table) => {
			table.increments('id');
			table.string('action').notNullable();
			table.string('user');
			table.datetime('timestamp').notNullable().defaultTo(db.fn.now());
			table.string('ip');
			table.string('user_agent');
			table.string('collection').notNullable();
			table.string('item').notNullable();
			table.text('comment');
			table.string('origin');
			table.string('session_id');
		});

		await db.schema.createTable('articles', (table) => {
			table.increments('id');
			table.string('title');
			table.string('status');
		});

		service = new IndexesService({ knex: db, schema, accountability: admin });
	});

	afterEach(() => {
		vi.mocked(getIndexCapabilities).mockClear();
		vi.restoreAllMocks();
	});

	it('forbids non-admin users', async () => {
		const user = new IndexesService({ knex: db, schema, accountability: { admin: false } as any });

		await expect(user.readAll('articles')).rejects.toThrow(ForbiddenException);
		await expect(user.createOne('articles', { columns: ['title'] })).rejects.toThrow(ForbiddenException);
		await expect(user.deleteOne('articles', 'articles_title_index')).rejects.toThrow(ForbiddenException);
	});

	it('rejects a partial index when the database does not support it', async () => {
		const actual = await vi.importActual<typeof import('../database/helpers/schema/capabilities.js')>(
			'../database/helpers/schema/capabilities.js'
		);

		vi.mocked(getIndexCapabilities).mockReturnValue({ supported: true, where: false });

		try {
			await expect(
				service.createOne('articles', { columns: ['title'], where: { status: { _eq: 'published' } } })
			).rejects.toThrow(InvalidPayloadException);
		} finally {
			vi.mocked(getIndexCapabilities).mockImplementation(actual.getIndexCapabilities);
		}
	});

	it('forbids deleting an index that does not exist', async () => {
		await expect(service.deleteOne('articles', 'articles_missing_index')).rejects.toThrow(ForbiddenException);
	});

	it('creates and lists a plain index', async () => {
		expect(await service.readAll('articles')).toEqual([]);

		const name = await service.createOne('articles', { columns: ['title'] });
		const created = await service.readOne('articles', name);

		expect(created).toMatchObject({
			name: 'articles_title_index',
			columns: ['title'],
			deletable: true,
			delete_blocked_reason: null,
		});

		expect(await service.readAll('articles')).toHaveLength(1);
	});

	it('keeps composite columns in order', async () => {
		const name = await service.createOne('articles', { columns: ['title', 'status'] });
		const created = await service.readOne('articles', name);

		expect(created.columns).toEqual(['title', 'status']);
	});

	it('creates a partial index and reports its predicate', async () => {
		const where = { _and: [{ status: { _eq: 'published' } }] };

		const name = await service.createOne('articles', { columns: ['title'], where });
		const created = await service.readOne('articles', name);

		expect(created.partial).toBe(true);
		expect(created.predicate).toContain('published');
		expect(created.deletable).toBe(true);

		// A fresh service reads it back from the database, not from stored metadata
		const fresh = new IndexesService({ knex: db, schema, accountability: admin });
		const [index] = await fresh.readAll('articles');

		expect(index?.partial).toBe(true);
		expect(index?.predicate).toContain('published');
	});

	it('deletes an index', async () => {
		const name = await service.createOne('articles', { columns: ['title'] });
		const created = await service.readOne('articles', name);
		await service.deleteOne('articles', created.name);

		expect(await service.readAll('articles')).toEqual([]);
	});

	it('allows deleting a partial index that was created outside of d9', async () => {
		await db.raw(`CREATE INDEX articles_partial_external ON articles (title) WHERE status = 'published'`);

		const [index] = await service.readAll('articles');

		expect(index).toMatchObject({
			partial: true,
			deletable: true,
			delete_blocked_reason: null,
		});

		await service.deleteOne('articles', index!.name);

		expect(await service.readAll('articles')).toEqual([]);
	});

	it('refuses to delete a unique index', async () => {
		await db.schema.alterTable('articles', (table) => {
			table.unique('title');
		});

		const [index] = await service.readAll('articles');

		expect(index).toMatchObject({
			kind: 'unique_index',
			deletable: false,
			delete_blocked_reason: 'unique',
		});

		await expect(service.deleteOne('articles', index!.name)).rejects.toThrow();
	});

	it('enforces the <table>_<name>_index convention on custom names', async () => {
		for (const name of ['custom_index', 'articles_custom', 'articles__index']) {
			await expect(service.createOne('articles', { name, columns: ['title'] })).rejects.toThrow();
		}

		const name = await service.createOne('articles', { name: 'articles_custom_index', columns: ['title'] });
		const created = await service.readOne('articles', name);

		expect(created.name).toBe('articles_custom_index');
	});

	it('translates a duplicate index name from another table', async () => {
		await db.schema.createTable('other', (table) => {
			table.increments('id');
		});

		await db.raw('CREATE INDEX articles_shared_index ON other (id)');

		await expect(service.createOne('articles', { name: 'articles_shared_index', columns: ['title'] })).rejects.toThrow(
			/already exists/
		);
	});

	it('rejects unknown fields and duplicate names', async () => {
		await expect(service.createOne('articles', { columns: ['nope'] })).rejects.toThrow();
		await expect(service.createOne('articles', { columns: [] })).rejects.toThrow();

		await service.createOne('articles', { columns: ['title'] });
		await expect(service.createOne('articles', { columns: ['title'] })).rejects.toThrow(/already exists/);
	});

	it('writes an audit activity when an index is created', async () => {
		const info = vi.spyOn(logger, 'info').mockImplementation(() => {});

		await service.createOne('articles', { columns: ['title'] });

		const activity = await db('directus_activity').first();

		expect(activity).toMatchObject({
			action: 'comment',
			collection: 'directus_collections',
			item: 'articles',
			user: admin.user,
		});

		expect(activity.comment).toMatch(/^index\.created /);

		const payload = JSON.parse(activity.comment.slice('index.created '.length));

		expect(payload).toEqual({
			name: 'articles_title_index',
			collection: 'articles',
			columns: ['title'],
			where: null,
			predicate: null,
			kind: 'index',
			unique: false,
			partial: false,
		});

		expect(info).toHaveBeenCalledWith(
			expect.stringContaining('index.created: "articles_title_index" on "articles" (title)')
		);
	});

	it('writes an audit activity when an index is deleted', async () => {
		await service.createOne('articles', { columns: ['title'] });
		await db('directus_activity').del();

		const info = vi.spyOn(logger, 'info').mockImplementation(() => {});

		await service.deleteOne('articles', 'articles_title_index');

		const activity = await db('directus_activity').first();

		expect(activity).toMatchObject({
			action: 'comment',
			collection: 'directus_collections',
			item: 'articles',
			user: admin.user,
		});

		expect(activity.comment).toMatch(/^index\.deleted /);

		const payload = JSON.parse(activity.comment.slice('index.deleted '.length));

		expect(payload).toMatchObject({
			name: 'articles_title_index',
			collection: 'articles',
			columns: ['title'],
			where: null,
			kind: 'index',
			unique: false,
			partial: false,
		});

		expect(info).toHaveBeenCalledWith(
			expect.stringContaining('index.deleted: "articles_title_index" on "articles" (title)')
		);
	});

	it('keeps the partial predicate in the audit payload', async () => {
		const where = { _and: [{ status: { _eq: 'published' } }] };

		await service.createOne('articles', { columns: ['title'], where });

		const activity = await db('directus_activity').first();
		const payload = JSON.parse(activity.comment.slice('index.created '.length));

		expect(payload.where).toEqual(where);
		expect(payload.predicate).toContain('published');
		expect(payload.partial).toBe(true);
	});

	it('keeps the index when the audit activity cannot be written', async () => {
		await db.schema.dropTable('directus_activity');

		const error = vi.spyOn(logger, 'error').mockImplementation(() => {});

		await service.createOne('articles', { columns: ['title'] });

		expect(await service.readAll('articles')).toHaveLength(1);
		expect(error).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("Couldn't write"));
	});

	it('logs a creation error from the database', async () => {
		await service.createOne('articles', { columns: ['title'] });

		const error = vi.spyOn(logger, 'error').mockImplementation(() => {});

		await expect(service.createOne('articles', { columns: ['title'] })).rejects.toThrow(/already exists/);
		expect(error).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("Couldn't create index"));
	});

	it('logs a deletion error from the database', async () => {
		await service.createOne('articles', { columns: ['title'] });

		const drop = vi.spyOn(service.helpers.schema, 'dropIndex').mockRejectedValue(new Error('drop failed'));
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {});

		await expect(service.deleteOne('articles', 'articles_title_index')).rejects.toThrow('drop failed');
		expect(error).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("Couldn't delete index"));

		drop.mockRestore();
	});
});
