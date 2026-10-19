import type { Request } from 'express';
import type { MockInstance } from 'vitest';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { getCacheKey } from './get-cache-key.js';
import * as getGraphqlQueryUtil from './get-graphql-query-and-variables.js';

vi.mock('./package.js', () => ({ version: '1.2.3' }));

const baseUrl = 'http://localhost';
const restUrl = `${baseUrl}/items/example`;
const graphQlUrl = `${baseUrl}/graphql`;
const accountability = { user: '00000000-0000-0000-0000-000000000000' };
const method = 'GET';

const requests = [
	{
		name: 'as unauthenticated request',
		params: { method, originalUrl: restUrl },
		key: 'da8873209dfcc5473fe3a936336f509f60e48549',
	},
	{
		name: 'as authenticated request',
		params: { method, originalUrl: restUrl, accountability },
		key: 'ef231c52ee2621b894a05a1661bdda0f5b95ad45',
	},
	{
		name: 'a request with a fields query',
		params: { method, originalUrl: restUrl, sanitizedQuery: { fields: ['id', 'name'] } },
		key: 'a45fd98e95672c52fdbde57ceb14ebadfae4dff7',
	},
	{
		name: 'a request with a filter query',
		params: { method, originalUrl: restUrl, sanitizedQuery: { filter: { name: { _eq: 'test' } } } },
		key: '28020b3017e0952bea96828abb0d11461b55f833',
	},
	{
		name: 'a GraphQL GET query request',
		params: { method, originalUrl: graphQlUrl, query: { query: 'query { test { id } }' } },
		key: '66cfc24341701a732000ff3dc9d8940bfeac2aa6',
	},
	{
		name: 'a GraphQL POST query request',
		params: { method: 'POST', originalUrl: graphQlUrl, body: { query: 'query { test { name } }' } },
		key: 'cfbbe707330099cc1626b58cb90aa5c76cbd2e4b',
	},
	{
		name: 'an authenticated GraphQL GET query request',
		params: { method, originalUrl: graphQlUrl, accountability, query: { query: 'query { test { id } }' } },
		key: 'ac48e12f4780029e20749c8405272d84d0969c1f',
	},
	{
		name: 'an authenticated GraphQL POST query request',
		params: { method: 'POST', originalUrl: graphQlUrl, accountability, body: { query: 'query { test { name } }' } },
		key: '8d466caca70f084073face70a5a82978234697be',
	},
];

const cases = requests.map(({ name, params, key }) => [name, params, key]);

afterEach(() => {
	vi.clearAllMocks();
});

describe('get cache key', () => {
	describe('isGraphQl', () => {
		let getGraphqlQuerySpy: MockInstance;

		beforeAll(() => {
			getGraphqlQuerySpy = vi.spyOn(getGraphqlQueryUtil, 'getGraphqlQueryAndVariables');
		});

		test.each(['/items/test', '/items/graphql', '/collections/test', '/collections/graphql'])(
			'path "%s" should not be interpreted as a graphql query',
			(path) => {
				getCacheKey({ originalUrl: `${baseUrl}${path}` } as Request);
				expect(getGraphqlQuerySpy).not.toHaveBeenCalled();
			}
		);

		test.each(['/graphql', '/graphql/system'])('path "%s" should be interpreted as a graphql query', (path) => {
			getCacheKey({ originalUrl: `${baseUrl}${path}` } as Request);
			expect(getGraphqlQuerySpy).toHaveBeenCalledOnce();
		});
	});

	test.each(cases)('should create a cache key for %s', (_, params, key) => {
		expect(getCacheKey(params as unknown as Request)).toEqual(key);
	});

	test('should create a unique key for each request', () => {
		const keys = cases.map(([, params]) => getCacheKey(params as unknown as Request));
		const hasDuplicate = keys.some((key) => keys.indexOf(key) !== keys.lastIndexOf(key));

		expect(hasDuplicate).toBeFalsy();
	});

	test('should create a unique key for GraphQL requests with different variables', () => {
		const query = 'query Test ($name: String) { test (filter: { name: { _eq: $name } }) { id } }';
		const operationName = 'test';
		const variables1 = JSON.stringify({ name: 'test 1' });
		const variables2 = JSON.stringify({ name: 'test 2' });
		const req1: any = { method, originalUrl: graphQlUrl, query: { query, operationName, variables: variables1 } };
		const req2: any = { method, originalUrl: graphQlUrl, query: { query, operationName, variables: variables2 } };
		const postReq1: any = { method: 'POST', originalUrl: req1.originalUrl, body: req1.query };
		const postReq2: any = { method: 'POST', originalUrl: req2.originalUrl, body: req2.query };

		expect(getCacheKey(req1)).not.toEqual(getCacheKey(req2));
		expect(getCacheKey(postReq1)).not.toEqual(getCacheKey(postReq2));
		expect(getCacheKey(req1)).toEqual(getCacheKey(postReq1));
		expect(getCacheKey(req2)).toEqual(getCacheKey(postReq2));
	});

	describe('should isolate keys across accountability contexts', () => {
		const roleA = '00000000-0000-0000-0000-00000000000a';
		const roleB = '00000000-0000-0000-0000-00000000000b';
		const share = '00000000-0000-0000-0000-0000000000a1';

		const contexts: [string, Record<string, unknown> | undefined][] = [
			['anonymous', undefined],
			['public role', { user: null, role: null, admin: false, app: false }],
			['role A without user', { user: null, role: roleA, admin: false, app: false }],
			['role B without user', { user: null, role: roleB, admin: false, app: false }],
			['role A with app access', { user: null, role: roleA, admin: false, app: true }],
			['role A with admin access', { user: null, role: roleA, admin: true, app: true }],
			[
				'share on item 1',
				{ user: null, role: roleA, admin: false, app: false, share, share_scope: { collection: 'example', item: '1' } },
			],
			[
				'share on item 2',
				{ user: null, role: roleA, admin: false, app: false, share, share_scope: { collection: 'example', item: '2' } },
			],
			[
				'other share on item 1',
				{
					user: null,
					role: roleA,
					admin: false,
					app: false,
					share: '00000000-0000-0000-0000-0000000000a2',
					share_scope: { collection: 'example', item: '1' },
				},
			],
		];

		test('anonymous and public-role requests share a key', () => {
			const anonymous = getCacheKey({ method, originalUrl: restUrl } as Request);
			const publicRole = getCacheKey({ method, originalUrl: restUrl, accountability: contexts[1]![1] } as any);

			expect(anonymous).toEqual(publicRole);
		});

		test('every other context gets a distinct key', () => {
			const keys = contexts
				.slice(1)
				.map(([, accountability]) => getCacheKey({ method, originalUrl: restUrl, accountability } as any));

			expect(new Set(keys).size).toBe(keys.length);
		});
	});
});
