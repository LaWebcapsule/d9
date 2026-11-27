import knex from 'knex';
import { describe, expect, test, vi } from 'vitest';
import { SchemaHelperDefault } from './dialects/default.js';

vi.mock('../../index.js', () => ({ getDatabaseClient: vi.fn() }));

describe('SchemaHelper.applyMultiRelationalSort', () => {
	test('quotes the directus_row_number alias exactly once', () => {
		const db = knex({ client: 'pg' });
		const helper = new SchemaHelperDefault(db);

		const query = helper.applyMultiRelationalSort(db, db('articles').select('articles.*'), 'articles', 'id', '?? asc', [
			db.raw('??', ['articles.title']),
		]);

		expect(query.toSQL().sql).toBe(
			'select "articles".*, row_number() over (partition by "articles"."id" order by "articles"."title" asc) as "directus_row_number" from "articles"'
		);
	});
});
