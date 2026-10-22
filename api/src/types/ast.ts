import type { Query, Relation } from '@wbce-d9/types';

/**
 * Search query, along with the fields it is allowed to match. For non-admin users, the fields are empty until the
 * AuthorizationService sets the readable ones
 */
export type ASTSearch = {
	fields: string[];
	value: string;
};

export type ASTQuery = Omit<Query, 'search'> & {
	search?: ASTSearch | null;
};

export type M2ONode = {
	type: 'm2o';
	name: string;
	children: (NestedCollectionNode | FieldNode | FunctionFieldNode)[];
	query: ASTQuery;
	fieldKey: string;
	relation: Relation;
	parentKey: string;
	relatedKey: string;
};

export type A2MNode = {
	type: 'a2o';
	names: string[];
	children: {
		[collection: string]: (NestedCollectionNode | FieldNode | FunctionFieldNode)[];
	};
	query: {
		[collection: string]: ASTQuery;
	};
	relatedKey: {
		[collection: string]: string;
	};
	fieldKey: string;
	relation: Relation;
	parentKey: string;
};

export type O2MNode = {
	type: 'o2m';
	name: string;
	children: (NestedCollectionNode | FieldNode | FunctionFieldNode)[];
	query: ASTQuery;
	fieldKey: string;
	relation: Relation;
	parentKey: string;
	relatedKey: string;
};

export type NestedCollectionNode = M2ONode | O2MNode | A2MNode;

export type FieldNode = {
	type: 'field';
	name: string;
	fieldKey: string;
};

export type FunctionFieldNode = {
	type: 'functionField';
	name: string;
	fieldKey: string;
	query: Query;
	relatedCollection: string;
};

export type AST = {
	type: 'root';
	name: string;
	children: (NestedCollectionNode | FieldNode | FunctionFieldNode)[];
	query: ASTQuery;
};
