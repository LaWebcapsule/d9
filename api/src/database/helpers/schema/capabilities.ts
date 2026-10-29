import type { DatabaseClient } from '../../../types/index.js';

export type IndexCapabilities = {
	/** Whether the index panel can list and manage indexes on this client */
	supported: boolean;
	/** Whether partial indexes (`WHERE …`) are supported by the DDL helper */
	where: boolean;
};

/**
 * Capabilities are the single source of truth shared by the API validation and the app form.
 * Keep them aligned with `SchemaHelper.createIndex` and with the dialect implementations of
 * `SchemaInspector.indexes`.
 */
const INDEX_CAPABILITIES: Record<DatabaseClient, IndexCapabilities> = {
	mysql: { supported: true, where: false },
	postgres: { supported: true, where: true },
	// CockroachDB introspection goes through pg_catalog and isn't verified yet
	cockroachdb: { supported: false, where: false },
	sqlite: { supported: true, where: true },
	oracle: { supported: true, where: false },
	mssql: { supported: true, where: true },
	// Redshift has no secondary indexes
	redshift: { supported: false, where: false },
};

export function getIndexCapabilities(client: DatabaseClient): IndexCapabilities {
	return INDEX_CAPABILITIES[client] ?? { supported: false, where: false };
}
