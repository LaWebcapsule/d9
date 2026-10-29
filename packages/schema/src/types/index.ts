export interface Index {
	name: string;
	table: string;
	columns: string[];
	unique: boolean;
	primary: boolean;
	/**
	 * Set when the index is owned by a constraint. A primary index is reported through `primary`
	 * rather than here, so `constraint` only covers unique and foreign key constraints.
	 */
	constraint: 'unique' | 'foreign_key' | null;
	/** Access method when the dialect exposes it (btree, hash, gin, …), normalized to lowercase */
	method: string | null;
	/** Whether the index has a partial predicate (`WHERE …`) */
	partial: boolean;
	/** Partial predicate as SQL, when the dialect can expose it */
	predicate: string | null;
	/** INCLUDE / storing columns, when the dialect exposes them */
	included: string[];
	/** True when at least one key column is an expression rather than a plain column */
	expression: boolean;
	/** False when the index exists but can't be used (e.g. failed CREATE INDEX CONCURRENTLY) */
	valid: boolean;
}
