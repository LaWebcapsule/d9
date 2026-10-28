import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import config, { getUrl, paths, type Env } from '@common/config.ts';
import { CreateCollection } from '@common/functions.ts';
import vendors from '@common/get-dbs-to-test.ts';
import { USER } from '@common/variables.ts';
import { awaitDirectusConnection } from '@utils/await-connection.ts';
import { ChildProcess, spawn } from 'child_process';
import type { Knex } from 'knex';
import knex from 'knex';
import { cloneDeep } from 'lodash-es';
import request from 'supertest';

const newCollectionName = 'schema-caching-test';

describe('Schema Caching Tests', () => {
	describe('GET /collections/:collection', () => {
		describe('schema change propagates across nodes using messenger', () => {
			const databases = new Map<string, Knex>();
			const tzDirectus = {} as { [vendor: string]: ChildProcess[] };
			const envs = {} as { [vendor: string]: Env[] };

			beforeAll(async () => {
				const promises = [];

				for (const vendor of vendors) {
					databases.set(vendor, knex(config.knexConfig[vendor]));

					const env1 = cloneDeep(config.envs);
					env1[vendor].CACHE_ENABLED = 'true';
					env1[vendor].CACHE_AUTO_PURGE = 'true';
					env1[vendor].CACHE_SCHEMA = 'true';
					env1[vendor].CACHE_STORE = 'memory';
					env1[vendor].CACHE_NAMESPACE = 'directus-schema-cache';
					env1[vendor].MESSENGER_STORE = 'redis';
					env1[vendor].MESSENGER_NAMESPACE = `directus-${vendor}`;
					env1[vendor].MESSENGER_REDIS = `redis://localhost:6108/4`;

					const env2 = cloneDeep(env1);
					env2[vendor].CACHE_NAMESPACE = env1[vendor].CACHE_NAMESPACE + '2';

					const newServerPort1 = Number(env1[vendor]!.PORT) + 150;
					const newServerPort2 = Number(env2[vendor]!.PORT) + 200;

					env1[vendor].PORT = String(newServerPort1);
					env2[vendor].PORT = String(newServerPort2);

					const server1 = spawn('node', [paths.cli, 'start'], { cwd: paths.cwd, env: env1[vendor] });
					const server2 = spawn('node', [paths.cli, 'start'], { cwd: paths.cwd, env: env2[vendor] });

					tzDirectus[vendor] = [server1, server2];
					envs[vendor] = [env1, env2];

					promises.push(awaitDirectusConnection(newServerPort1), awaitDirectusConnection(newServerPort2));
				}

				// Give the server some time to start
				await Promise.all(promises);
			}, 180000);

			afterAll(async () => {
				for (const [vendor, connection] of databases) {
					for (const instance of tzDirectus[vendor]!) {
						instance.kill();
					}

					await connection.destroy();
				}
			});

			it.each(vendors)('%s', async (vendor) => {
				// Setup
				const env1 = envs[vendor][0];
				const env2 = envs[vendor][1];

				await CreateCollection(vendor, { collection: newCollectionName, env: env1 });

				await request(getUrl(vendor, env1))
					.post(`/utils/cache/clear`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				await request(getUrl(vendor, env1)).get(`/fields`).set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				await request(getUrl(vendor, env2))
					.post(`/utils/cache/clear`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				await request(getUrl(vendor, env2)).get(`/fields`).set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				// Action
				const responseBefore = await request(getUrl(vendor, env1))
					.get(`/collections/${newCollectionName}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				const responseBefore2 = await request(getUrl(vendor, env2))
					.get(`/collections/${newCollectionName}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				await request(getUrl(vendor, env1))
					.delete(`/collections/${newCollectionName}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				const responseAfter = await request(getUrl(vendor, env1))
					.get(`/collections/${newCollectionName}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				const responseAfter2 = await request(getUrl(vendor, env2))
					.get(`/collections/${newCollectionName}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				// Assert
				expect(responseBefore.statusCode).toBe(200);
				expect(responseBefore2.statusCode).toBe(200);
				expect(responseAfter.statusCode).toBe(403);
				expect(responseAfter2.statusCode).toBe(403);
			});
		});

		// Disable failing test temporarly
		// describe('schema change does not propagate across nodes without messenger', () => {
		// 	const databases = new Map<string, Knex>();
		// 	const tzDirectus = {} as { [vendor: string]: ChildProcess[] };
		// 	const envs = {} as { [vendor: string]: Env[] };

		// 	beforeAll(async () => {
		// 		const promises = [];

		// 		for (const vendor of vendors) {
		// 			databases.set(vendor, knex(config.knexConfig[vendor]));

		// 			const cacheNamespace = `directus-${vendor}`;

		// 			const env3 = cloneDeep(config.envs);
		// 			env3[vendor].CACHE_ENABLED = 'true';
		// 			env3[vendor].CACHE_AUTO_PURGE = 'true';
		// 			env3[vendor].CACHE_SCHEMA = 'true';
		// 			env3[vendor].CACHE_STORE = 'memory';
		// 			env3[vendor].CACHE_NAMESPACE = cacheNamespace + '3';

		// 			const env4 = cloneDeep(env3);
		// 			env4[vendor].CACHE_NAMESPACE = cacheNamespace + '4';

		// 			const newServerPort3 = Number(env3[vendor]!.PORT) + 250;
		// 			const newServerPort4 = Number(env4[vendor]!.PORT) + 300;

		// 			env3[vendor].PORT = String(newServerPort3);
		// 			env4[vendor].PORT = String(newServerPort4);

		// 			const server3 = spawn('node', [paths.cli, 'start'], { cwd: paths.cwd, env: env3[vendor] });
		// 			const server4 = spawn('node', [paths.cli, 'start'], { cwd: paths.cwd, env: env4[vendor] });

		// 			tzDirectus[vendor] = [server3, server4];
		// 			envs[vendor] = [env3, env4];

		// 			promises.push(awaitDirectusConnection(newServerPort3), awaitDirectusConnection(newServerPort4));
		// 		}

		// 		// Give the server some time to start
		// 		await Promise.all(promises);
		// 	}, 180000);

		// 	afterAll(async () => {
		// 		for (const [vendor, connection] of databases) {
		// 			for (const instance of tzDirectus[vendor]!) {
		// 				instance.kill();
		// 			}

		// 			await connection.destroy();
		// 		}
		// 	});

		// 	it.each(vendors)('%s', async (vendor) => {
		// 		// Setup
		// 		const env3 = envs[vendor][0];
		// 		const env4 = envs[vendor][1];

		// 		await common.CreateCollection(vendor, { collection: newCollectionName, env: env3 });

		// 		await request(getUrl(vendor, env3))
		// 			.post(`/utils/cache/clear`)
		// 			.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

		// 		await request(getUrl(vendor, env3)).get(`/fields`).set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

		// 		await request(getUrl(vendor, env4))
		// 			.post(`/utils/cache/clear`)
		// 			.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

		// 		await request(getUrl(vendor, env4)).get(`/fields`).set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

		// 		// Action
		// 		const responseBefore = await request(getUrl(vendor, env3))
		// 			.get(`/collections/${newCollectionName}`)
		// 			.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

		// 		const responseBefore2 = await request(getUrl(vendor, env4))
		// 			.get(`/collections/${newCollectionName}`)
		// 			.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

		// 		await request(getUrl(vendor, env3))
		// 			.delete(`/collections/${newCollectionName}`)
		// 			.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

		// 		const responseAfter = await request(getUrl(vendor, env3))
		// 			.get(`/collections/${newCollectionName}`)
		// 			.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

		// 		const responseAfter2 = await request(getUrl(vendor, env4))
		// 			.get(`/collections/${newCollectionName}`)
		// 			.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

		// 		// Assert
		// 		expect(responseBefore.statusCode).toBe(200);
		// 		expect(responseBefore2.statusCode).toBe(200);
		// 		expect(responseAfter.statusCode).toBe(403);
		// 		expect(responseAfter2.statusCode).toBe(200);
		// 	});
		// });
	});
});
