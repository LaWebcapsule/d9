import type { Index } from '@wbce-d9/schema';
import type { SchemaOverview } from '@wbce-d9/types';
import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getIndexCapabilities } from '../database/helpers/schema/capabilities.js';
import { getDatabaseClient } from '../database/index.js';
import { ForbiddenException, InvalidPayloadException } from '../exceptions/index.js';
import logger from '../logger.js';
import { renderFilterAsSql } from '../utils/check-constraints.js';
import { IndexesService } from './indexes.js';

const mocks = vi.hoisted(() => ({
	inspector: { indexes: vi.fn() },
	schemaHelper: { createIndex: vi.fn(), dropIndex: vi.fn() },
	createActivity: vi.fn(),
}));

vi.mock('@wbce-d9/schema', () => ({ createInspector: vi.fn(() => mocks.inspector) }));

vi.mock('../database/helpers/index.js', () => ({ getHelpers: vi.fn(() => ({ schema: mocks.schemaHelper })) }));

vi.mock('../database/index.js', () => ({
	default: vi.fn(),
	getDatabaseClient: vi.fn(),
	getSchemaInspector: vi.fn(),
}));

vi.mock('../database/helpers/schema/capabilities.js', () => ({ getIndexCapabilities: vi.fn() }));

vi.mock('../utils/check-constraints.js', () => ({ renderFilterAsSql: vi.fn() }));

vi.mock('./activity.js', () => ({
	ActivityService: class {
		createOne = mocks.createActivity;
	},
}));

vi.mock('../logger.js', () => ({ default: { info: vi.fn(), error: vi.fn() } }));

const PREDICATE = `"status" = 'published'`;

const field = (name: string, type: string) =>
	({
		field: name,
		type,
		alias: false,
		special: [],
		dbType: type,
		defaultValue: null,
		nullable: true,
		generated: false,
		precision: null,
		scale: null,
		note: null,
		validation: null,
	} as any);

const schema: SchemaOverview = {
	collections: {
		articles: {
			collection: 'articles',
			primary: 'id',
			singleton: false,
			sortField: null,
			note: null,
			accountability: 'all',
			fields: {
				id: field('id', 'integer'),
				title: field('title', 'string'),
				status: field('status', 'string'),
			},
		},
	},
	relations: [],
};

const admin = {
	admin: true,
	user: '00000000-0000-4000-8000-000000000000',
	role: '00000000-0000-4000-8000-000000000001',
	ip: '127.0.0.1',
	userAgent: 'vitest',
	origin: 'http://localhost',
	session_id: 'test-session',
} as any;

const db = {} as Knex;

const index = (overrides: Partial<Index> = {}): Index => ({
	name: 'articles_title_index',
	table: 'articles',
	columns: ['title'],
	unique: false,
	primary: false,
	constraint: null,
	method: 'btree',
	partial: false,
	predicate: null,
	included: [],
	expression: false,
	valid: true,
	...overrides,
});

const auditPayload = () => {
	const comment: string = mocks.createActivity.mock.calls[0]![0].comment;
	const [event, ...json] = comment.split(' ');

	return { event, payload: JSON.parse(json.join(' ')) };
};

