import type { Field } from '@wbce-d9/types';
import knex from 'knex';
import type { Knex } from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FieldsService } from './fields.js';

describe('Services / Fields / indexed columns (SQLite)', () => {
	let db: Knex;
	let service: FieldsService;

	beforeAll(() => {
		db = ((knex as any).default ?? knex)({
			client: 'sqlite3',
			connection: { filename: ':memory:' },
			useNullAsDefault: true,
		});

		service = new FieldsService({ knex: db, schema: { collections: {}, relations: [] } });
	});

	afterAll(async () => {
		await db.destroy();
	});

	beforeEach(async () => {
		await db.schema.dropTableIfExists('articles');
	});

	const field = (schema: Record<string, unknown> = {}): Field =>
		({
			collection: 'articles',
			field: 'title',
			type: 'string',
			schema: { is_nullable: true, ...schema },
			meta: null,
		} as any);

	async function createTable(schema?: Record<string, unknown>) {
		await db.schema.createTable('articles', (table) => {
			table.increments('id');
			service.addColumnToTable(table, field(schema));
		});
	}

	async function info() {
		return await service['schemaInspector'].columnInfo('articles', 'title');
	}

	it('creates a plain index when is_indexed is true', async () => {
		await createTable({ is_indexed: true });

		const column = await info();

		expect(column.is_indexed).toBe(true);
		expect(column.is_unique).toBe(false);
	});

	it('does not create an index by default', async () => {
		await createTable();
		expect((await info()).is_indexed).toBe(false);
	});

	it('does not add a redundant index next to a unique constraint', async () => {
		await createTable({ is_indexed: true, is_unique: true });

		const column = await info();

		expect(column.is_unique).toBe(true);
		expect(column.is_indexed).toBe(false);
	});

	it('does not count composite indexes', async () => {
		await createTable();
		await db.schema.alterTable('articles', (table) => table.index(['title', 'id']));

		expect((await info()).is_indexed).toBe(false);
	});

	it('adds and drops the index on existing columns', async () => {
		await createTable();

		await db.schema.alterTable('articles', (table) => {
			service.addColumnToTable(table, field({ is_indexed: true }), {
				is_indexed: false,
				is_unique: false,
				is_nullable: true,
			} as any);
		});

		expect((await info()).is_indexed).toBe(true);

		await db.schema.alterTable('articles', (table) => {
			service.addColumnToTable(table, field({ is_indexed: false }), {
				is_indexed: true,
				is_unique: false,
				is_nullable: true,
			} as any);
		});

		expect((await info()).is_indexed).toBe(false);
	});
});
