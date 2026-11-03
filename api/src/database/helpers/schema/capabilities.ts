import type { IndexCapabilities } from '@wbce-d9/types';
import type { DatabaseClient } from '../../../types/index.js';

type ClientIndexCapabilities = Omit<IndexCapabilities, 'vendor'>;

/**
 * Capabilities are the single source of truth shared by the API validation and the app form.
 * Keep them aligned with `SchemaHelper.createIndex` and with the dialect implementations of
 * `SchemaInspector.indexes`.
 */
const INDEX_CAPABILITIES: Record<DatabaseClient, ClientIndexCapabilities> = {
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

export function getIndexCapabilities(client: DatabaseClient): ClientIndexCapabilities {
	return INDEX_CAPABILITIES[client] ?? { supported: false, where: false };
}
