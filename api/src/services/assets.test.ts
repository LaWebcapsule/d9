import type { Knex } from 'knex';
import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getStorage } from '../storage/index.js';
import { AssetsService } from './assets.js';

vi.mock('../storage/index.js');
vi.mock('./authorization.js');

vi.mock('../env.js', () => {
	const env = {
		ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION: 6000,
		ASSETS_TRANSFORM_MAX_CONCURRENT: 25,
		ASSETS_TRANSFORM_TIMEOUT: '7500ms',
		ASSETS_INVALID_IMAGE_SENSITIVITY_LEVEL: 'warning',
	};

	return { default: env, getEnv: () => env };
});

const FILE_ID = 'e536aa35-3a81-4fa9-b856-3780584d38d8';

const file = {
	id: FILE_ID,
	storage: 'local',
	filename_disk: 'original.png',
	type: 'image/png',
	filesize: 100,
	width: 100,
	height: 100,
	modified_on: '2026-01-01T00:00:00.000Z',
};

let storage: {
	read: ReturnType<typeof vi.fn>;
	exists: ReturnType<typeof vi.fn>;
	stat: ReturnType<typeof vi.fn>;
	write: ReturnType<typeof vi.fn>;
};

let service: AssetsService;

beforeEach(() => {
	storage = {
		read: vi.fn().mockResolvedValue(Readable.from(['content'])),
		exists: vi.fn().mockResolvedValue(true),
		stat: vi.fn().mockResolvedValue({ size: 100 }),
		write: vi.fn().mockResolvedValue(undefined),
	};

	vi.mocked(getStorage).mockResolvedValue({ location: () => storage } as any);

	const builder = {
		select: vi.fn(),
		from: vi.fn(),
		where: vi.fn(),
		first: vi
			.fn()
			.mockResolvedValueOnce({ project_logo: null, public_background: null, public_foreground: null })
			.mockResolvedValueOnce(file),
	};

	builder.select.mockReturnValue(builder);
	builder.from.mockReturnValue(builder);
	builder.where.mockReturnValue(builder);

	service = new AssetsService({
		knex: builder as unknown as Knex,
		accountability: { admin: true } as any,
		schema: { collections: {}, relations: [] },
	});
});

describe('AssetsService.getAsset', () => {
	it('rejects a malformed transformation before opening the storage stream', async () => {
		storage.exists.mockImplementation(async (filename: string) => filename === 'original.png');

		await expect(service.getAsset(FILE_ID, { height: 'XYZ' as any })).rejects.toThrow(/height/i);

		expect(storage.read).not.toHaveBeenCalled();
	});

	it('still opens the storage stream for a GET', async () => {
		const { stream } = await service.getAsset(FILE_ID, {});

		expect(storage.read).toHaveBeenCalledWith('original.png', undefined);
		expect(stream).toBeInstanceOf(Readable);
	});

	it('destroys the source stream when the transformation write fails', async () => {
		const source = new Readable({ read() {} });
		const destroy = vi.spyOn(source, 'destroy');

		storage.exists.mockImplementation(async (filename: string) => filename === 'original.png');
		storage.read.mockResolvedValue(source);
		storage.write.mockRejectedValue(new Error('write failed'));

		await expect(service.getAsset(FILE_ID, { width: 100 })).rejects.toThrow('write failed');

		expect(destroy).toHaveBeenCalled();
	});
});

describe('AssetsService.getAssetInfo', () => {
	it('returns the metadata without opening the storage stream', async () => {
		const info = await service.getAssetInfo(FILE_ID, {});

		expect(storage.read).not.toHaveBeenCalled();
		expect(info).toEqual({ file, stat: { size: 100 } });
	});
});
