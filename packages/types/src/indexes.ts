import type { Filter } from './filter.js';

export type IndexKind = 'index' | 'primary' | 'unique_constraint' | 'unique_index' | 'foreign_key_index' | 'expression';

/**
 * Why an index can't be dropped from the index panel. Everything else is safe to drop:
 * a plain, expression, partial or non-btree index can always be removed by name.
 */
export type IndexDeleteBlockedReason = 'primary_key' | 'unique' | 'foreign_key';

export type CollectionIndex = {
	name: string;
	columns: string[];
	unique: boolean;
	kind: IndexKind;
	partial: boolean;
	/** Partial predicate as compiled SQL, for display only */
	predicate: string | null;
	deletable: boolean;
	delete_blocked_reason: IndexDeleteBlockedReason | null;
};

export type IndexPayload = {
	name?: string;
	columns: string[];
	where?: Filter;
};

export type IndexCapabilities = {
	vendor: string;
	supported: boolean;
	where: boolean;
};
