import type { SchemaOverview } from '@wbce-d9/types';
import { parse } from 'graphql';
import type { Knex } from 'knex';
import { describe, expect, test, vi } from 'vitest';
import { GraphQLValidationException } from '../../exceptions/index.js';
import { GraphQLService } from './index.js';

// Vite resolves graphql to its ESM build while graphql-compose requires the CommonJS one, two instances
// graphql-compose cannot mix. Node loads the CommonJS build for both, so do the same here
vi.mock('graphql', () => import('graphql/index.js'));

vi.mock('../../database/index.js', () => ({
	default: vi.fn(),
}));

const schema = {
	collections: {
		articles: {
			collection: 'articles',
			primary: 'id',
			singleton: false,
			note: null,
			sortField: null,
			accountability: null,
			fields: {
				id: {
					field: 'id',
					defaultValue: null,
					nullable: false,
					generated: true,
					type: 'integer',
					dbType: 'integer',
					precision: null,
					scale: null,
					special: [],
					note: null,
					alias: false,
					validation: null,
				},
			},
		},
	},
	relations: [],
} as unknown as SchemaOverview;

function getService() {
	const service = new GraphQLService({
		accountability: { role: null, admin: true },
		knex: {} as Knex,
		schema,
		scope: 'items',
	});

	vi.spyOn(service, 'resolveQuery').mockResolvedValue([]);

	return service;
}

function execute(service: GraphQLService, query: string) {
	return service.execute({ query, document: parse(query), variables: {}, operationName: null, contextValue: {} });
}

describe('GraphQL validation of duplicated fields', () => {
	test('rejects the advisory document without blocking the process', async () => {
		// GHSA-7hmh-pfrp-vcx4: with graphql 16.8.1 validating this document blocks the process for minutes
		const service = getService();
		const fields = ('max { ' + 'id '.repeat(200) + '} ').repeat(200);

		const start = performance.now();

		await expect(execute(service, `query { articles_aggregated { ${fields} } }`)).rejects.toBeInstanceOf(
			GraphQLValidationException
		);

		expect(performance.now() - start).toBeLessThan(1000);
		expect(service.resolveQuery).not.toHaveBeenCalled();
	});

	test('still executes a document with a few duplicated fields', async () => {
		const service = getService();
		const fields = ('max { ' + 'id '.repeat(10) + '} ').repeat(10);

		const result = await execute(service, `query { articles_aggregated { ${fields} } }`);

		expect(result.errors).toBeUndefined();
		expect(service.resolveQuery).toHaveBeenCalledTimes(1);
	});
});
