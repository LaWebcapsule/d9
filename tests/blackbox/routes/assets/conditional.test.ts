import { describe, expect, it } from 'vitest';
import { getUrl, paths } from '@common/config.ts';
import vendors from '@common/get-dbs-to-test.ts';
import { USER } from '@common/variables.ts';
import { createReadStream } from 'node:fs';
import { join } from 'path';
import request from 'supertest';

const storages = ['local', 'minio'];

const imageFilePath = join(paths.cwd, 'assets', 'directus.png');

async function uploadImage(vendor: string, storage: string): Promise<string> {
	const response = await request(getUrl(vendor))
		.post('/files')
		.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
		.field('storage', storage)
		.attach('file', createReadStream(imageFilePath));

	return response.body.data.id;
}

describe('/assets conditional requests', () => {
	describe('GET /assets/:id', () => {
		describe.each(storages)('Storage: %s', (storage) => {
			it.each(vendors)('%s', async (vendor) => {
				// Setup
				const id = await uploadImage(vendor, storage);

				// Action
				const response = await request(getUrl(vendor))
					.get(`/assets/${id}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				// Assert
				expect(response.statusCode).toBe(200);
				expect(response.headers['etag']).toMatch(/^W\/"[0-9a-f]+"$/);
				expect(Number.isNaN(Date.parse(response.headers['last-modified']))).toBe(false);
			});
		});
	});

	describe('GET /assets/:id with a matching If-None-Match', () => {
		describe.each(storages)('Storage: %s', (storage) => {
			it.each(vendors)('%s', async (vendor) => {
				// Setup
				const id = await uploadImage(vendor, storage);

				const initial = await request(getUrl(vendor))
					.get(`/assets/${id}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				// Action
				const response = await request(getUrl(vendor))
					.get(`/assets/${id}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.set('If-None-Match', initial.headers['etag']);

				// Assert
				expect(response.statusCode).toBe(304);
				expect(response.headers['etag']).toBe(initial.headers['etag']);
				expect(response.headers['cache-control']).toBe(initial.headers['cache-control']);
				expect(response.headers['vary']).toBe(initial.headers['vary']);
				expect(response.headers['content-length']).toBeUndefined();
			});
		});
	});

	describe('GET /assets/:id with a matching If-Modified-Since', () => {
		describe.each(storages)('Storage: %s', (storage) => {
			it.each(vendors)('%s', async (vendor) => {
				// Setup
				const id = await uploadImage(vendor, storage);

				const initial = await request(getUrl(vendor))
					.get(`/assets/${id}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				// Action
				const response = await request(getUrl(vendor))
					.get(`/assets/${id}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.set('If-Modified-Since', initial.headers['last-modified']);

				// Assert
				expect(response.statusCode).toBe(304);
			});
		});
	});

	describe('HEAD /assets/:id with a matching If-None-Match', () => {
		describe.each(storages)('Storage: %s', (storage) => {
			it.each(vendors)('%s', async (vendor) => {
				// Setup
				const id = await uploadImage(vendor, storage);

				const initial = await request(getUrl(vendor))
					.head(`/assets/${id}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				// Action
				const response = await request(getUrl(vendor))
					.head(`/assets/${id}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.set('If-None-Match', initial.headers['etag']);

				// Assert
				expect(response.statusCode).toBe(304);
			});
		});
	});

	describe('GET /assets/:id after the file is replaced', () => {
		describe.each(storages)('Storage: %s', (storage) => {
			it.each(vendors)('%s', async (vendor) => {
				// Setup
				const id = await uploadImage(vendor, storage);

				const initial = await request(getUrl(vendor))
					.get(`/assets/${id}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				await request(getUrl(vendor))
					.patch(`/files/${id}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.attach('file', createReadStream(join(paths.cwd, 'assets', 'layers.png')));

				// Action
				const response = await request(getUrl(vendor))
					.get(`/assets/${id}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.set('If-None-Match', initial.headers['etag'])
					.set('If-Modified-Since', initial.headers['last-modified']);

				// Assert
				expect(response.statusCode).toBe(200);
				expect(response.headers['etag']).not.toBe(initial.headers['etag']);
			});
		});
	});

	describe('GET /assets/:id without permission and a valid ETag', () => {
		describe.each(storages)('Storage: %s', (storage) => {
			it.each(vendors)('%s', async (vendor) => {
				// Setup
				const id = await uploadImage(vendor, storage);

				const initial = await request(getUrl(vendor))
					.get(`/assets/${id}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				// Action
				const response = await request(getUrl(vendor))
					.get(`/assets/${id}`)
					.set('If-None-Match', initial.headers['etag'])
					.set('If-Modified-Since', initial.headers['last-modified']);

				// Assert
				expect(response.statusCode).toBe(403);
				expect(response.headers['etag']).not.toBe(initial.headers['etag']);
			});
		});
	});

	describe('GET /assets/:id with a stale If-None-Match', () => {
		describe.each(storages)('Storage: %s', (storage) => {
			it.each(vendors)('%s', async (vendor) => {
				// Setup
				const id = await uploadImage(vendor, storage);

				const initial = await request(getUrl(vendor))
					.get(`/assets/${id}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				// Action
				const response = await request(getUrl(vendor))
					.get(`/assets/${id}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.set('If-None-Match', 'W/"stale"')
					.set('If-Modified-Since', initial.headers['last-modified']);

				// Assert
				expect(response.statusCode).toBe(200);
			});
		});
	});

	describe('GET /assets/:id with a transformation', () => {
		describe.each(storages)('Storage: %s', (storage) => {
			it.each(vendors)('%s', async (vendor) => {
				// Setup
				const id = await uploadImage(vendor, storage);

				const original = await request(getUrl(vendor))
					.get(`/assets/${id}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				// Action
				const response = await request(getUrl(vendor))
					.get(`/assets/${id}?width=10`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.set('If-None-Match', original.headers['etag']);

				// Assert
				expect(response.statusCode).toBe(200);
				expect(response.headers['etag']).not.toBe(original.headers['etag']);
			});
		});
	});
});
