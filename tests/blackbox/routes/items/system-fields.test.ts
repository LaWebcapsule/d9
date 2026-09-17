import request from 'supertest';
import { getUrl, paths } from '@common/config.ts';
import vendors from '@common/get-dbs-to-test.ts';
import { PRIMARY_KEY_TYPES, USER } from '@common/variables.ts';
import { createReadStream } from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { collection, seedDBValues } from './system-fields.seed.ts';

let isSeeded = false;

beforeAll(async () => {
	isSeeded = await seedDBValues();
}, 300000);

test('Seed Database Values', () => {
	expect(isSeeded).toStrictEqual(true);
});

const FORGED_DATE = '1999-01-01T00:00:00.000Z';
const FORGED_USER = '00000000-0000-4000-8000-000000000000';

describe.each(PRIMARY_KEY_TYPES)('/items', (pkType) => {
	const localCollection = `${collection}_${pkType}`;

	describe(`pkType: ${pkType}`, () => {
		describe(`POST /${localCollection}`, () => {
			if (pkType === 'integer') {
				describe('rejects a client-supplied primary key on an auto-increment collection', () => {
					it.each(vendors)('%s', async (vendor) => {
						// Action
						const response = await request(getUrl(vendor))
							.post(`/items/${localCollection}`)
							.send({ id: 999999, string_field: uuid() })
							.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

						// Assert — admins are deliberately not exempt
						expect(response.statusCode).toEqual(403);
					});
				});

				describe('rejects a client-supplied primary key in a batch create', () => {
					it.each(vendors)('%s', async (vendor) => {
						// Action
						const response = await request(getUrl(vendor))
							.post(`/items/${localCollection}`)
							.send([{ string_field: uuid() }, { id: 999998, string_field: uuid() }])
							.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

						// Assert
						expect(response.statusCode).toEqual(403);
					});
				});
			} else {
				describe('accepts a client-supplied primary key on a manual-key collection', () => {
					it.each(vendors)('%s', async (vendor) => {
						// Setup
						const id = uuid();

						// Action
						const response = await request(getUrl(vendor))
							.post(`/items/${localCollection}`)
							.send({ id, string_field: uuid() })
							.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

						// Assert
						expect(response.statusCode).toEqual(200);
						expect(response.body.data.id).toBe(id);
					});
				});
			}

			describe('ignores forged date_updated / user_updated on create', () => {
				it.each(vendors)('%s', async (vendor) => {
					// Action
					const response = await request(getUrl(vendor))
						.post(`/items/${localCollection}`)
						.send({
							id: pkType === 'integer' ? undefined : uuid(),
							string_field: uuid(),
							date_updated: FORGED_DATE,
							user_updated: FORGED_USER,
						})
						.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

					// Assert — the request succeeds, the forged values are simply not stored
					expect(response.statusCode).toEqual(200);
					expect(response.body.data.date_updated).toBeNull();
					expect(response.body.data.user_updated).toBeNull();

					// date_created is still generated server-side
					expect(response.body.data.date_created).not.toBeNull();
					expect(response.body.data.user_created).not.toBe(FORGED_USER);
				});
			});

			describe('ignores forged date_created / user_created on create', () => {
				it.each(vendors)('%s', async (vendor) => {
					// Action
					const response = await request(getUrl(vendor))
						.post(`/items/${localCollection}`)
						.send({
							id: pkType === 'integer' ? undefined : uuid(),
							string_field: uuid(),
							date_created: FORGED_DATE,
							user_created: FORGED_USER,
						})
						.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

					// Assert — overwritten by the server, as it already was before this change
					expect(response.statusCode).toEqual(200);
					expect(new Date(response.body.data.date_created).getTime()).toBeGreaterThan(new Date(FORGED_DATE).getTime());
					expect(response.body.data.user_created).not.toBe(FORGED_USER);
				});
			});
		});

		describe(`PATCH /${localCollection}/:id`, () => {
			describe('ignores forged date_created / user_created on update', () => {
				it.each(vendors)('%s', async (vendor) => {
					// Setup
					const created = await request(getUrl(vendor))
						.post(`/items/${localCollection}`)
						.send({ id: pkType === 'integer' ? undefined : uuid(), string_field: uuid() })
						.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

					const { id, date_created, user_created } = created.body.data;

					// Action
					const response = await request(getUrl(vendor))
						.patch(`/items/${localCollection}/${id}`)
						.send({ string_field: uuid(), date_created: FORGED_DATE, user_created: FORGED_USER })
						.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

					// Assert — the update goes through, the audit fields keep their original values
					expect(response.statusCode).toEqual(200);
					expect(response.body.data.date_created).toBe(date_created);
					expect(response.body.data.user_created).toBe(user_created);

					// date_updated is still generated server-side
					expect(response.body.data.date_updated).not.toBeNull();
					expect(response.body.data.user_updated).not.toBe(FORGED_USER);
				});
			});
		});
	});
});

describe('/files', () => {
	const imageFilePath = path.join(paths.cwd, 'assets', 'directus.png');

	describe('POST /files rejects forged file metadata', () => {
		it.each(vendors)('%s', async (vendor) => {
			// Action
			const response = await request(getUrl(vendor))
				.post('/files')
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
				.field('storage', 'local')
				.field('filesize', '1')
				.attach('file', createReadStream(imageFilePath));

			// Assert
			expect(response.statusCode).toEqual(403);
		});
	});

	describe('PATCH /files/:id rejects forged file metadata', () => {
		it.each(vendors)('%s', async (vendor) => {
			// Setup
			const uploaded = await request(getUrl(vendor))
				.post('/files')
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
				.field('storage', 'local')
				.attach('file', createReadStream(imageFilePath));

			expect(uploaded.statusCode).toEqual(200);

			// Action
			const response = await request(getUrl(vendor))
				.patch(`/files/${uploaded.body.data.id}`)
				.send({ filesize: 1, width: 1 })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			// Assert
			expect(response.statusCode).toEqual(403);
		});
	});

	describe('PATCH /files/:id still allows editing user-owned fields', () => {
		it.each(vendors)('%s', async (vendor) => {
			// Setup
			const uploaded = await request(getUrl(vendor))
				.post('/files')
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
				.field('storage', 'local')
				.attach('file', createReadStream(imageFilePath));

			expect(uploaded.statusCode).toEqual(200);

			// Action
			const response = await request(getUrl(vendor))
				.patch(`/files/${uploaded.body.data.id}`)
				.send({ title: 'A new title' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			// Assert — the lock must not turn every file edit into a 403
			expect(response.statusCode).toEqual(200);
			expect(response.body.data.title).toBe('A new title');
		});
	});
});

describe('/activity', () => {
	describe('POST /activity/comment still works', () => {
		it.each(vendors)('%s', async (vendor) => {
			// Setup
			const localCollection = `${collection}_integer`;

			const created = await request(getUrl(vendor))
				.post(`/items/${localCollection}`)
				.send({ string_field: uuid() })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			// Action
			const response = await request(getUrl(vendor))
				.post('/activity/comment')
				.send({ collection: localCollection, item: String(created.body.data.id), comment: 'A comment' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			// Assert — directus_activity is deliberately left unlocked, the router already restricts it
			expect(response.statusCode).toEqual(200);
		});
	});
});
