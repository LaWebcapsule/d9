import type { Accountability, Query, SchemaOverview } from '@wbce-d9/types';
import type { Knex } from 'knex';
import getDatabase from '../database/index.js';
import type { AbstractServiceOptions, ASTQuery } from '../types/index.js';
import { applyFilter, applySearch } from '../utils/apply-query.js';
import getASTFromQuery from '../utils/get-ast-from-query.js';
import { AuthorizationService } from './authorization.js';

export class MetaService {
	knex: Knex;
	accountability: Accountability | null;
	schema: SchemaOverview;

	constructor(options: AbstractServiceOptions) {
		this.knex = options.knex || getDatabase();
		this.accountability = options.accountability || null;
		this.schema = options.schema;
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	async getMetaForQuery(collection: string, query: any): Promise<Record<string, any> | undefined> {
		if (!query || !query.meta) return;

		const results = await Promise.all(
			query.meta.map((metaVal: string) => {
				if (metaVal === 'total_count') return this.totalCount(collection);
				if (metaVal === 'filter_count') return this.filterCount(collection, query);
				return undefined;
			})
		);

		return results.reduce((metaObject: Record<string, any>, value, index) => {
			return {
				...metaObject,
				[query.meta![index]]: value,
			};
		}, {});
	}

	async totalCount(collection: string): Promise<number> {
		const dbQuery = this.knex(collection).count('*', { as: 'count' }).first();

		// Only the permissions apply to the total count, not the filter and search of the query
		const { filter } = await this.getAuthorizedQuery(collection, { fields: [] });

		if (filter && Object.keys(filter).length > 0) {
			applyFilter(this.knex, this.schema, dbQuery, filter, collection, {});
		}

		const result = await dbQuery;

		return Number(result?.count ?? 0);
	}

	async filterCount(collection: string, query: Query): Promise<number> {
		const dbQuery = this.knex(collection).count('*', { as: 'count' });

		const { filter, search } = await this.getAuthorizedQuery(collection, query);

		if (filter && Object.keys(filter).length > 0) {
			applyFilter(this.knex, this.schema, dbQuery, filter, collection, {});
		}

		if (search) {
			applySearch(this.schema, dbQuery, search, collection);
		}

		const records = await dbQuery;

		return Number(records[0]!.count);
	}

	/**
	 * Go through the same authorization as the read of the items, so that the counts match the returned data
	 */
	private async getAuthorizedQuery(collection: string, query: Query): Promise<ASTQuery> {
		let ast = await getASTFromQuery(collection, query, this.schema, {
			accountability: this.accountability,
			knex: this.knex,
		});

		if (this.accountability?.admin !== true) {
			const authorizationService = new AuthorizationService({
				accountability: this.accountability,
				knex: this.knex,
				schema: this.schema,
			});

			ast = await authorizationService.processAST(ast);
		}

		return ast.query;
	}
}
