import type { Knex } from 'knex';
import knex from 'knex';
import { createTracker, MockClient, Tracker } from 'knex-mock-client';
import { Readable } from 'node:stream';
import type { MockedFunction, MockInstance } from 'vitest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvalidPayloadException } from '../exceptions/index.js';
import { getStorage } from '../storage/index.js';
import { FilesService, ItemsService } from './index.js';

vi.mock('../storage/index.js');

describe('Integration Tests', () => {
	let db: MockedFunction<Knex>;
	let tracker: Tracker;

	beforeAll(() => {
		db = vi.mocked(knex.default({ client: MockClient }));
		tracker = createTracker(db);
	});

	afterEach(() => {
		tracker.reset();
		vi.clearAllMocks();
	});

	describe('Services / Files', () => {
		describe('createOne', () => {
			let service: FilesService;
			let superCreateOne: MockInstance;

			beforeEach(() => {
				service = new FilesService({
					knex: db,
					schema: { collections: {}, relations: [] },
				});

				superCreateOne = vi.spyOn(ItemsService.prototype, 'createOne').mockReturnValue(Promise.resolve(1));
			});

			it('throws InvalidPayloadException when "type" is not provided', async () => {
				try {
					await service.createOne({
						title: 'Test File',
						storage: 'local',
						filename_download: 'test_file',
					});
				} catch (err: any) {
					expect(err).toBeInstanceOf(InvalidPayloadException);
					expect(err.message).toBe('"type" is required');
				}

				expect(superCreateOne).not.toHaveBeenCalled();
			});

			it('creates a file entry when "type" is provided', async () => {
				await service.createOne({
					title: 'Test File',
					storage: 'local',
					filename_download: 'test_file',
					type: 'application/octet-stream',
				});

				expect(superCreateOne).toHaveBeenCalled();
			});
		});

		describe('uploadOne', () => {
			let service: FilesService;
			let superUpdateOne: MockInstance;

			beforeEach(() => {
				service = new FilesService({
					knex: db,
					schema: { collections: {}, relations: [] },
				});

				vi.mocked(getStorage).mockResolvedValue({
					location: () => ({
						list: async function* () {},
						delete: vi.fn(),
						write: vi.fn(),
						stat: vi.fn().mockResolvedValue({ size: 1 }),
						read: vi.fn().mockResolvedValue(Readable.from([])),
					}),
				} as any);

				// A file without embedded metadata, e.g. a PNG screenshot
				vi.spyOn(FilesService.prototype, 'getMetadata').mockResolvedValue({});

				superUpdateOne = vi.spyOn(ItemsService.prototype, 'updateOne').mockResolvedValue(1);
			});

			// uploadOne keeps mutating the payload after each update, so record what was actually sent
			function recordUpdates() {
				const sent: Record<string, unknown>[] = [];

				superUpdateOne.mockImplementation(async (_key, data) => {
					sent.push({ ...data });
					return 1;
				});

				return sent;
			}

			beforeEach(() => {
				tracker.on.select('directus_files').response({ folder: null, filename_download: 'old.png' });
			});

			it('leaves title, description and tags untouched when the new file carries no metadata', async () => {
				const sent = recordUpdates();

				await service.uploadOne(Readable.from([]), { storage: 'local', type: 'image/png' }, 1);

				expect(sent.length).toBeGreaterThan(0);

				for (const payload of sent) {
					expect(payload).not.toHaveProperty('title');
					expect(payload).not.toHaveProperty('description');
					expect(payload).not.toHaveProperty('tags');
				}
			});

			it('takes title, description and tags from the metadata the new file carries', async () => {
				vi.mocked(service.getMetadata).mockResolvedValue({
					title: 'Embedded title',
					description: 'Embedded description',
					tags: ['a', 'b'],
				});

				await service.uploadOne(Readable.from([]), { storage: 'local', type: 'image/png' }, 1);

				expect(superUpdateOne.mock.calls.at(-1)![1]).toMatchObject({
					title: 'Embedded title',
					description: 'Embedded description',
					tags: ['a', 'b'],
				});
			});

			it('lets an uploaded title override embedded metadata', async () => {
				vi.mocked(service.getMetadata).mockResolvedValue({ title: 'Embedded title' });

				await service.uploadOne(Readable.from([]), { storage: 'local', type: 'image/png', title: 'New title' }, 1);

				expect(superUpdateOne.mock.calls.at(-1)![1]).toMatchObject({ title: 'New title' });
			});
		});
	});
});
