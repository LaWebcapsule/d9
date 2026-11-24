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

		describe('totalCount', () => {
			const accountabilityWithReadPermission = (permissions: Record<string, any>) => ({
				role: 'reader',
				admin: false,
				permissions: [
					{
						id: 1,
						role: 'reader',
						collection: 'authors',
						action: 'read' as const,
						permissions,
						validation: {},
						presets: {},
						fields: ['*'],
					},
				],
			});

			it('counts the rows of the collection when the permission does not cross a to-many relation', async () => {
				tracker.on.select('authors').response([{ count: 2 }]);

				const service = new MetaService({
					knex: db,
					schema: userSchema,
					accountability: accountabilityWithReadPermission({ name: { _eq: 'toto' } }),
				});

				const count = await service.totalCount('authors');

				expect(count).toBe(2);
				expect(tracker.history.select[0]!.sql).toContain('count(*)');
				expect(tracker.history.select[0]!.sql).not.toContain('distinct');
			});

			it('counts distinct items when the permission crosses a to-many relation', async () => {
				tracker.on.select('authors').response([{ count: 1 }]);

				const service = new MetaService({
					knex: db,
					schema: userSchema,
					accountability: accountabilityWithReadPermission({ items: { title: { _contains: 'a' } } }),
				});

				const count = await service.totalCount('authors');

				expect(count).toBe(1);
				expect(tracker.history.select[0]!.sql).toContain('count(distinct "authors"."id")');
			});
		});
	});
});
