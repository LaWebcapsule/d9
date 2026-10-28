import type { DocumentNode, FragmentDefinitionNode, OperationDefinitionNode, SelectionSetNode } from 'graphql';
import { Kind } from 'graphql';

/**
 * Cost of a GraphQL document in rate limit points: one point per root field of the executed
 * operation. Every root field is resolved on its own, so it is one unit of work (a collection read,
 * a mutation, ...) whatever its arguments: repeating fields under aliases with different arguments
 * consumes points instead of being free. Nested fields are not counted, as they are resolved from
 * the root field.
 * The operation is resolved by the caller (getOperationAST); when there is none (invalid document or
 * missing operation name), the cost is 0: validation rejects those, and the request still costs its
 * base point.
 */
export function getGraphQLQueryCost(
	document: DocumentNode,
	operation: OperationDefinitionNode | null | undefined
): number {
	if (!operation) return 0;

	const fragments = new Map<string, FragmentDefinitionNode>();

	for (const definition of document.definitions) {
		if (definition.kind === Kind.FRAGMENT_DEFINITION) fragments.set(definition.name.value, definition);
	}

	return countRootFields(operation.selectionSet, fragments, new Set());
}

function countRootFields(
	selectionSet: SelectionSetNode,
	fragments: Map<string, FragmentDefinitionNode>,
	visited: Set<string>
): number {
	let fields = 0;

	for (const selection of selectionSet.selections) {
		if (selection.kind === Kind.FIELD) {
			// A pointer resolved by the GraphQL engine, not by one of our resolvers
			if (selection.name.value === '__typename') continue;

			fields++;
		} else if (selection.kind === Kind.INLINE_FRAGMENT) {
			fields += countRootFields(selection.selectionSet, fragments, visited);
		} else if (selection.kind === Kind.FRAGMENT_SPREAD) {
			if (visited.has(selection.name.value)) continue;

			const fragment = fragments.get(selection.name.value);

			if (fragment) {
				visited.add(selection.name.value);
				fields += countRootFields(fragment.selectionSet, fragments, visited);
			}
		}
	}

	return fields;
}
