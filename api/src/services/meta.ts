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
		const dbQuery = this.knex(collection);

		// Only the permissions apply to the total count, not the filter and search of the query
		const { filter } = await this.getAuthorizedQuery(collection, { fields: [] });

		let hasMultiRelationalFilter = false;

		if (filter && Object.keys(filter).length > 0) {
			hasMultiRelationalFilter = applyFilter(
				this.knex,
				this.schema,
				dbQuery,
				filter,
				collection,
				{}
			).hasMultiRelationalFilter;
		}

		this.applyCount(dbQuery, collection, hasMultiRelationalFilter);

		const result = await dbQuery.first();

		return Number(result?.count ?? 0);
	}

	async filterCount(collection: string, query: Query): Promise<number> {
		const dbQuery = this.knex(collection);

		const { filter, search } = await this.getAuthorizedQuery(collection, query);

		let hasMultiRelationalFilter = false;

		if (filter && Object.keys(filter).length > 0) {
			hasMultiRelationalFilter = applyFilter(
				this.knex,
				this.schema,
				dbQuery,
				filter,
				collection,
				{}
			).hasMultiRelationalFilter;
		}

		if (search) {
			applySearch(this.schema, dbQuery, search, collection);
		}

		this.applyCount(dbQuery, collection, hasMultiRelationalFilter);

		const records = await dbQuery;

		return Number(records[0]!.count);
	}

	private applyCount(dbQuery: Knex.QueryBuilder, collection: string, hasMultiRelationalFilter: boolean): void {
		if (hasMultiRelationalFilter) {
			// A filter across a to-many relation joins it: count the distinct items, not the joined rows
			const primaryKeyName = this.schema.collections[collection]!.primary;
			dbQuery.countDistinct({ count: [`${collection}.${primaryKeyName}`] });
		} else {
			dbQuery.count('*', { as: 'count' });
		}
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
