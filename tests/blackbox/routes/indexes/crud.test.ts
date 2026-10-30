import config, { getUrl } from '@common/config.ts';
import vendors from '@common/get-dbs-to-test.ts';
import { DisableTestCachingSetup } from '@common/index.ts';
import { TEST_USERS, USER } from '@common/variables.ts';
import type { CollectionIndex, IndexCapabilities } from '@wbce-d9/types';
import type { Knex } from 'knex';
import knex from 'knex';
import request from 'supertest';
import { collection } from './crud.seed.ts';

const TITLE_INDEX = `${collection}_title_index`;
const UNIQUE_INDEX = `${collection}_title_unique`;
const EXTERNAL_INDEX = `${collection}_external_index`;

describe('/indexes', () => {
	DisableTestCachingSetup();

	const databases = new Map<string, Knex>();

	const readIndexes = (vendor: string) =>
		request(getUrl(vendor)).get(`/indexes/${collection}`).set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

	const createIndex = (vendor: string, payload: Record<string, any>) =>
		request(getUrl(vendor))
			.post(`/indexes/${collection}`)
			.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
			.send(payload);

	const deleteIndex = (vendor: string, name: string) =>
		request(getUrl(vendor)).delete(`/indexes/${collection}/${name}`).set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

	const getCapabilities = async (vendor: string): Promise<IndexCapabilities> =>
		(await readIndexes(vendor)).body.meta.capabilities;

	const countActivities = async (vendor: string, event: string, name: string) => {
		const response = await request(getUrl(vendor))
			.get('/activity')
			.query({
				filter: JSON.stringify({
					collection: { _eq: 'directus_collections' },
					item: { _eq: collection },
					comment: { _starts_with: `${event} {"name":"${name}"` },
				}),
				limit: -1,
			})
			.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

		return response.body.data.length;
	};

	// Drop every index a previous test may have left behind
	const dropTestIndexes = async (vendor: string) => {
		const indexes: CollectionIndex[] = (await readIndexes(vendor)).body.data;

		for (const index of indexes) {
			if (index.deletable) await deleteIndex(vendor, index.name);
		}
	};

	beforeAll(() => {
		for (const vendor of vendors) {
			databases.set(vendor, knex(config.knexConfig[vendor]!));
		}
	});

	afterAll(async () => {
		for (const [vendor, connection] of databases) {
			try {
				await dropTestIndexes(vendor);
			} finally {
				await connection.destroy();
			}
		}
	});

	describe('Permissions', () => {
		TEST_USERS.forEach((userKey) => {
			describe(USER[userKey].NAME, () => {
				it.each(vendors)('%s', async (vendor) => {
					await dropTestIndexes(vendor);
					const { supported } = await getCapabilities(vendor);

					// Action
					const readResponse = await request(getUrl(vendor))
						.get(`/indexes/${collection}`)
						.set('Authorization', `Bearer ${USER[userKey].TOKEN}`);

					const createResponse = await request(getUrl(vendor))
						.post(`/indexes/${collection}`)
						.set('Authorization', `Bearer ${USER[userKey].TOKEN}`)
						.send({ columns: ['title'] });

					const deleteResponse = await request(getUrl(vendor))
						.delete(`/indexes/${collection}/${TITLE_INDEX}`)
						.set('Authorization', `Bearer ${USER[userKey].TOKEN}`);

					// Assert
					if (userKey === USER.ADMIN.KEY) {
						expect(readResponse.statusCode).toBe(200);
						expect(createResponse.statusCode).toBe(supported ? 200 : 400);
						expect(deleteResponse.statusCode).toBe(supported ? 200 : 400);
					} else {
						expect(readResponse.statusCode).toBe(403);
						expect(createResponse.statusCode).toBe(403);
						expect(deleteResponse.statusCode).toBe(403);
					}
				});
			});
		});

		it.each(vendors)('%s rejects an unknown collection', async (vendor) => {
			// Action
			const response = await request(getUrl(vendor))
				.get('/indexes/test_indexes_missing')
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			// Assert
			expect(response.statusCode).toBe(403);
		});
	});

	describe('GET /:collection', () => {
		it.each(vendors)('%s returns the capabilities with the indexes', async (vendor) => {
			await dropTestIndexes(vendor);

			// Action
			const response = await readIndexes(vendor);

			// Assert
			expect(response.statusCode).toBe(200);
			expect(Array.isArray(response.body.data)).toBe(true);

			expect(response.body.meta.capabilities).toEqual({
				vendor: expect.any(String),
				supported: expect.any(Boolean),
				where: expect.any(Boolean),
			});

			if (!response.body.meta.capabilities.supported) {
				expect(response.body.data).toEqual([]);
			}
		});

		it.each(vendors)('%s never allows dropping the primary key', async (vendor) => {
			const { supported } = await getCapabilities(vendor);
			if (!supported) return;

			// Action
			const indexes: CollectionIndex[] = (await readIndexes(vendor)).body.data;

			// Assert
			for (const index of indexes.filter((item) => item.kind === 'primary')) {
				expect(index).toMatchObject({ deletable: false, delete_blocked_reason: 'primary_key' });
				expect((await deleteIndex(vendor, index.name)).statusCode).toBe(400);
			}
		});
	});

	describe('POST /:collection', () => {
		it.each(vendors)('%s creates a plain index', async (vendor) => {
			await dropTestIndexes(vendor);
			const { supported } = await getCapabilities(vendor);

			// Action
			const response = await createIndex(vendor, { columns: ['title'] });

			// Assert
			if (!supported) {
				expect(response.statusCode).toBe(400);
				return;
			}

			expect(response.statusCode).toBe(200);

			expect(response.body.data).toMatchObject({
				name: TITLE_INDEX,
				columns: ['title'],
				kind: 'index',
				unique: false,
				partial: false,
				deletable: true,
				delete_blocked_reason: null,
			});

			const indexes: CollectionIndex[] = (await readIndexes(vendor)).body.data;
			expect(indexes.map((index) => index.name)).toContain(TITLE_INDEX);
		});

		it.each(vendors)('%s keeps composite columns in order', async (vendor) => {
			await dropTestIndexes(vendor);
			const { supported } = await getCapabilities(vendor);
			if (!supported) return;

			// Action
			const response = await createIndex(vendor, { columns: ['status', 'title'] });

			// Assert
			expect(response.statusCode).toBe(200);
			expect(response.body.data.columns).toEqual(['status', 'title']);
		});

		it.each(vendors)('%s creates a partial index when supported', async (vendor) => {
			await dropTestIndexes(vendor);
			const { supported, where } = await getCapabilities(vendor);
			if (!supported) return;

			// Action
			const response = await createIndex(vendor, {
				columns: ['title'],
				where: { status: { _eq: 'published' } },
			});

			// Assert
			if (!where) {
				expect(response.statusCode).toBe(400);
				return;
			}

			expect(response.statusCode).toBe(200);
			expect(response.body.data).toMatchObject({ name: TITLE_INDEX, partial: true, deletable: true });
			expect(response.body.data.predicate).toContain('published');
		});

		it.each(vendors)('%s enforces the <table>_<name>_index convention on custom names', async (vendor) => {
			await dropTestIndexes(vendor);
			const { supported } = await getCapabilities(vendor);
			if (!supported) return;

			// Action & Assert
			for (const name of ['custom_index', `${collection}_custom`, `${collection}__index`]) {
				expect((await createIndex(vendor, { name, columns: ['title'] })).statusCode).toBe(400);
			}

			const response = await createIndex(vendor, { name: `${collection}_custom_index`, columns: ['title'] });

			expect(response.statusCode).toBe(200);
			expect(response.body.data.name).toBe(`${collection}_custom_index`);
		});

		it.each(vendors)('%s rejects a duplicate index', async (vendor) => {
			await dropTestIndexes(vendor);
			const { supported } = await getCapabilities(vendor);
			if (!supported) return;

			// Setup
			expect((await createIndex(vendor, { columns: ['title'] })).statusCode).toBe(200);

			// Action
			const response = await createIndex(vendor, { columns: ['title'] });

			// Assert
			expect(response.statusCode).toBeGreaterThanOrEqual(400);
		});

		it.each(vendors)('%s rejects an unknown column', async (vendor) => {
			await dropTestIndexes(vendor);
			const { supported } = await getCapabilities(vendor);
			if (!supported) return;

			// Action
			const response = await createIndex(vendor, { columns: ['missing_column'] });

			// Assert
			expect(response.statusCode).toBeGreaterThanOrEqual(400);
		});
	});

	describe('DELETE /:collection/:name', () => {
		it.each(vendors)('%s deletes an index', async (vendor) => {
			await dropTestIndexes(vendor);
			const { supported } = await getCapabilities(vendor);
			if (!supported) return;

			// Setup
			await createIndex(vendor, { columns: ['title'] });

			// Action
			const response = await deleteIndex(vendor, TITLE_INDEX);

			// Assert
			expect(response.statusCode).toBe(200);

			const indexes: CollectionIndex[] = (await readIndexes(vendor)).body.data;
			expect(indexes.map((index) => index.name)).not.toContain(TITLE_INDEX);
		});

		it.each(vendors)('%s forbids deleting an index that does not exist', async (vendor) => {
			const { supported } = await getCapabilities(vendor);
			if (!supported) return;

			// Action
			const response = await deleteIndex(vendor, `${collection}_missing_index`);

			// Assert
			expect(response.statusCode).toBe(403);
		});

		it.each(vendors)('%s refuses to delete a unique index', async (vendor) => {
			await dropTestIndexes(vendor);
			const { supported } = await getCapabilities(vendor);
			if (!supported) return;

			const db = databases.get(vendor)!;

			// Setup
			await db.schema.alterTable(collection, (table) => {
				table.unique(['title'], { indexName: UNIQUE_INDEX });
			});

			try {
				// Action
				const indexes: CollectionIndex[] = (await readIndexes(vendor)).body.data;
				const unique = indexes.find((index) => index.name === UNIQUE_INDEX);
				const response = await deleteIndex(vendor, UNIQUE_INDEX);

				// Assert
				expect(unique).toMatchObject({ unique: true, deletable: false, delete_blocked_reason: 'unique' });
				expect(response.statusCode).toBe(400);
			} finally {
				await db.schema.alterTable(collection, (table) => {
					table.dropUnique(['title'], UNIQUE_INDEX);
				});
			}
		});

		it.each(vendors)('%s deletes an index created outside of d9', async (vendor) => {
			await dropTestIndexes(vendor);
			const { supported, where } = await getCapabilities(vendor);
			if (!supported) return;

			const db = databases.get(vendor)!;

			// Setup
			if (where) {
				await db.raw(`CREATE INDEX ?? ON ?? (??) WHERE ?? = 'published'`, [
					EXTERNAL_INDEX,
					collection,
					'title',
					'status',
				]);
			} else {
				await db.schema.alterTable(collection, (table) => {
					table.index(['title'], EXTERNAL_INDEX);
				});
			}

			// Action
			const indexes: CollectionIndex[] = (await readIndexes(vendor)).body.data;
			const external = indexes.find((index) => index.name === EXTERNAL_INDEX);
			const response = await deleteIndex(vendor, EXTERNAL_INDEX);

			// Assert
			expect(external).toMatchObject({ columns: ['title'], partial: where, deletable: true });
			expect(response.statusCode).toBe(200);
		});
	});

	describe('Activity', () => {
		it.each(vendors)('%s records index creation and deletion', async (vendor) => {
			await dropTestIndexes(vendor);
			const { supported } = await getCapabilities(vendor);
			if (!supported) return;

			const created = await countActivities(vendor, 'index.created', TITLE_INDEX);
			const deleted = await countActivities(vendor, 'index.deleted', TITLE_INDEX);

			// Action
			await createIndex(vendor, { columns: ['title'] });
			await deleteIndex(vendor, TITLE_INDEX);

			// Assert
			expect(await countActivities(vendor, 'index.created', TITLE_INDEX)).toBe(created + 1);
			expect(await countActivities(vendor, 'index.deleted', TITLE_INDEX)).toBe(deleted + 1);
		});
	});
});
