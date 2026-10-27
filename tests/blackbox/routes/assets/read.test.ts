import { getUrl, paths } from '@common/config.ts';
import vendors from '@common/get-dbs-to-test.ts';
import { USER } from '@common/variables.ts';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'path';
import request from 'supertest';

const assetsDirectory = [paths.cwd, 'assets'];
const storages = ['local', 'minio'];

const imageFile = {
	name: 'directus.png',
	type: 'image/png',
	filesize: '7136',
};

const imageFilePath = join(...assetsDirectory, imageFile.name);

describe('/assets', () => {
	describe('GET /assets/:id', () => {
		describe.each(storages)('Storage: %s', (storage) => {
			it.each(vendors)('%s', async (vendor) => {
				// Setup
				const insertResponse = await request(getUrl(vendor))
					.post('/files')
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.field('storage', storage)
					.attach('file', createReadStream(imageFilePath));

				// Action
				const response = await request(getUrl(vendor))
					.get(`/assets/${insertResponse.body.data.id}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				// Assert
				expect(response.statusCode).toBe(200);
				expect(response.headers['content-type']).toBe(imageFile.type);
				expect(response.headers['content-length']).toBe(imageFile.filesize);
				expect(Buffer.compare(response.body, await readFile(imageFilePath))).toBe(0);
			});
		});
	});

	describe('HEAD /assets/:id', () => {
		describe.each(storages)('Storage: %s', (storage) => {
			it.each(vendors)('%s', async (vendor) => {
				// Setup
				const insertResponse = await request(getUrl(vendor))
					.post('/files')
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.field('storage', storage)
					.attach('file', createReadStream(imageFilePath));

				// Action
				const response = await request(getUrl(vendor))
					.head(`/assets/${insertResponse.body.data.id}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

				// Assert
				expect(response.statusCode).toBe(200);
				expect(response.headers['content-type']).toBe(imageFile.type);
				expect(response.headers['content-length']).toBe(imageFile.filesize);
				expect(response.headers['accept-ranges']).toBe('bytes');
				expect(response.text).toBeUndefined();
			});
		});
	});

	describe('HEAD /assets/:id with Range', () => {
		describe.each(storages)('Storage: %s', (storage) => {
			it.each(vendors)('%s', async (vendor) => {
				// Setup
				const insertResponse = await request(getUrl(vendor))
					.post('/files')
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.field('storage', storage)
					.attach('file', createReadStream(imageFilePath));

				// Action
				const response = await request(getUrl(vendor))
					.head(`/assets/${insertResponse.body.data.id}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.set('Range', 'bytes=0-9');

				// Assert
				expect(response.statusCode).toBe(206);
				expect(response.headers['content-type']).toBe(imageFile.type);
				expect(response.headers['content-range']).toBe(`bytes 0-9/${imageFile.filesize}`);
				expect(response.headers['content-length']).toBe('10');
				expect(response.headers['accept-ranges']).toBe('bytes');
				expect(response.text).toBeUndefined();
			});
		});
	});
});
