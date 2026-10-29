import type { Index, SchemaInspector } from '@wbce-d9/schema';
import { createInspector } from '@wbce-d9/schema';
import type {
	Accountability,
	CollectionIndex,
	Filter,
	IndexCapabilities,
	IndexDeleteBlockedReason,
	IndexKind,
	IndexPayload,
	SchemaOverview,
} from '@wbce-d9/types';
import type { Knex } from 'knex';
import { getIndexCapabilities } from '../database/helpers/schema/capabilities.js';
import type { Helpers } from '../database/helpers/index.js';
import { getHelpers } from '../database/helpers/index.js';
import getDatabase, { getDatabaseClient, getSchemaInspector } from '../database/index.js';
import { ForbiddenException, InvalidPayloadException } from '../exceptions/index.js';
import type { AbstractServiceOptions, DatabaseClient } from '../types/index.js';
import { renderFilterAsSql } from '../utils/check-constraints.js';
import { getDefaultIndexName } from '../utils/get-default-index-name.js';

const NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
const MAX_NAME_LENGTH = 60;

/**
 * Manage the plain (non-unique) indexes of a collection.
 *
 * There is no system collection behind this service: the database is the source of truth.
 * Indexes are created and dropped, never updated in place — changing an index means dropping it
 * and creating a new one. That keeps a single write path and removes the drop/create window from
 * the API.
 */
export class IndexesService {
	knex: Knex;
	helpers: Helpers;
	accountability: Accountability | null;
	schema: SchemaOverview;
	schemaInspector: SchemaInspector | null;
	client: DatabaseClient;

	constructor(options: AbstractServiceOptions) {
		this.knex = options.knex || getDatabase();
		this.helpers = getHelpers(this.knex);
		this.accountability = options.accountability || null;
		this.schema = options.schema;
		this.client = getDatabaseClient(this.knex);

		this.schemaInspector =
			this.client === 'redshift' ? null : options.knex ? createInspector(options.knex) : getSchemaInspector();
	}

	get capabilities(): IndexCapabilities {
		return { vendor: this.client, ...getIndexCapabilities(this.client) };
	}

	// Read
	// ===============================================================================================

	async readAll(collection: string): Promise<CollectionIndex[]> {
		this.requireAdmin();
		this.assertCollection(collection);

		if (!this.capabilities.supported || !this.schemaInspector) return [];

		const indexes = await this.schemaInspector.indexes(collection);

		return indexes.map((index) => this.toCollectionIndex(index)).sort((a, b) => a.name.localeCompare(b.name));
	}

	// Create
	// ===============================================================================================

	async createOne(collection: string, payload: IndexPayload): Promise<CollectionIndex> {
		this.requireAdmin();
		this.assertSupported();
		this.assertCollection(collection);
		this.assertWhereSupported(payload.where);

		const columns = payload.columns;
		const where = payload.where;
		
		const customName = payload.name;
		const name = customName || getDefaultIndexName('index', collection, columns);

		this.validateName(name, collection, Boolean(customName));

		const predicate = where ? this.compileFilter(collection, where) : undefined;

		try {
			await this.helpers.schema.createIndex(collection, name, columns, predicate);
		} catch (err: any) {
			throw this.translateIndexError(err, name);
		}

		return this.readIndex(collection, name);
	}

	// Delete
	// ===============================================================================================

	async deleteOne(collection: string, name: string): Promise<void> {
		this.requireAdmin();
		this.assertSupported();
		this.assertCollection(collection);

		const existing = await this.readIndex(collection, name);
		this.assertDeletable(existing);

		await this.helpers.schema.dropIndex(collection, name);
	}

	// Helpers
	// ===============================================================================================

	private async readIndex(collection: string, name: string): Promise<CollectionIndex> {
		const indexes = await this.readAll(collection);
		const index = indexes.find((item) => item.name === name);

		if (!index) throw new InvalidPayloadException(`Index "${name}" doesn't exist`);

		return index;
	}

	private toCollectionIndex(index: Index): CollectionIndex {
		const kind = this.getKind(index);
		const reason = this.getDeleteBlockedReason(index);

		return {
			name: index.name,
			columns: index.columns,
			unique: index.unique,
			kind,
			partial: index.partial,
			predicate: index.predicate,
			deletable: reason === null,
			delete_blocked_reason: reason,
		};
	}

