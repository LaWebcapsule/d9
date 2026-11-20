import type { Knex } from 'knex';
import knex from 'knex';
import { createTracker, MockClient, Tracker } from 'knex-mock-client';
import type { MockedFunction } from 'vitest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import env from '../env.js';
import { ForbiddenException } from '../exceptions/index.js';
import { CollectionsService, FieldsService, RelationsService, SpecificationService } from '../../src/services/index.js';
import type { Collection } from '../types/index.js';
import { version } from '../utils/package.js';

class Client_PG extends MockClient {}

describe('Integration Tests', () => {
	let db: MockedFunction<Knex>;
	let tracker: Tracker;

	beforeAll(async () => {
		db = vi.mocked(knex.default({ client: Client_PG }));
		tracker = createTracker(db);
	});

	afterEach(() => {
		tracker.reset();
		vi.clearAllMocks();
	});

	describe('Services / Specifications', () => {
		describe('oas', () => {
			describe('generate', () => {
				let service: SpecificationService;

				beforeEach(() => {
					service = new SpecificationService({
						knex: db,
						schema: { collections: {}, relations: [] },
						accountability: { role: 'admin', admin: true },
					});
				});

				describe('info.version', () => {
					beforeEach(() => {
						vi.spyOn(CollectionsService.prototype, 'readByQuery').mockResolvedValue([]);
						vi.spyOn(FieldsService.prototype, 'readAll').mockResolvedValue([]);
						vi.spyOn(RelationsService.prototype, 'readAll').mockResolvedValue([]);
					});

					it('exposes the running version to admins', async () => {
						const spec = await service.oas.generate();

						expect(spec.info.version).toBe(version);
					});

					it('returns a hidden version to non-admins', async () => {
						const nonAdminService = new SpecificationService({
							knex: db,
							schema: { collections: {}, relations: [] },
							accountability: { role: 'editor', admin: false, permissions: [] },
						});

						const spec = await nonAdminService.oas.generate();

						expect(spec.info.version).toBe('0.0.0-hidden');
					});
				});

				describe('schema', () => {
					it('returns untyped schema for json fields', async () => {
						vi.spyOn(CollectionsService.prototype, 'readByQuery').mockResolvedValue([
							{
								collection: 'test_table',
								meta: {
									accountability: 'all',
									collection: 'test_table',
									group: null,
									hidden: false,
									icon: null,
									item_duplication_fields: null,
									note: null,
									singleton: false,
									translations: null,
								},
								schema: {
									name: 'test_table',
								},
							},
						] as any[]);

						vi.spyOn(FieldsService.prototype, 'readAll').mockResolvedValue([
							{
								collection: 'test_table',
								field: 'id',
								name: 'id',
								type: 'integer',
								meta: {
									id: 1,
									collection: 'test_table',
									conditions: null,
									display: null,
									display_options: null,
									field: 'id',
									group: null,
									hidden: true,
									interface: null,
									note: null,
									options: null,
									readonly: false,
									required: false,
									sort: null,
									special: null,
									translations: null,
									validation: null,
									validation_message: null,
									width: 'full',
								},
								schema: {
									comment: null,
									data_type: 'integer',
									default_value: null,
									foreign_key_column: null,
									foreign_key_schema: null,
									foreign_key_table: null,
									generation_expression: null,
									has_auto_increment: false,
									is_generated: false,
									is_nullable: false,
									is_primary_key: true,
									is_unique: true,
									max_length: null,
									name: 'id',
									numeric_precision: null,
									numeric_scale: null,
									table: 'test_table',
								},
							},
							{
								collection: 'test_table',
								field: 'blob',
								name: 'blob',
								type: 'json',
								meta: {
									id: 2,
									collection: 'test_table',
									conditions: null,
									display: null,
									display_options: null,
									field: 'blob',
									group: null,
									hidden: true,
									interface: null,
									note: null,
									options: null,
									readonly: false,
									required: false,
									sort: null,
									special: null,
									translations: null,
									validation: null,
									validation_message: null,
									width: 'full',
								},
								schema: {
									comment: null,
									data_type: 'json',
									default_value: null,
									foreign_key_column: null,
									foreign_key_schema: null,
									foreign_key_table: null,
									generation_expression: null,
									has_auto_increment: false,
									is_generated: false,
									is_nullable: true,
									is_primary_key: false,
									is_unique: false,
									max_length: null,
									name: 'blob',
									numeric_precision: null,
									numeric_scale: null,
									table: 'test_table',
								},
							},
						]);

						vi.spyOn(RelationsService.prototype, 'readAll').mockResolvedValue([]);

						const spec = await service.oas.generate();

						expect(spec.components?.schemas).toMatchInlineSnapshot(`
							{
							  "Diff": {
							    "properties": {
							      "diff": {
							        "properties": {
							          "collections": {
							            "items": {
							              "properties": {
							                "collection": {
							                  "type": "string",
							                },
							                "diff": {
							                  "items": {
							                    "type": "object",
							                  },
							                  "type": "array",
							                },
							              },
							              "type": "object",
							            },
							            "type": "array",
							          },
							          "fields": {
							            "items": {
							              "properties": {
							                "collection": {
							                  "type": "string",
							                },
							                "diff": {
							                  "items": {
							                    "type": "object",
							                  },
							                  "type": "array",
							                },
							                "field": {
							                  "type": "string",
							                },
							              },
							              "type": "object",
							            },
							            "type": "array",
							          },
							          "relations": {
							            "items": {
							              "properties": {
							                "collection": {
							                  "type": "string",
							                },
							                "diff": {
							                  "items": {
							                    "type": "object",
							                  },
							                  "type": "array",
							                },
							                "field": {
							                  "type": "string",
							                },
							                "related_collection": {
							                  "type": "string",
							                },
							              },
							              "type": "object",
							            },
							            "type": "array",
							          },
							        },
							        "type": "object",
							      },
							      "hash": {
							        "type": "string",
							      },
							    },
							    "type": "object",
							  },
							  "ItemsTestTable": {
							    "properties": {
							      "blob": {
							        "nullable": true,
							      },
							      "id": {
							        "nullable": false,
							        "type": "integer",
							      },
							    },
							    "type": "object",
							    "x-collection": "test_table",
							  },
							  "Query": {
							    "properties": {
							      "deep": {
							        "description": "Deep allows you to set any of the other query parameters on a nested relational dataset.",
							        "example": {
							          "related_articles": {
							            "_limit": 3,
							          },
							        },
							        "type": "object",
							      },
							      "fields": {
							        "description": "Control what fields are being returned in the object.",
							        "example": [
							          "*",
							          "*.*",
							        ],
							        "items": {
							          "type": "string",
							        },
							        "type": "array",
							      },
							      "filter": {
							        "example": {
							          "<field>": {
							            "<operator>": "<value>",
							          },
							        },
							        "type": "object",
							      },
							      "limit": {
							        "description": "Set the maximum number of items that will be returned",
							        "type": "number",
							      },
							      "offset": {
							        "description": "How many items to skip when fetching data.",
							        "type": "number",
							      },
							      "page": {
							        "description": "Cursor for use in pagination. Often used in combination with limit.",
							        "type": "number",
							      },
							      "search": {
							        "description": "Filter by items that contain the given search query in one of their fields.",
							        "type": "string",
							      },
							      "sort": {
							        "description": "How to sort the returned items.",
							        "example": [
							          "-date_created",
							        ],
							        "items": {
							          "type": "string",
							        },
							        "type": "array",
							      },
							    },
							    "type": "object",
							  },
							  "Schema": {
							    "properties": {
							      "collections": {
							        "items": {
							          "$ref": "#/components/schemas/Collections",
							        },
							        "type": "array",
							      },
							      "directus": {
							        "type": "string",
							      },
							      "fields": {
							        "items": {
							          "$ref": "#/components/schemas/Fields",
							        },
							        "type": "array",
							      },
							      "relations": {
							        "items": {
							          "$ref": "#/components/schemas/Relations",
							        },
							        "type": "array",
							      },
							      "vendor": {
							        "type": "string",
							      },
							      "version": {
							        "example": 1,
							        "type": "integer",
							      },
							    },
							    "type": "object",
							  },
							  "UpdateMeta": {
							    "description": "Information about an update that is not part of the item itself.",
							    "properties": {
							      "onlyIf": {
							        "additionalProperties": {
							          "properties": {
							            "_hash": {
							              "description": "SHA-256 hash of the value the changes are based on.",
							              "type": "string",
							            },
							          },
							          "required": [
							            "_hash",
							          ],
							          "type": "object",
							        },
							        "description": "Conditions the current values have to meet for the update to be saved, by field.",
							        "type": "object",
							      },
							    },
							    "type": "object",
							  },
							  "x-metadata": {
							    "properties": {
							      "filter_count": {
							        "description": "Returns the item count of the collection you're querying, taking the current filter/search parameters into account.",
							        "type": "integer",
							      },
							      "total_count": {
							        "description": "Returns the total item count of the collection you're querying.",
							        "type": "integer",
							      },
							    },
							    "type": "object",
							  },
							}
						`);
					});
				});

				describe('path', () => {
					const collection: Collection = {
						collection: 'test_table',
						meta: {
							accountability: 'all',
							collection: 'test_table',
							group: null,
							hidden: false,
							icon: null,
							item_duplication_fields: null,
							note: null,
							singleton: false,
							translations: {},
						},
						schema: {
							name: 'test_table',
						},
					};

					beforeEach(() => {
						vi.spyOn(CollectionsService.prototype, 'readByQuery').mockResolvedValue([collection]);

						vi.spyOn(FieldsService.prototype, 'readAll').mockResolvedValue([
							{
								collection: collection.collection,
								field: 'id',
								name: 'id',
								type: 'integer',
								meta: {
									id: 1,
									collection: 'test_table',
									conditions: null,
									display: null,
									display_options: null,
									field: 'id',
									group: null,
									hidden: true,
									interface: null,
									note: null,
									options: null,
									readonly: false,
									required: false,
									sort: null,
									special: null,
									translations: null,
									validation: null,
									validation_message: null,
									width: 'full',
								},
								schema: {
									comment: null,
									data_type: 'integer',
									default_value: null,
									foreign_key_column: null,
									foreign_key_schema: null,
									foreign_key_table: null,
									generation_expression: null,
									has_auto_increment: false,
									is_generated: false,
									is_nullable: false,
									is_primary_key: true,
									is_unique: true,
									max_length: null,
									name: 'id',
									numeric_precision: null,
									numeric_scale: null,
									table: 'test_table',
								},
							},
						]);

						vi.spyOn(RelationsService.prototype, 'readAll').mockResolvedValue([]);
					});

					it('requestBody for CreateItems POST path should not have type in schema', async () => {
						const spec = await service.oas.generate();

						const targetSchema =
							spec.paths[`/items/${collection.collection}`].post.requestBody.content['application/json'].schema;

						expect(targetSchema).toHaveProperty('oneOf');
						expect(targetSchema).not.toHaveProperty('type');
					});

					// The changes of an update: the item of the collection and the conditions for saving it
					const changes = {
						allOf: [
							{ $ref: '#/components/schemas/ItemsTestTable' },
							{ type: 'object', properties: { $__meta: { $ref: '#/components/schemas/UpdateMeta' } } },
						],
					};

					it('documents updating multiple items with the schema of the collection', async () => {
						const spec = await service.oas.generate();

						const operation = spec.paths[`/items/${collection.collection}`].patch;

						expect(operation.operationId).toBe('updateItemsTestTable');
						expect(operation.responses).toHaveProperty('409');

						expect(operation.requestBody.content['application/json'].schema.oneOf).toEqual([
							{ type: 'array', items: changes },
							expect.objectContaining({
								required: ['keys', 'data'],
								properties: expect.objectContaining({ data: changes }),
							}),
							expect.objectContaining({
								required: ['query', 'data'],
								properties: expect.objectContaining({ data: changes }),
							}),
						]);
					});

					it('replaces the generic requestBody of updating an item with the schema of the collection', async () => {
						const spec = await service.oas.generate();

						const operation = spec.paths[`/items/${collection.collection}/{id}`].patch;

						expect(operation.requestBody.content['application/json'].schema).toEqual(changes);
						expect(operation.responses).toHaveProperty('409');

						// The schema the request body refers to is part of the generated spec
						expect(spec.components?.schemas?.['UpdateMeta']).toHaveProperty('properties.onlyIf');
					});

					it('documents deleting items without a response body', async () => {
						const spec = await service.oas.generate();

						const list = spec.paths[`/items/${collection.collection}`].delete;
						const detail = spec.paths[`/items/${collection.collection}/{id}`].delete;

						expect(list.requestBody.content['application/json'].schema).toHaveProperty('oneOf');
						expect(Object.keys(list.responses)).toEqual(['204', '401']);
						expect(Object.keys(detail.responses)).toEqual(['204', '401', '404']);
					});
				});
			});
		});

		describe('graphql', () => {
			describe('generate', () => {
				let service: SpecificationService;
				let introspection: unknown;

				beforeEach(() => {
					introspection = env['GRAPHQL_INTROSPECTION'];

					service = new SpecificationService({
						knex: db,
						schema: { collections: {}, relations: [] },
						accountability: { role: 'admin', admin: true },
					});
				});

				afterEach(() => {
					env['GRAPHQL_INTROSPECTION'] = introspection;
				});

				it.each(['items', 'system'] as const)(
					'rejects the %s SDL when introspection is disabled, even for admins',
					async (scope) => {
						env['GRAPHQL_INTROSPECTION'] = false;

						await expect(service.graphql.generate(scope)).rejects.toBeInstanceOf(ForbiddenException);
					}
				);
			});
		});
	});
});
