import type { Knex } from 'knex';
import knex from 'knex';
import { MockClient, Tracker, createTracker } from 'knex-mock-client';
import type { MockedFunction } from 'vitest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDatabaseClient } from '../../src/database/index.js';
import { ItemsService, PayloadService } from '../../src/services/index.js';
import { ForbiddenException } from '../exceptions/index.js';

vi.mock('../env', async () => {
	const actual = (await vi.importActual('../env')) as { default: Record<string, any> };

	const MOCK_ENV = {
		...actual.default,
		CACHE_AUTO_PURGE: true,
	};

	return {
		default: MOCK_ENV,
		getEnv: () => MOCK_ENV,
	};
});

vi.mock('../../src/database/index', () => ({
	default: vi.fn(),
	getDatabaseClient: vi.fn(),
}));

vi.mock('../cache', () => ({
	getCache: vi.fn().mockReturnValue({
		cache: { clear: vi.fn() },
		systemCache: { clear: vi.fn() },
	}),
}));

const field = (overrides: Record<string, any>) => ({
	defaultValue: null,
	nullable: true,
	generated: false,
	type: 'string',
	dbType: 'varchar',
	precision: null,
	scale: null,
	special: [],
	note: null,
	alias: false,
	validation: null,
	...overrides,
});

const collection = (name: string, primary: string, fields: Record<string, any>) => ({
	collection: name,
	primary,
	singleton: false,
	note: null,
	sortField: null,
	accountability: null,
	fields,
});

// `articles` has a serial primary key and the four audit fields; `pages` has a manual string key
const schema: any = {
	collections: {
		articles: collection('articles', 'id', {
			id: field({ field: 'id', type: 'integer', dbType: 'integer', defaultValue: 'AUTO_INCREMENT', nullable: false }),
			title: field({ field: 'title' }),
			date_created: field({ field: 'date_created', type: 'timestamp', special: ['date-created'] }),
			user_created: field({ field: 'user_created', type: 'uuid', special: ['user-created'] }),
			date_updated: field({ field: 'date_updated', type: 'timestamp', special: ['date-updated'] }),
			user_updated: field({ field: 'user_updated', type: 'uuid', special: ['user-updated'] }),
			filesize: field({ field: 'filesize', type: 'integer', special: ['system-generated'] }),
		}),
		pages: collection('pages', 'id', {
			id: field({ field: 'id', nullable: false }),
			title: field({ field: 'title' }),
		}),
		// A non-nullable date_updated with no default: dropping the key on create would fail the INSERT
		strict: collection('strict', 'id', {
			id: field({ field: 'id', type: 'integer', defaultValue: 'AUTO_INCREMENT', nullable: false }),
			title: field({ field: 'title' }),
			date_updated: field({ field: 'date_updated', type: 'timestamp', special: ['date-updated'], nullable: false }),
		}),
	},
	relations: [],
};

const admin = { role: 'admin', admin: true, user: 'c0ffee00-0000-4000-8000-000000000000' };

