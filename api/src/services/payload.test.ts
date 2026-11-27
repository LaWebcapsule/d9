import type { FieldOverview, SchemaOverview } from '@wbce-d9/types';
import type { Knex } from 'knex';
import knex from 'knex';
import { MockClient, Tracker, createTracker } from 'knex-mock-client';
import type { MockedFunction } from 'vitest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Helpers } from '../../src/database/helpers/index.js';
import { getHelpers } from '../../src/database/helpers/index.js';
import { PayloadService } from '../../src/services/index.js';

vi.mock('../../src/database/index', () => ({
	getDatabaseClient: vi.fn().mockReturnValue('postgres'),
}));

describe('Integration Tests', () => {
	let db: MockedFunction<Knex>;
	let tracker: Tracker;

	beforeAll(async () => {
		db = vi.mocked(knex.default({ client: MockClient }));
		tracker = createTracker(db);
	});

	afterEach(() => {
		tracker.reset();
	});

	describe('Services / PayloadService', () => {
		describe('transformers', () => {
			let service: PayloadService;
			let helpers: Helpers;

			beforeEach(() => {
				service = new PayloadService('test', {
					knex: db,
					schema: { collections: {}, relations: [] },
				});

				helpers = getHelpers(db);
			});

			describe('hash', () => {
				it('Returns a concealed value on read, like conceal', async () => {
					const result = await service.transformers['hash']!({
						value: '$argon2id$v=19$m=65536,t=3,p=4$hash',
						action: 'read',
						payload: {},
						accountability: null,
						specials: ['hash'],
						helpers,
					});

					expect(result).toBe('**********');
				});

				it('Leaves empty values as is', async () => {
					const result = await service.transformers['hash']!({
						value: null,
						action: 'read',
						payload: {},
						accountability: null,
						specials: ['hash'],
						helpers,
					});

					expect(result).toBe(undefined);
				});
			});

			describe('csv', () => {
				it('Returns undefined for illegal values', async () => {
					const result = await service.transformers['cast-csv']!({
						value: 123,
						action: 'read',
						payload: {},
						accountability: { role: null },
						specials: [],
						helpers,
					});

					expect(result).toBe(undefined);
				});

				it('Returns [] for empty strings', async () => {
					const result = await service.transformers['cast-csv']!({
						value: '',
						action: 'read',
						payload: {},
						accountability: { role: null },
						specials: [],
						helpers,
					});

					expect(result).toMatchObject([]);
				});

				it('Returns array values as is', async () => {
					const result = await service.transformers['cast-csv']!({
						value: ['test', 'directus'],
						action: 'read',
						payload: {},
						accountability: { role: null },
						specials: [],
						helpers,
					});

					expect(result).toEqual(['test', 'directus']);
				});

				it('Splits the CSV string', async () => {
					const result = await service.transformers['cast-csv']!({
						value: 'test,directus',
						action: 'read',
						payload: {},
						accountability: { role: null },
						specials: [],
						helpers,
					});

					expect(result).toMatchObject(['test', 'directus']);
				});

				it('Saves array values as joined string', async () => {
					const result = await service.transformers['cast-csv']!({
						value: ['test', 'directus'],
						action: 'create',
						payload: {},
						accountability: { role: null },
						specials: [],
						helpers,
					});

					expect(result).toBe('test,directus');
				});

				it('Saves string values as is', async () => {
					const result = await service.transformers['cast-csv']!({
						value: 'test,directus',
						action: 'create',
						payload: {},
						accountability: { role: null },
						specials: [],
						helpers,
					});

					expect(result).toBe('test,directus');
				});
			});
		});

		describe('processDates', () => {
			let service: PayloadService;

			const dateFieldId = 'date_field';
			const dateTimeFieldId = 'datetime_field';
			const timestampFieldId = 'timestamp_field';

			beforeEach(() => {
				service = new PayloadService('test', {
					knex: db,
					schema: {
						collections: {
							test: {
								collection: 'test',
								primary: 'id',
								singleton: false,
								sortField: null,
								note: null,
								accountability: null,
								fields: {
									[dateFieldId]: {
										field: dateFieldId,
										defaultValue: null,
										nullable: true,
										generated: false,
										type: 'date',
										dbType: 'date',
										precision: null,
										scale: null,
										special: [],
										note: null,
										validation: null,
										alias: false,
									},
									[dateTimeFieldId]: {
										field: dateTimeFieldId,
										defaultValue: null,
										nullable: true,
										generated: false,
										type: 'dateTime',
										dbType: 'datetime',
										precision: null,
										scale: null,
										special: [],
										note: null,
										validation: null,
										alias: false,
									},
									[timestampFieldId]: {
										field: timestampFieldId,
										defaultValue: null,
										nullable: true,
										generated: false,
										type: 'timestamp',
										dbType: 'timestamp',
										precision: null,
										scale: null,
										special: [],
										note: null,
										validation: null,
										alias: false,
									},
								},
							},
						},
						relations: [],
					},
				});
			});

			describe('processes dates', () => {
				it('with zero values', () => {
					const result = service.processDates(
						[
							{
								[dateFieldId]: '0000-00-00',
								[dateTimeFieldId]: '0000-00-00 00:00:00',
								[timestampFieldId]: '0000-00-00 00:00:00.000',
							},
						],
						'read'
					);

					expect(result).toMatchObject([
						{
							[dateFieldId]: null,
							[dateTimeFieldId]: null,
							[timestampFieldId]: null,
						},
					]);
				});

				it('with typical values', () => {
					const result = service.processDates(
						[
							{
								[dateFieldId]: '2022-01-10',
								[dateTimeFieldId]: '2021-09-31 12:34:56',
								[timestampFieldId]: '1980-12-08 00:11:22.333',
							},
						],
						'read'
					);

					expect(result).toMatchObject([
						{
							[dateFieldId]: '2022-01-10',
							[dateTimeFieldId]: '2021-10-01T12:34:56',
							[timestampFieldId]: new Date('1980-12-08 00:11:22.333').toISOString(),
						},
					]);
				});

				it('with date object values', () => {
					const result = service.processDates(
						[
							{
								[dateFieldId]: new Date(1666777777000),
								[dateTimeFieldId]: new Date(1666666666000),
								[timestampFieldId]: new Date(1666555444333),
							},
						],
						'read'
					);

					expect(result).toMatchObject([
						{
							[dateFieldId]: toLocalISOString(new Date(1666777777000)).slice(0, 10),
							[dateTimeFieldId]: toLocalISOString(new Date(1666666666000)),
							[timestampFieldId]: new Date(1666555444333).toISOString(),
						},
					]);
				});
			});
		});

		describe('processValues', () => {
			let service: PayloadService;

			const hashedField = 'password';
			const stringField = 'string';
			const HASHED_SECURITY = '**********';

			beforeEach(() => {
				service = new PayloadService('test', {
					knex: db,
					schema: {
						collections: {
							test: {
								collection: 'test',
								primary: 'id',
								singleton: false,
								sortField: null,
								note: null,
								accountability: null,
								fields: {
									[hashedField]: {
										field: hashedField,
										defaultValue: null,
										nullable: true,
										generated: false,
										type: 'hash',
										dbType: 'nvarchar',
										precision: null,
										scale: null,
										special: ['hash', 'conceal'],
										note: null,
										validation: null,
										alias: false,
									},
									[stringField]: {
										field: stringField,
										defaultValue: null,
										nullable: true,
										generated: false,
										type: 'string',
										dbType: 'nvarchar',
										precision: null,
										scale: null,
										special: [],
										note: null,
										validation: null,
										alias: false,
									},
								},
							},
						},
						relations: [],
					},
				});
			});

			it('processing special fields', async () => {
				const result = await service.processValues('read', {
					string: 'clear-value',
					password: 'secret-value',
				});

				expect(result).toMatchObject({ string: 'clear-value', password: HASHED_SECURITY });
			});

			it('processing aliassed special fields', async () => {
				const result = await service.processValues(
					'read',
					{
						other_string: 'clear-value',
						other_password: 'secret-value',
					},
					{ other_string: 'string', other_password: 'password' }
				);

				expect(result).toMatchObject({ other_string: 'clear-value', other_password: HASHED_SECURITY });
			});
		});

		describe('processO2M', () => {
			const PARENT_ID = '1d1b7806-2242-4d89-9bac-56c4027f8f1c';
			const CHILD_ID = '4ad536cc-5960-4de7-9ee8-e37bed2a4689';

			const field = (name: string, type: FieldOverview['type'], special: string[] = []): FieldOverview => ({
				field: name,
				type,
				dbType: type,
				nullable: true,
				generated: false,
				precision: null,
				scale: null,
				special,
				note: null,
				alias: type === 'alias',
				validation: null,
				defaultValue: null,
			});

			const createSchema = (deselectAction: 'nullify' | 'delete'): SchemaOverview => ({
				collections: {
					parent: {
						collection: 'parent',
						primary: 'id',
						singleton: false,
						note: null,
						sortField: null,
						accountability: null,
						fields: { id: field('id', 'uuid'), children: field('children', 'alias', ['o2m']) },
					},
					child: {
						collection: 'child',
						primary: 'id',
						singleton: false,
						note: null,
						sortField: null,
						accountability: null,
						fields: { id: field('id', 'uuid'), parent: field('parent', 'uuid') },
					},
				},
				relations: [
					{
						collection: 'child',
						field: 'parent',
						related_collection: 'parent',
						schema: null,
						meta: {
							id: 1,
							many_collection: 'child',
							many_field: 'parent',
							one_collection: 'parent',
							one_field: 'children',
							one_collection_field: null,
							one_allowed_collections: null,
							junction_field: null,
							sort_field: null,
							one_deselect_action: deselectAction,
						},
					},
				],
			});

			// Reads the keys of the children to deselect: without a limit, they get the default one and anything past
			// the first page is left attached to the parent
			const readKeysOfDeselectedChildren = async (deselectAction: 'nullify' | 'delete', payload: object) => {
				// The child being kept is already attached to the parent, the read of the keys to deselect finds nothing
				tracker.on
					.select('child')
					.response((rawQuery) => (/\b(not )?in \(/.test(rawQuery.sql) ? [] : [{ id: CHILD_ID, parent: PARENT_ID }]));

				const service = new PayloadService('parent', { knex: db, schema: createSchema(deselectAction) });

				await service.processO2M(payload, PARENT_ID);

				return tracker.history.select.map((query) => query.sql).filter((sql) => /\b(not )?in \(/.test(sql));
			};

			it.each(['nullify', 'delete'] as const)(
				'reads every child to deselect for an explicit %s alteration',
				async (deselectAction) => {
					const sqls = await readKeysOfDeselectedChildren(deselectAction, { children: { delete: [CHILD_ID] } });

					expect(sqls).toHaveLength(1);
					expect(sqls[0]).not.toContain(' limit ');
				}
			);

			it.each(['nullify', 'delete'] as const)(
				'reads every child left out of a replaced list for %s',
				async (deselectAction) => {
					const sqls = await readKeysOfDeselectedChildren(deselectAction, { children: [CHILD_ID] });

					expect(sqls).toHaveLength(1);
					expect(sqls[0]).not.toContain(' limit ');
				}
			);
		});
	});
});

function toLocalISOString(date: Date) {
	const year = String(date.getFullYear());
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const seconds = String(date.getSeconds()).padStart(2, '0');

	return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}
