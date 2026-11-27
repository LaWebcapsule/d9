import type { Knex } from 'knex';
import { describe, expect, test } from 'vitest';
import Postgres from './postgres.js';

function column(table_name: string, column_name: string) {
	return {
		table_name,
		column_name,
		default_value: null,
		data_type: 'uuid',
		max_length: null,
		is_generated: false,
		is_identity: false,
		is_nullable: false,
	};
}

function mockKnex(rowsFor: (sql: string) => unknown[]) {
	return {
		client: { config: {} },
		raw: async (sql: string) => ({ rows: rowsFor(sql) }),
	} as unknown as Knex;
}

describe('overview', () => {
	test('skips primary keys and geometry columns of tables dropped between the catalog reads', async () => {
		const knex = mockKnex((sql) => {
			if (sql.includes('information_schema.columns')) return [column('live', 'id')];

			if (sql.includes('indisprimary')) {
				return [
					{ table_name: 'live', column_name: 'id' },
					{ table_name: 'dropped', column_name: 'id' },
				];
			}

			if (sql.includes('postgis_version')) return [{ oid: 1 }];

			if (sql.includes('geometry_columns')) {
				return [
					{ table_name: 'dropped', column_name: 'shape', data_type: 'point' },
					{ table_name: 'live', column_name: 'removed', data_type: 'point' },
				];
			}

			return [];
		});

		const overview = await new Postgres(knex).overview();

		expect(Object.keys(overview)).toEqual(['live']);
		expect(overview['live']?.primary).toBe('id');
		expect(Object.keys(overview['live']?.columns ?? {})).toEqual(['id']);
	});
});
