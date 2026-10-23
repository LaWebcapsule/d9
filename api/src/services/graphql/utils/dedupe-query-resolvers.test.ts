import { GraphQLInt, GraphQLObjectType, GraphQLSchema, GraphQLString, execute, parse } from 'graphql';
import { describe, expect, test, vi } from 'vitest';
import { dedupeQueryResolvers } from './dedupe-query-resolvers.js';

function getSchema(resolve: () => unknown) {
	const Item = new GraphQLObjectType({
		name: 'item',
		fields: { id: { type: GraphQLInt } },
	});

	const schema = new GraphQLSchema({
		query: new GraphQLObjectType({
			name: 'Query',
			fields: {
				health: { type: GraphQLString, resolve },
				spec: { type: GraphQLString, args: { scope: { type: GraphQLString } }, resolve },
				item: { type: Item, resolve },
			},
		}),
	});

	dedupeQueryResolvers(schema);

	return schema;
}

describe('GraphQL dedupeQueryResolvers util', () => {
	test('resolves a leaf field repeated under several aliases only once, however it is written', async () => {
		const resolve = vi.fn(() => 'ok');

		const result = await execute({
			schema: getSchema(resolve),
			document: parse(`
				query ($a: Boolean = true, $b: Boolean = true) {
					a: health
					b: health @include(if: $a)
					c: health @include(if: $b)
					d: health @skip(if: false)
				}
			`),
		});

		expect(result.data).toEqual({ a: 'ok', b: 'ok', c: 'ok', d: 'ok' });
		expect(resolve).toHaveBeenCalledTimes(1);
	});

	test('resolves a leaf field once per distinct arguments', async () => {
		const resolve = vi.fn(() => 'ok');

		await execute({
			schema: getSchema(resolve),
			document: parse(`
				query ($items: String = "items") {
					a: spec(scope: "items")
					b: spec(scope: $items)
					c: spec(scope: "system")
					d: spec
				}
			`),
		});

		expect(resolve).toHaveBeenCalledTimes(3);
	});

	test('does not deduplicate fields with a selection', async () => {
		const resolve = vi.fn(() => ({ id: 1 }));

		await execute({ schema: getSchema(resolve), document: parse('{ a: item { id } b: item { id } }') });

		expect(resolve).toHaveBeenCalledTimes(2);
	});

	test('does not share results across schemas', async () => {
		const resolve = vi.fn(() => 'ok');
		const document = parse('{ health }');

		await execute({ schema: getSchema(resolve), document });
		await execute({ schema: getSchema(resolve), document });

		expect(resolve).toHaveBeenCalledTimes(2);
	});
});