describe('Immutable system fields', () => {
	let db: MockedFunction<Knex>;
	let tracker: Tracker;

	beforeAll(() => {
		db = vi.mocked(knex.default({ client: MockClient }));
		tracker = createTracker(db);
	});

	beforeEach(() => {
		vi.mocked(getDatabaseClient).mockReturnValue('postgres');
	});

	afterEach(() => {
		tracker.reset();
		vi.clearAllMocks();
	});

	describe('primary key lock', () => {
		it('rejects a client-supplied primary key on an auto-increment collection, even for an admin', async () => {
			const service = new ItemsService('articles', { knex: db, accountability: admin, schema });

			tracker.on.insert('articles').response({ id: 1 });

			await expect(service.createOne({ id: 42, title: 'x' }, { emitEvents: false })).rejects.toBeInstanceOf(
				ForbiddenException
			);

			expect(tracker.history.insert.length).toBe(0);
		});

		it('allows a client-supplied primary key on a manual (non auto-increment) collection', async () => {
			const service = new ItemsService('pages', { knex: db, accountability: admin, schema });

			tracker.on.insert('pages').response([{ id: 'about' }]);

			await expect(service.createOne({ id: 'about', title: 'x' }, { emitEvents: false })).resolves.toBe('about');
		});

		it('allows creating without a primary key on an auto-increment collection', async () => {
			const service = new ItemsService('articles', { knex: db, accountability: admin, schema });

			tracker.on.insert('articles').response([{ id: 1 }]);

			await expect(service.createOne({ title: 'x' }, { emitEvents: false })).resolves.toBe(1);
		});

		it('allows an internal caller with no accountability to supply a primary key', async () => {
			const service = new ItemsService('articles', { knex: db, schema });

			tracker.on.insert('articles').response([{ id: 42 }]);

			await expect(service.createOne({ id: 42, title: 'x' }, { emitEvents: false })).resolves.toBe(42);
		});
	});

	describe('generated audit fields', () => {
		const payloadService = () => new PayloadService('articles', { knex: db, schema, accountability: admin });

		it('drops date_created / user_created from an update payload', async () => {
			const result = await payloadService().processValues('update', {
				title: 'x',
				date_created: '1999-01-01T00:00:00Z',
				user_created: 'dead0000-0000-4000-8000-000000000000',
			});

			expect(result).not.toHaveProperty('date_created');
			expect(result).not.toHaveProperty('user_created');
			expect(result['title']).toBe('x');
		});

		it('drops date_updated / user_updated from a create payload', async () => {
			const result = await payloadService().processValues('create', {
				title: 'x',
				date_updated: '1999-01-01T00:00:00Z',
				user_updated: 'dead0000-0000-4000-8000-000000000000',
			});

			expect(result).not.toHaveProperty('date_updated');
			expect(result).not.toHaveProperty('user_updated');
		});

		it('still generates date_created / user_created on create', async () => {
			const result = await payloadService().processValues('create', { title: 'x' });

			expect(result['user_created']).toBe(admin.user);
			expect(result['date_created']).toBeInstanceOf(Date);
		});

		it('still generates date_updated / user_updated on update', async () => {
			const result = await payloadService().processValues('update', { title: 'x' });

			expect(result['user_updated']).toBe(admin.user);
			expect(result['date_updated']).toBeInstanceOf(Date);
		});

		it('keeps a non-nullable date_updated on create rather than breaking the INSERT', async () => {
			const service = new PayloadService('strict', { knex: db, schema, accountability: admin });

			const result = await service.processValues('create', { title: 'x', date_updated: '1999-01-01T00:00:00Z' });

			// The column has no default, so dropping the key would raise a NOT NULL violation. Keeping the
			// submitted value preserves the pre-existing behaviour instead of turning it into a 500.
			expect(result).toHaveProperty('date_updated');
		});

		it('leaves read payloads untouched', async () => {
			const result = await payloadService().processValues('read', {
				title: 'x',
				date_created: '1999-01-01T00:00:00Z',
				user_updated: 'dead0000-0000-4000-8000-000000000000',
			});

			// the date is reformatted by processDates on read; what matters is that neither key was dropped
			expect(result).toHaveProperty('date_created');
			expect(result['user_updated']).toBe('dead0000-0000-4000-8000-000000000000');
		});
	});

	describe('system-generated special', () => {
		it('rejects a write to a system-generated field, including a falsy one', async () => {
			const service = new PayloadService('articles', { knex: db, schema, accountability: admin });

			await expect(service.processValues('create', { title: 'x', filesize: 0 })).rejects.toBeInstanceOf(
				ForbiddenException
			);

			await expect(service.processValues('update', { title: 'x', filesize: 999 })).rejects.toBeInstanceOf(
				ForbiddenException
			);
		});

		it('allows an internal caller with no accountability to write it', async () => {
			const service = new PayloadService('articles', { knex: db, schema });

			await expect(service.processValues('create', { title: 'x', filesize: 999 })).resolves.toHaveProperty(
				'filesize',
				999
			);
		});

		it('does not block reading it', async () => {
			const service = new PayloadService('articles', { knex: db, schema, accountability: admin });

			await expect(service.processValues('read', { filesize: 999 })).resolves.toHaveProperty('filesize', 999);
		});
	});
});
