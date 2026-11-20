import express, { type ErrorRequestHandler } from 'express';
import { Readable } from 'node:stream';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '../exceptions/forbidden.js';
import type { File } from '../types/index.js';
import router from './assets.js';

vi.mock('../env.js', () => {
	const env = { ASSETS_CACHE_TTL: '30d', PUBLIC_URL: '/' };
	return { default: env, getEnv: () => env };
});

vi.mock('../database/index.js', () => {
	const builder = { select: () => builder, from: () => builder, first: async () => undefined };
	return { default: () => builder };
});

vi.mock('../services/payload.js', () => ({ PayloadService: vi.fn() }));

const { getFile, getAsset, getAssetInfo } = vi.hoisted(() => ({
	getFile: vi.fn(),
	getAsset: vi.fn(),
	getAssetInfo: vi.fn(),
}));

vi.mock('../services/assets.js', () => ({
	AssetsService: class {
		getFile = getFile;
		getAsset = getAsset;
		getAssetInfo = getAssetInfo;
	},
}));

const FILE_ID = 'e536aa35-3a81-4fa9-b856-3780584d38d8';

const file: File = {
	id: FILE_ID,
	storage: 'local',
	filename_disk: 'original.png',
	filename_download: 'original.png',
	title: null,
	type: 'image/png',
	folder: null,
	uploaded_by: null,
	uploaded_on: new Date('2026-01-01T00:00:00.000Z'),
	modified_on: '2026-01-01T00:00:00.000Z',
	charset: null,
	filesize: 7,
	width: 100,
	height: 100,
	duration: null,
	embed: null,
	description: null,
	location: null,
	tags: null,
	metadata: null,
};

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
	res.status(error.status ?? 500).end();
};

const app = express().use('/assets', router).use(errorHandler);

beforeEach(() => {
	vi.clearAllMocks();
	getFile.mockResolvedValue(file);
	getAsset.mockImplementation(async () => ({ stream: Readable.from(['content']), file, stat: { size: 7 } }));
	getAssetInfo.mockResolvedValue({ file, stat: { size: 7 } });
});

async function getValidators() {
	const response = await request(app).get(`/assets/${FILE_ID}`);
	vi.clearAllMocks();

	const { etag, 'last-modified': lastModified } = response.headers;
	if (!etag || !lastModified) throw new Error('The asset was served without validators');

	return { etag, lastModified };
}

describe('GET /assets/:id', () => {
	it('sends the validators with the content', async () => {
		const response = await request(app).get(`/assets/${FILE_ID}`);

		expect(response.statusCode).toBe(200);
		expect(response.headers['etag']).toMatch(/^W\/"[0-9a-f]+"$/);
		expect(response.headers['last-modified']).toBe('Thu, 01 Jan 2026 00:00:00 GMT');
		expect(getAsset).toHaveBeenCalledWith(FILE_ID, {}, undefined);
	});

	it('answers a matching If-None-Match with a 304 without reading the asset', async () => {
		const { etag } = await getValidators();

		const response = await request(app).get(`/assets/${FILE_ID}`).set('If-None-Match', etag);

		expect(response.statusCode).toBe(304);
		expect(response.headers['etag']).toBe(etag);
		expect(response.headers['cache-control']).toBe('public, max-age=2592000');
		expect(getAsset).not.toHaveBeenCalled();
	});

	it('answers a matching If-Modified-Since with a 304 without reading the asset', async () => {
		const { lastModified } = await getValidators();

		const response = await request(app).get(`/assets/${FILE_ID}`).set('If-Modified-Since', lastModified);

		expect(response.statusCode).toBe(304);
		expect(getAsset).not.toHaveBeenCalled();
	});

	it('answers a HEAD with a matching If-None-Match with a 304 without reading the asset', async () => {
		const { etag } = await getValidators();

		const response = await request(app).head(`/assets/${FILE_ID}`).set('If-None-Match', etag);

		expect(response.statusCode).toBe(304);
		expect(getAssetInfo).not.toHaveBeenCalled();
	});

	it('changes the ETag when the file is replaced', async () => {
		const { etag } = await getValidators();
		getFile.mockResolvedValue({ ...file, modified_on: '2026-02-01T00:00:00.000Z', filesize: 8 });

		const response = await request(app).get(`/assets/${FILE_ID}`).set('If-None-Match', etag);

		expect(response.statusCode).toBe(200);
		expect(response.headers['etag']).not.toBe(etag);
	});

	it('keeps refusing a forbidden file whatever the validators', async () => {
		const { etag, lastModified } = await getValidators();
		getFile.mockRejectedValue(new ForbiddenException());

		const response = await request(app)
			.get(`/assets/${FILE_ID}`)
			.set('If-None-Match', etag)
			.set('If-Modified-Since', lastModified);

		expect(response.statusCode).toBe(403);
		expect(response.headers['etag']).toBeUndefined();
	});

	it('drops the validators when the asset cannot be read', async () => {
		getAsset.mockRejectedValue(new ForbiddenException());

		const response = await request(app).get(`/assets/${FILE_ID}`);

		expect(response.statusCode).toBe(403);
		expect(response.headers['etag']).toBeUndefined();
		expect(response.headers['last-modified']).toBeUndefined();
	});
});
