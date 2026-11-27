import type { Permission } from '@wbce-d9/types';
import knex from 'knex';
import { MockClient, createTracker } from 'knex-mock-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userSchema } from '../__utils__/schemas.js';
import { ItemsService } from '../services/index.js';
import { getDatabaseClient } from './index.js';

vi.mock('../env', async () => {
	const actual = (await vi.importActual('../env')) as { default: Record<string, any> };
	const MOCK_ENV = { ...actual.default, CACHE_AUTO_PURGE: false };
	return { default: MOCK_ENV, getEnv: () => MOCK_ENV };
});

vi.mock('./index', () => ({
	default: vi.fn(),
	getDatabaseClient: vi.fn(),
}));

vi.mock('../cache', () => ({
	getCache: vi.fn().mockReturnValue({ cache: null, systemCache: { clear: vi.fn() } }),
}));

describe('forUpdate', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	const item = { id: 'b5a7dd0f-fc9f-4242-b331-83990990198f', name: 'string1' };

	const permission = (collection: string, permissions: Record<string, any> = {}) =>
		({
			id: 1,
			role: 'editor',
			collection,
			action: 'read',
			permissions,
			validation: {},
			presets: {},
			fields: ['*'],
		} as Permission);

	const accountabilities = {
		admin: { role: 'admin', admin: true },
		// The filter on a one-to-many relation wraps the query
		filtered: {
			role: 'editor',
			admin: false,
			permissions: [permission('authors', { items: { title: { _nnull: true } } }), permission('posts')],
		},
	};

	async function getReadSQL(
		client: ReturnType<typeof getDatabaseClient>,
		dialect: string,
		forUpdate: boolean,
		accountability: keyof typeof accountabilities = 'admin'
	) {
		vi.mocked(getDatabaseClient).mockReturnValue(client);

		const vendorDb = knex.default({ client: MockClient, dialect });
		const vendorTracker = createTracker(vendorDb);
		vendorTracker.on.select('authors').response([item]);

		const itemsService = new ItemsService('authors', {
			knex: vendorDb,
			accountability: accountabilities[accountability],
			schema: userSchema,
		});

		await itemsService.readMany([item.id], { fields: ['id', 'name'], limit: -1 }, { forUpdate });

		return vendorTracker.history.select.map((query) => query.sql);
	}

	const noLock = /for update|UPDLOCK/;

	it.each([
		{ client: 'postgres', dialect: 'pg', lock: / for update of "authors"$/ },
		{ client: 'cockroachdb', dialect: 'cockroachdb', lock: / for update of "authors"$/ },
		{ client: 'mysql', dialect: 'mysql', lock: / for update$/ },
		{ client: 'oracle', dialect: 'oracledb', lock: / for update$/ },
		{ client: 'mssql', dialect: 'mssql', lock: / from \[authors\] with \(UPDLOCK\) where / },
	] as const)('$client locks the rows of the collection when asked to', async ({ client, dialect, lock }) => {
		const locked = await getReadSQL(client, dialect, true);

		expect(locked).toHaveLength(1);
		expect(locked[0]).toMatch(lock);

		expect((await getReadSQL(client, dialect, false))[0]).not.toMatch(noLock);
	});

	it.each([
		{
			client: 'postgres',
			dialect: 'pg',
			lock: /^select .+ inner join \(.+\) as "inner" .+ for update of "authors"$/,
		},
		{ client: 'mysql', dialect: 'mysql', lock: /^select .+ inner join \(.+\) as `inner` .+ for update$/ },
		{ client: 'mssql', dialect: 'mssql', lock: / from \[authors\] with \(UPDLOCK\) inner join \(/ },
	] as const)('$client locks the rows of a wrapped query', async ({ client, dialect, lock }) => {
		const locked = await getReadSQL(client, dialect, true, 'filtered');

		expect(locked).toHaveLength(1);
		expect(locked[0]).toMatch(lock);
	});

	it('oracle locks the rows of a wrapped query with a separate query', async () => {
		const [lock, read] = await getReadSQL('oracle', 'oracledb', true, 'filtered');

		expect(lock).toMatch(
			/^select "id" from "authors" where "id" in \(select "inner"\."id" from \(.+\) "inner"\) for update$/
		);

		expect(read).toMatch(/ inner join \(/);
		expect(read).not.toMatch(noLock);
	});

	it.each([
		{ client: 'sqlite', dialect: 'sqlite3' },
		{ client: 'redshift', dialect: 'redshift' },
	] as const)('$client reads without a lock', async ({ client, dialect }) => {
		expect((await getReadSQL(client, dialect, true))[0]).not.toMatch(noLock);
	});
});
