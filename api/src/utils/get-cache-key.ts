import type { Request } from 'express';
import hash from 'object-hash';
import url from 'url';
import { getGraphqlQueryAndVariables } from './get-graphql-query-and-variables.js';
import { version } from './package.js';

export function getCacheKey(req: Request): string {
	const path = url.parse(req.originalUrl).pathname;
	const isGraphQl = path?.startsWith('/graphql');

	const accountability = req.accountability;

	// Include every accountability field that affects permission resolution (see get-permissions.ts),
	// so responses are never shared across roles, shares or share scopes
	const info = {
		version,
		user: accountability?.user || null,
		role: accountability?.role || null,
		admin: accountability?.admin || false,
		app: accountability?.app || false,
		share: accountability?.share || null,
		share_scope: accountability?.share_scope || null,
		path,
		query: isGraphQl ? getGraphqlQueryAndVariables(req) : req.sanitizedQuery,
	};

	const key = hash(info);
	return key;
}