describe('Services / Indexes', () => {
	let service: IndexesService;

	beforeEach(() => {
		vi.mocked(getDatabaseClient).mockReturnValue('postgres');
		vi.mocked(getIndexCapabilities).mockReturnValue({ supported: true, where: true });
		vi.mocked(renderFilterAsSql).mockReturnValue(PREDICATE);
		mocks.inspector.indexes.mockResolvedValue([]);
		mocks.schemaHelper.createIndex.mockResolvedValue(undefined);
		mocks.schemaHelper.dropIndex.mockResolvedValue(undefined);
		mocks.createActivity.mockResolvedValue(1);

		service = new IndexesService({ knex: db, schema, accountability: admin });
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('access', () => {
		it('forbids non-admin users', async () => {
			const user = new IndexesService({ knex: db, schema, accountability: { admin: false } as any });

			await expect(user.readAll('articles')).rejects.toThrow(ForbiddenException);
			await expect(user.createOne('articles', { columns: ['title'] })).rejects.toThrow(ForbiddenException);
			await expect(user.deleteOne('articles', 'articles_title_index')).rejects.toThrow(ForbiddenException);

			expect(mocks.inspector.indexes).not.toHaveBeenCalled();
			expect(mocks.schemaHelper.createIndex).not.toHaveBeenCalled();
			expect(mocks.schemaHelper.dropIndex).not.toHaveBeenCalled();
		});

		it('allows calls without accountability', async () => {
			const system = new IndexesService({ knex: db, schema, accountability: null });

			await expect(system.readAll('articles')).resolves.toEqual([]);
		});

		it('rejects an unknown collection', async () => {
			await expect(service.readAll('nope')).rejects.toThrow(InvalidPayloadException);
			await expect(service.createOne('nope', { columns: ['title'] })).rejects.toThrow(InvalidPayloadException);
			await expect(service.deleteOne('nope', 'nope_title_index')).rejects.toThrow(InvalidPayloadException);
		});
	});

	describe('capabilities', () => {
		it('exposes the vendor with the capabilities', () => {
			expect(service.capabilities).toEqual({ vendor: 'postgres', supported: true, where: true });
		});

		it('returns no index and refuses writes when the database is not supported', async () => {
			vi.mocked(getIndexCapabilities).mockReturnValue({ supported: false, where: false });

			await expect(service.readAll('articles')).resolves.toEqual([]);
			await expect(service.createOne('articles', { columns: ['title'] })).rejects.toThrow(InvalidPayloadException);
			await expect(service.deleteOne('articles', 'articles_title_index')).rejects.toThrow(InvalidPayloadException);

			expect(mocks.inspector.indexes).not.toHaveBeenCalled();
		});

		it('has no inspector on redshift', async () => {
			vi.mocked(getDatabaseClient).mockReturnValue('redshift');
			vi.mocked(getIndexCapabilities).mockReturnValue({ supported: true, where: false });

			const redshift = new IndexesService({ knex: db, schema, accountability: admin });

			await expect(redshift.readAll('articles')).resolves.toEqual([]);
			expect(mocks.inspector.indexes).not.toHaveBeenCalled();
		});

		it('rejects a partial index when the database does not support it', async () => {
			vi.mocked(getIndexCapabilities).mockReturnValue({ supported: true, where: false });

			await expect(
				service.createOne('articles', { columns: ['title'], where: { status: { _eq: 'published' } } })
			).rejects.toThrow(InvalidPayloadException);

			expect(mocks.schemaHelper.createIndex).not.toHaveBeenCalled();
		});
	});

	describe('readAll', () => {
		it('reads the indexes of the collection sorted by name', async () => {
			mocks.inspector.indexes.mockResolvedValue([
				index({ name: 'articles_status_index', columns: ['status'] }),
				index({ name: 'articles_pkey', columns: ['id'], primary: true, unique: true }),
			]);

			const indexes = await service.readAll('articles');

			expect(mocks.inspector.indexes).toHaveBeenCalledWith('articles');
			expect(indexes.map((item) => item.name)).toEqual(['articles_pkey', 'articles_status_index']);
		});

		it.each([
			['index', index(), 'index', null],
			['primary key', index({ primary: true, unique: true }), 'primary', 'primary_key'],
			['unique constraint', index({ unique: true, constraint: 'unique' }), 'unique_constraint', 'unique'],
			['unique index', index({ unique: true }), 'unique_index', 'unique'],
			['foreign key', index({ constraint: 'foreign_key' }), 'foreign_key_index', 'foreign_key'],
			['expression', index({ expression: true }), 'expression', null],
			['partial', index({ partial: true, predicate: PREDICATE }), 'index', null],
		])('maps a %s', async (_label, raw, kind, reason) => {
			mocks.inspector.indexes.mockResolvedValue([raw]);

			const [item] = await service.readAll('articles');

			expect(item).toEqual({
				name: raw.name,
				columns: raw.columns,
				unique: raw.unique,
				kind,
				partial: raw.partial,
				predicate: raw.predicate,
				deletable: reason === null,
				delete_blocked_reason: reason,
			});
		});
	});

	describe('readOne', () => {
		it('returns the index matching the name', async () => {
			mocks.inspector.indexes.mockResolvedValue([index(), index({ name: 'articles_status_index' })]);

			await expect(service.readOne('articles', 'articles_status_index')).resolves.toMatchObject({
				name: 'articles_status_index',
			});
		});

		it('forbids reading an index that does not exist', async () => {
			await expect(service.readOne('articles', 'articles_missing_index')).rejects.toThrow(ForbiddenException);
		});
	});

	describe('createOne', () => {
		it('creates a plain index with the default name', async () => {
			const name = await service.createOne('articles', { columns: ['title'] });

			expect(name).toBe('articles_title_index');
			expect(mocks.schemaHelper.createIndex).toHaveBeenCalledWith('articles', name, ['title'], undefined);
			expect(renderFilterAsSql).not.toHaveBeenCalled();
		});

		it('keeps composite columns in order', async () => {
			const name = await service.createOne('articles', { columns: ['status', 'title'] });

			expect(name).toBe('articles_status_title_index');
			expect(mocks.schemaHelper.createIndex).toHaveBeenCalledWith('articles', name, ['status', 'title'], undefined);
		});

		it('compiles the filter of a partial index', async () => {
			const where = { status: { _eq: 'published' } };

			await service.createOne('articles', { columns: ['title'], where });

			expect(renderFilterAsSql).toHaveBeenCalledWith(db, schema, 'articles', where);

			expect(mocks.schemaHelper.createIndex).toHaveBeenCalledWith(
				'articles',
				'articles_title_index',
				['title'],
				PREDICATE
			);
		});

		it('accepts a custom name following the <table>_<name>_index convention', async () => {
			const name = await service.createOne('articles', { name: 'articles_custom_index', columns: ['title'] });

			expect(name).toBe('articles_custom_index');
		});

		it.each([
			['an invalid character', 'articles_Custom_index'],
			['a leading digit', '1articles_custom_index'],
			['a name too long', `articles_${'x'.repeat(50)}_index`],
			['a missing table prefix', 'custom_index'],
			['a missing suffix', 'articles_custom'],
			['an empty name', 'articles__index'],
		])('rejects a custom name with %s', async (_label, name) => {
			await expect(service.createOne('articles', { name, columns: ['title'] })).rejects.toThrow(
				InvalidPayloadException
			);

			expect(mocks.schemaHelper.createIndex).not.toHaveBeenCalled();
		});

		it.each([
			['an immutable predicate error', { code: '42P17', message: 'functions must be IMMUTABLE' }],
			['a relation name collision', { code: '42P07', message: 'relation exists' }],
			['a duplicate key name', { code: 'ER_DUP_KEYNAME', message: 'Duplicate key name' }],
			['an "already exists" message', { message: 'index articles_title_index already exists' }],
		])('translates %s into an invalid payload', async (_label, error) => {
			mocks.schemaHelper.createIndex.mockRejectedValue(Object.assign(new Error(error.message), error));

			await expect(service.createOne('articles', { columns: ['title'] })).rejects.toThrow(InvalidPayloadException);
			expect(logger.error).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("Couldn't create index"));
			expect(mocks.createActivity).not.toHaveBeenCalled();
		});

		it('rethrows an unknown database error', async () => {
			const error = new Error('connection lost');
			mocks.schemaHelper.createIndex.mockRejectedValue(error);

			await expect(service.createOne('articles', { columns: ['title'] })).rejects.toBe(error);
		});
	});

	describe('deleteOne', () => {
		it('drops a deletable index', async () => {
			mocks.inspector.indexes.mockResolvedValue([index()]);

			await service.deleteOne('articles', 'articles_title_index');

			expect(mocks.schemaHelper.dropIndex).toHaveBeenCalledWith('articles', 'articles_title_index');
		});

		it('forbids deleting an index that does not exist', async () => {
			await expect(service.deleteOne('articles', 'articles_missing_index')).rejects.toThrow(ForbiddenException);
			expect(mocks.schemaHelper.dropIndex).not.toHaveBeenCalled();
		});

		it.each([
			['a primary key', index({ primary: true, unique: true })],
			['a unique index', index({ unique: true })],
			['a foreign key index', index({ constraint: 'foreign_key' })],
		])('refuses to drop %s', async (_label, raw) => {
			mocks.inspector.indexes.mockResolvedValue([raw]);

			await expect(service.deleteOne('articles', raw.name)).rejects.toThrow(InvalidPayloadException);
			expect(mocks.schemaHelper.dropIndex).not.toHaveBeenCalled();
		});

		it('logs and rethrows a drop error', async () => {
			const error = new Error('drop failed');
			mocks.inspector.indexes.mockResolvedValue([index()]);
			mocks.schemaHelper.dropIndex.mockRejectedValue(error);

			await expect(service.deleteOne('articles', 'articles_title_index')).rejects.toBe(error);
			expect(logger.error).toHaveBeenCalledWith(error, expect.stringContaining("Couldn't delete index"));
			expect(mocks.createActivity).not.toHaveBeenCalled();
		});
	});

	describe('audit', () => {
		it('writes an activity when an index is created', async () => {
			await service.createOne('articles', { columns: ['title'] });

			expect(mocks.createActivity).toHaveBeenCalledWith(
				expect.objectContaining({
					action: 'comment',
					collection: 'directus_collections',
					item: 'articles',
					user: admin.user,
					ip: admin.ip,
					user_agent: admin.userAgent,
					origin: admin.origin,
					session_id: admin.session_id,
				}),
				{ emitEvents: false }
			);

			expect(auditPayload()).toEqual({
				event: 'index.created',
				payload: {
					name: 'articles_title_index',
					collection: 'articles',
					columns: ['title'],
					where: null,
					predicate: null,
					kind: 'index',
					unique: false,
					partial: false,
				},
			});

			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining('index.created: "articles_title_index" on "articles" (title)')
			);
		});

		it('keeps the filter and the predicate of a partial index', async () => {
			const where = { status: { _eq: 'published' } };

			await service.createOne('articles', { columns: ['title'], where });

			expect(auditPayload().payload).toMatchObject({ where, predicate: PREDICATE, partial: true });
		});

		it('writes an activity when an index is deleted', async () => {
			mocks.inspector.indexes.mockResolvedValue([index({ partial: true, predicate: PREDICATE })]);

			await service.deleteOne('articles', 'articles_title_index');

			expect(auditPayload()).toEqual({
				event: 'index.deleted',
				payload: {
					name: 'articles_title_index',
					collection: 'articles',
					columns: ['title'],
					where: null,
					predicate: PREDICATE,
					kind: 'index',
					unique: false,
					partial: true,
				},
			});

			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining('index.deleted: "articles_title_index" on "articles" (title) partial')
			);
		});

		it('keeps the index when the activity cannot be written', async () => {
			mocks.createActivity.mockRejectedValue(new Error('no activity table'));

			await expect(service.createOne('articles', { columns: ['title'] })).resolves.toBe('articles_title_index');
			expect(logger.error).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("Couldn't write"));
		});
	});
});
