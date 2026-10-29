import type { SchemaOverview } from '@wbce-d9/types';
import knex from 'knex';
import type { Knex } from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { IndexesService } from './indexes.js';

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
	},
	relations: [],
};

const admin = { admin: true } as any;

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
		await db.schema.dropTableIfExists('articles');
		await db.schema.dropTableIfExists('other');

		await db.schema.createTable('articles', (table) => {
			table.increments('id');
			table.string('title');
			table.string('status');
		});

		service = new IndexesService({ knex: db, schema, accountability: admin });
	});

	it('creates and lists a plain index', async () => {
		expect(await service.readAll('articles')).toEqual([]);

		const created = await service.createOne('articles', { columns: ['title'] });

		expect(created).toMatchObject({
			name: 'articles_title_index',
			columns: ['title'],
			deletable: true,
			delete_blocked_reason: null,
		});

		expect(await service.readAll('articles')).toHaveLength(1);
	});

	it('keeps composite columns in order', async () => {
		const created = await service.createOne('articles', { columns: ['title', 'status'] });

		expect(created.columns).toEqual(['title', 'status']);
	});

	it('creates a partial index and reports its predicate', async () => {
		const where = { _and: [{ status: { _eq: 'published' } }] };

		const created = await service.createOne('articles', { columns: ['title'], where });

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
		const created = await service.createOne('articles', { columns: ['title'] });
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

		const created = await service.createOne('articles', { name: 'articles_custom_index', columns: ['title'] });

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
});
