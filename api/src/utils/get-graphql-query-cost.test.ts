import { getOperationAST, parse } from 'graphql';
import { describe, expect, test } from 'vitest';
import { getGraphQLQueryCost } from './get-graphql-query-cost.js';

function cost(query: string, operationName?: string) {
	const document = parse(query);

	return getGraphQLQueryCost(document, getOperationAST(document, operationName ?? null));
}

describe('GraphQL getGraphQLQueryCost util', () => {
	test('counts one point per root field, aliases included', () => {
		expect(cost('{ articles users a: articles }')).toBe(3);
		expect(cost('{ a: articles(limit: 1) { id } b: articles(limit: 2) { id } }')).toBe(2);
	});

	test('does not count nested fields', () => {
		expect(cost('{ articles { id author { name } } }')).toBe(1);
	});

	test('does not count __typename', () => {
		expect(cost('{ __typename a: __typename }')).toBe(0);
		expect(cost('{ __typename articles { id __typename } }')).toBe(1);
	});

	test('counts the fields of inline fragments and fragment spreads', () => {
		expect(cost('{ ... on Query { a: articles } b: users }')).toBe(2);
		expect(cost('query { ...Fields } fragment Fields on Query { a: articles b: users }')).toBe(2);
		expect(cost('query { ...Fields users } fragment Fields on Query { articles }')).toBe(2);
	});

	test('counts a fragment spread once', () => {
		expect(cost('query { ...Fields ...Fields } fragment Fields on Query { a: articles b: users }')).toBe(2);
	});

	test('costs the selected operation only', () => {
		const document = parse('query A { articles } query B { a: articles b: users c: articles }');

		expect(getGraphQLQueryCost(document, getOperationAST(document, 'A'))).toBe(1);
		expect(getGraphQLQueryCost(document, getOperationAST(document, 'B'))).toBe(3);
	});

	test('costs mutations too', () => {
		expect(cost('mutation { a: create_articles_item(data: {}) { id } b: delete_articles_item(id: 1) { id } }')).toBe(2);
	});

	test('costs nothing when the operation is unknown', () => {
		expect(cost('query A { articles } query B { users }')).toBe(0);
		expect(cost('fragment Fields on Query { articles }')).toBe(0);
		expect(cost('query { articles }', 'Unknown')).toBe(0);
	});
});
