import type { GraphQLFieldResolver, GraphQLSchema } from 'graphql';
import { getNamedType, isLeafType } from 'graphql';
import hash from 'object-hash';

/**
 * Make root query fields that are repeated under several aliases with the same arguments resolve
 * only once per execution, so a single request can't multiply expensive resolvers (eg. server_health).
 * Only fields returning a leaf type are concerned: as they have no selection, their result only
 * depends on their arguments.
 * Results are cached on the schema, which must therefore be built for a single execution.
 */
export function dedupeQueryResolvers(schema: GraphQLSchema): void {
	const fields = schema.getQueryType()?.getFields() ?? {};
	const results = new Map<string, unknown>();

	for (const field of Object.values(fields)) {
		const resolve: GraphQLFieldResolver<unknown, unknown> | undefined = field.resolve;

		if (!resolve || !isLeafType(getNamedType(field.type))) continue;

		field.resolve = (source, args, context, info) => {
			const key = hash({ field: info.fieldName, args });

			if (!results.has(key)) results.set(key, resolve(source, args, context, info));

			return results.get(key);
		};
	}
}