	private getKind(index: Index): IndexKind {
		if (index.primary) return 'primary';
		if (index.constraint === 'unique') return 'unique_constraint';
		if (index.constraint === 'foreign_key') return 'foreign_key_index';
		if (index.expression) return 'expression';
		if (index.unique) return 'unique_index';
		return 'index';
	}

	/**
	 * We only need to know whether dropping the index is safe: a primary key, a unique constraint
	 * (or unique index) and a foreign key index are not ours to drop. Expression, partial,
	 * non-btree or invalid indexes can always be dropped by name.
	 */
	private getDeleteBlockedReason(index: Index): IndexDeleteBlockedReason | null {
		if (index.primary) return 'primary_key';
		if (index.unique) return 'unique';
		if (index.constraint === 'foreign_key') return 'foreign_key';

		return null;
	}

	private assertDeletable(index: CollectionIndex): void {
		if (index.deletable) return;

		throw new InvalidPayloadException(`Index "${index.name}" can't be deleted (${index.delete_blocked_reason})`);
	}

	private requireAdmin(): void {
		if (this.accountability && this.accountability.admin !== true) {
			throw new ForbiddenException();
		}
	}

	private assertSupported(): void {
		if (!this.capabilities.supported) {
			throw new InvalidPayloadException(`Indexes are not supported on "${this.client}"`);
		}
	}

	private assertCollection(collection: string): void {
		if (collection in this.schema.collections === false) {
			throw new InvalidPayloadException(`Collection "${collection}" doesn't exist`);
		}
	}

	private assertWhereSupported(where?: Filter): void {
		if (where && !this.capabilities.where) {
			throw new InvalidPayloadException(`Partial indexes are not supported on "${this.client}"`);
		}
	}

	/**
	 * Custom names must follow the `<table>_<name>_index` convention. That makes a table-name
	 * collision practically impossible and duplicates are caught by the database error translation
	 * below, so there is no need to introspect the existing indexes before creating one.
	 *
	 * The generated default is only checked for syntax: for very long collection names it is
	 * truncated, so it can't always carry the full table prefix.
	 */
	private validateName(name: string, collection: string, enforceConvention: boolean): void {
		if (!NAME_PATTERN.test(name)) {
			throw new InvalidPayloadException(
				'Index names must start with a letter and only contain lowercase letters, numbers and underscores'
			);
		}

		if (name.length > MAX_NAME_LENGTH) {
			throw new InvalidPayloadException(`Index names can't be longer than ${MAX_NAME_LENGTH} characters`);
		}

		if (!enforceConvention) return;

		const table = collection.replace(/\.|-/g, '_').toLowerCase();
		const prefix = `${table}_`;
		const suffix = '_index';

		if (!name.startsWith(prefix) || !name.endsWith(suffix)) {
			throw new InvalidPayloadException(`Index names must start with "${prefix}" and end with "${suffix}"`);
		}

		if (name.length <= prefix.length + suffix.length) {
			throw new InvalidPayloadException(`Index names must include a name between "${prefix}" and "${suffix}"`);
		}
	}

	private compileFilter(collection: string, where: Filter): string {
		return renderFilterAsSql(this.knex, this.schema, collection, where);
	}

	private translateIndexError(err: any, name: string): Error {
		// 42P17: functions in index expression / predicate must be marked IMMUTABLE
		if (err?.code === '42P17') {
			return new InvalidPayloadException(`The database rejected the index definition: ${err.message}`);
		}

		// 42P07: relation already exists (PostgreSQL indexes share the namespace with tables)
		if (err?.code === '42P07') {
			return new InvalidPayloadException(
				`An index can't be named "${name}": this name is already used by an index, a table or another relation`
			);
		}

		// ER_DUP_KEYNAME (MySQL/MariaDB) and "index ... already exists" (SQLite)
		if (err?.code === 'ER_DUP_KEYNAME' || /already exists|already an index named/i.test(err?.message ?? '')) {
			return new InvalidPayloadException(`Index "${name}" already exists`);
		}

		return err;
	}
}
