import knex from 'knex';
import type { Knex } from 'knex';
import { MockClient, Tracker, createTracker } from 'knex-mock-client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { userSchema } from '../__utils__/schemas.js';
import { MetaService } from './meta.js';

vi.mock('../../src/database/index', () => ({
	default: vi.fn(),
	getDatabaseClient: vi.fn().mockReturnValue('postgres'),
}));

describe('Integration Tests', () => {
	describe('Services / Meta', () => {
		let db: Knex;
		let tracker: Tracker;

		beforeAll(() => {
			db = knex.default({ client: MockClient });
			tracker = createTracker(db);
		});

		afterEach(() => {
			tracker.reset();
		});

		describe('filterCount', () => {
			it('counts the rows of the collection when the filter does not cross a to-many relation', async () => {
				tracker.on.select('authors').response([{ count: 2 }]);

				const service = new MetaService({ knex: db, schema: userSchema, accountability: { role: null, admin: true } });

				const count = await service.filterCount('authors', { filter: { name: { _eq: 'toto' } } });

				expect(count).toBe(2);
				expect(tracker.history.select[0]!.sql).toContain('count(*)');
				expect(tracker.history.select[0]!.sql).not.toContain('distinct');
			});

			it('counts distinct items when the filter crosses a to-many relation', async () => {
				tracker.on.select('authors').response([{ count: 1 }]);

				const service = new MetaService({ knex: db, schema: userSchema, accountability: { role: null, admin: true } });

				const count = await service.filterCount('authors', { filter: { items: { title: { _contains: 'a' } } } });

				expect(count).toBe(1);
				expect(tracker.history.select[0]!.sql).toContain('count(distinct "authors"."id")');
			});
		});
	});
});
