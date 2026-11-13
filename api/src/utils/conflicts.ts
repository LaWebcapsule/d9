import type { Accountability, SchemaOverview } from '@wbce-d9/types';
import { hashValue } from '@wbce-d9/utils';
import type { Knex } from 'knex';
import { isPlainObject } from 'lodash-es';
import { getDatabaseClient } from '../database/index.js';
import { InvalidPayloadException } from '../exceptions/invalid-payload.js';
import type { Item, PrimaryKey } from '../types/index.js';

/**
 * Hashes (see `hashValue` in @wbce-d9/utils) of the field values the client based its edits on.
 * `null` explicitly skips the check of a field, eg. when the client chose to overwrite it.
 */
export type ConflictBase = Record<string, string | null>;

export type Conflict = {
	collection: string;
	key: PrimaryKey;
	/** What the client tried to do with the item */
	action: 'update' | 'delete';
	/** `changed`: the field was changed by someone else, `deleted`: the item doesn't exist anymore */
	type: 'changed' | 'deleted';
	field?: string;
	/** Current value of the field, only included when the user is allowed to read it */
	current?: unknown;
	/** User and timestamp of the latest change of the item */
	user?: string | null;
	timestamp?: string | null;
};

export const BASE_KEY = '$base';
export const DELETE_BASE_KEY = '$deleteBase';

/**
 * Fields that are set by the system or never returned as-is, so they can't be compared
 */
const UNCHECKED_SPECIALS = [
	'conceal',
	'hash',
	'date-created',
	'date-updated',
	'user-created',
	'user-updated',
	'role-created',
	'role-updated',
];

/**
 * Split the `$base` off a mutation payload
 */
export function extractBase<T extends Partial<Item>>(data: T): { data: T; base: ConflictBase | null } {
	if (!data || typeof data !== 'object' || !(BASE_KEY in data)) return { data, base: null };

	const { [BASE_KEY]: base, ...rest } = data;

	assertBase(base, BASE_KEY);

	return { data: rest as T, base };
}

/**
 * Validate and return the `$deleteBase` of a nested o2m alterations object
 */
export function extractDeleteBase(alterations: Record<string, any>): Record<string, ConflictBase> | null {
	if (!(DELETE_BASE_KEY in alterations)) return null;

	const deleteBase = alterations[DELETE_BASE_KEY];

	if (!isPlainObject(deleteBase)) {
		throw new InvalidPayloadException(`"${DELETE_BASE_KEY}" has to be an object of primary keys to field hashes.`);
	}

	for (const [key, base] of Object.entries(deleteBase)) {
		assertBase(base, `${DELETE_BASE_KEY}.${key}`);
	}

	return deleteBase;
}

function assertBase(base: unknown, path: string): asserts base is ConflictBase {
	if (!isPlainObject(base) || Object.values(base as object).some((hash) => hash !== null && typeof hash !== 'string')) {
		throw new InvalidPayloadException(`"${path}" has to be an object of field names to value hashes.`);
	}
}

type DetectConflictsOptions = {
	knex: Knex;
	schema: SchemaOverview;
	accountability: Accountability | null;
	collection: string;
	keys: PrimaryKey[];
	base: ConflictBase;
	action: 'update' | 'delete';
};

/**
 * Compare the base hashes sent by the client with the current values in the database.
 * Has to be called inside the transaction that does the mutation: the rows are locked until the
 * transaction finishes, so nobody can change them between the check and the write.
 */
export async function detectConflicts(options: DetectConflictsOptions): Promise<Conflict[]> {
	const { knex, schema, accountability, collection, keys, base, action } = options;

	if (keys.length === 0) return [];

	const collectionInfo = schema.collections[collection]!;
	const primaryKeyField = collectionInfo.primary;

	const fields = Object.keys(base).filter((field) => {
		if (base[field] === null) return false;
		const fieldInfo = collectionInfo.fields[field];
		if (!fieldInfo || fieldInfo.alias || field === primaryKeyField) return false;
		return !fieldInfo.special?.some((special) => UNCHECKED_SPECIALS.includes(special));
	});

	await lockRows(knex, collection, primaryKeyField, keys);

	const { ItemsService } = await import('../services/items.js');

	const adminService = new ItemsService(collection, { knex, schema });

	const rows = await adminService.readMany(keys, { fields: [primaryKeyField, ...fields] }, { emitEvents: false });

	const conflicts: Conflict[] = [];

	for (const key of keys) {
		const row = rows.find((row) => String(row[primaryKeyField]) === String(key));

		if (!row) {
			// Deleting an item that is already gone is fine
			if (action === 'update') conflicts.push({ collection, key, action, type: 'deleted' });
			continue;
		}

		for (const field of fields) {
			if (hashValue(row[field]) !== base[field]) {
				conflicts.push({ collection, key, action, type: 'changed', field });
			}
		}
	}

	if (conflicts.length > 0) {
		await addConflictDetails(conflicts, { knex, schema, accountability, collection, primaryKeyField });
	}

	return conflicts;
}

async function lockRows(knex: Knex, collection: string, primaryKeyField: string, keys: PrimaryKey[]) {
	const client = getDatabaseClient(knex);

	// SQLite serializes writes on its own, Redshift doesn't support row locks
	if (client === 'sqlite' || client === 'redshift') return;

	await knex.select(primaryKeyField).from(collection).whereIn(primaryKeyField, keys).forUpdate();
}

async function addConflictDetails(
	conflicts: Conflict[],
	context: {
		knex: Knex;
		schema: SchemaOverview;
		accountability: Accountability | null;
		collection: string;
		primaryKeyField: string;
	}
) {
	const { knex, schema, accountability, collection, primaryKeyField } = context;

	const changed = conflicts.filter((conflict) => conflict.type === 'changed');
	const keys = [...new Set(changed.map((conflict) => conflict.key))];
	const fields = [...new Set(changed.map((conflict) => conflict.field!))];

	if (keys.length > 0) {
		const { ItemsService } = await import('../services/items.js');

		// Read with the permissions of the current user, so the response doesn't leak values the user can't see
		const userService = new ItemsService(collection, { knex, schema, accountability });

		try {
			const rows = await userService.readMany(keys, { fields: [primaryKeyField, ...fields] }, { emitEvents: false });

			for (const conflict of changed) {
				const row = rows.find((row) => String(row[primaryKeyField]) === String(conflict.key));
				if (row && conflict.field! in row) conflict.current = row[conflict.field!];
			}
		} catch {
			// No read access, the conflict is reported without the current value
		}
	}

	for (const key of new Set(conflicts.map((conflict) => conflict.key))) {
		const activity = await knex
			.select('user', 'timestamp')
			.from('directus_activity')
			.where({ collection, item: String(key) })
			.orderBy('id', 'desc')
			.first();

		for (const conflict of conflicts.filter((conflict) => conflict.key === key)) {
			conflict.user = activity?.user ?? null;
			conflict.timestamp = activity?.timestamp ? new Date(activity.timestamp).toISOString() : null;
		}
	}
}
