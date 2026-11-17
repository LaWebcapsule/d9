import type { Accountability, PermissionsAction, SchemaOverview } from '@wbce-d9/types';
import { stableStringify } from '@wbce-d9/utils';
import type { Knex } from 'knex';
import { isPlainObject } from 'lodash-es';
import { webcrypto } from 'node:crypto';
import { getHelpers } from '../database/helpers/index.js';
import { getDatabaseClient } from '../database/index.js';
import { InvalidPayloadException } from '../exceptions/invalid-payload.js';
import type { Item, PrimaryKey } from '../types/index.js';
import { getColumn } from './get-column.js';

/**
 * Conditions the current field values have to meet for a mutation to be applied, by field. The only
 * operator is `_hash`: the hash (see `hashValue` in @wbce-d9/utils) of the value the client based its
 * edits on.
 */
export type OnlyIf = Record<string, { _hash: string }>;

export type Conflict = {
	collection: string;
	key: PrimaryKey;
	/** What the client tried to do with the item */
	action: 'update' | 'delete';
	/** `changed`: the field was changed by someone else, `deleted`: the item doesn't exist anymore */
	type: 'changed' | 'deleted';
	field?: string;
	/** Current value of the field */
	current?: unknown;
};

/**
 * Reserved key for information about a mutation that isn't part of the item itself. Items can contain
 * `onlyIf`, nested o2m alterations `deleteOnlyIf`.
 */
export const META_KEY = '$__meta';

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
 * Same result as `hashValue` in @wbce-d9/utils, which the clients use, without blocking the event loop
 */
export async function hashValue(value: unknown): Promise<string> {
	const digest = await webcrypto.subtle.digest('SHA-256', Buffer.from(stableStringify(value)));
	return Buffer.from(digest).toString('hex');
}

/**
 * Split the conditions off a mutation payload
 */
export function extractOnlyIf<T extends Partial<Item>>(data: T): { data: T; onlyIf: OnlyIf | null } {
	if (!data || typeof data !== 'object' || !(META_KEY in data)) return { data, onlyIf: null };

	const { [META_KEY]: meta, ...rest } = data;

	assertMeta(meta, 'onlyIf');

	if (meta['onlyIf'] === undefined) return { data: rest as T, onlyIf: null };

	assertOnlyIf(meta['onlyIf'], `${META_KEY}.onlyIf`);

	return { data: rest as T, onlyIf: meta['onlyIf'] };
}

/**
 * Validate and return the conditions for deleting items of a nested o2m alterations object, by primary key
 */
export function extractDeleteOnlyIf(alterations: Record<string, any>): Record<string, OnlyIf> | null {
	if (!(META_KEY in alterations)) return null;

	const meta = alterations[META_KEY];

	assertMeta(meta, 'deleteOnlyIf');

	if (meta['deleteOnlyIf'] === undefined) return null;

	if (!isPlainObject(meta['deleteOnlyIf'])) {
		throw new InvalidPayloadException(`"${META_KEY}.deleteOnlyIf" has to be an object of primary keys to conditions.`);
	}

	const deleteOnlyIf = meta['deleteOnlyIf'] as Record<string, unknown>;

	for (const [key, onlyIf] of Object.entries(deleteOnlyIf)) {
		assertOnlyIf(onlyIf, `${META_KEY}.deleteOnlyIf.${key}`);
	}

	return deleteOnlyIf as Record<string, OnlyIf>;
}

function assertMeta(meta: unknown, allowedKey: string): asserts meta is Record<string, unknown> {
	if (!isPlainObject(meta) || Object.keys(meta as object).some((key) => key !== allowedKey)) {
		throw new InvalidPayloadException(`"${META_KEY}" has to be an object that only contains "${allowedKey}".`);
	}
}

function assertOnlyIf(onlyIf: unknown, path: string): asserts onlyIf is OnlyIf {
	const isHashCondition = (condition: unknown) =>
		isPlainObject(condition) &&
		Object.keys(condition as object).length === 1 &&
		typeof (condition as Record<string, unknown>)['_hash'] === 'string';

	if (!isPlainObject(onlyIf) || !Object.values(onlyIf as object).every(isHashCondition)) {
		throw new InvalidPayloadException(
			`"${path}" has to be an object of field names to conditions. The only supported operator is "_hash".`
		);
	}
}

/**
 * Whether the permissions allow the action on every item of the collection
 */
export function hasUnfilteredAccess(
	accountability: Accountability | null,
	collection: string,
	action: PermissionsAction
): boolean {
	if (!accountability || accountability.admin === true) return true;

	const permission = accountability.permissions?.find(
		(permission) => permission.collection === collection && permission.action === action
	);

	return !!permission && Object.keys(permission.permissions ?? {}).length === 0;
}

type DetectConflictsOptions = {
	knex: Knex;
	schema: SchemaOverview;
	accountability: Accountability | null;
	collection: string;
	keys: PrimaryKey[];
	onlyIf: OnlyIf;
	action: 'update' | 'delete';
};

/**
 * Check the conditions sent by the client against the current values in the database.
 * Has to be called inside the transaction that does the mutation: the rows are locked until the
 * transaction finishes, so nobody can change them between the check and the write.
 */
export async function detectConflicts(options: DetectConflictsOptions): Promise<Conflict[]> {
	const { knex, schema, accountability, collection, keys, onlyIf, action } = options;

	if (keys.length === 0) return [];

	const collectionInfo = schema.collections[collection]!;
	const primaryKeyField = collectionInfo.primary;

	const fields = Object.keys(onlyIf).filter((field) => {
		const fieldInfo = collectionInfo.fields[field];
		if (!fieldInfo || fieldInfo.alias || field === primaryKeyField) return false;
		return !fieldInfo.special?.some((special) => UNCHECKED_SPECIALS.includes(special));
	});

	const rows = await readAndLockRows(knex, schema, collection, keys, fields);
	const canRead = await getReadAccess({ knex, schema, accountability, collection, keys });

	const conflicts: Conflict[] = [];

	for (const key of keys) {
		const row = rows.find((row) => String(row[primaryKeyField]) === String(key));

		if (!row) {
			// Deleting an item that is already gone is fine
			if (action === 'update') conflicts.push({ collection, key, action, type: 'deleted' });
			continue;
		}

		for (const field of fields) {
			// Fields the user can't read are not compared: the result would tell if a guessed value is right
			if (!canRead(key, field)) continue;

			if ((await hashValue(row[field])) !== onlyIf[field]!._hash) {
				conflicts.push({ collection, key, action, type: 'changed', field, current: row[field] });
			}
		}
	}

	return conflicts;
}

/**
 * Read the current values in API read format with the query that locks the rows. A separate read after
 * locking could return the values of an older snapshot (MySQL / MariaDB with REPEATABLE READ), when the
 * transaction already read something before, as is the case for nested items.
 */
async function readAndLockRows(
	knex: Knex,
	schema: SchemaOverview,
	collection: string,
	keys: PrimaryKey[],
	fields: string[]
): Promise<Item[]> {
	const collectionInfo = schema.collections[collection]!;
	const primaryKeyField = collectionInfo.primary;
	const helpers = getHelpers(knex);
	const client = getDatabaseClient(knex);

	const columns = [...new Set([primaryKeyField, ...fields])].map((field) =>
		collectionInfo.fields[field]!.type.startsWith('geometry')
			? helpers.st.asText(collection, field)
			: getColumn(knex, collection, field, false, schema)
	);

	const query = knex.select(columns).from(collection).whereIn(primaryKeyField, keys);

	// SQLite serializes writes on its own, Redshift doesn't support row locks
	if (client !== 'sqlite' && client !== 'redshift') query.forUpdate();

	const { PayloadService } = await import('../services/payload.js');
	const payloadService = new PayloadService(collection, { knex, schema });

	const rows: Item[] = await query;

	return await payloadService.processValues('read', rows);
}

/**
 * Returns a function that tells if the user is allowed to read a field of one of the items
 */
async function getReadAccess(context: {
	knex: Knex;
	schema: SchemaOverview;
	accountability: Accountability | null;
	collection: string;
	keys: PrimaryKey[];
}): Promise<(key: PrimaryKey, field: string) => boolean> {
	const { knex, schema, accountability, collection, keys } = context;

	if (!accountability || accountability.admin === true) return () => true;

	const permission = accountability.permissions?.find(
		(permission) => permission.collection === collection && permission.action === 'read'
	);

	const allowedFields = permission?.fields ?? [];

	if (allowedFields.length === 0) return () => false;

	const primaryKeyField = schema.collections[collection]!.primary;
	const readableKeys = new Set<string>();

	try {
		const { ItemsService } = await import('../services/items.js');
		const itemsService = new ItemsService(collection, { knex, schema, accountability });
		const rows = await itemsService.readMany(keys, { fields: [primaryKeyField] }, { emitEvents: false });

		for (const row of rows) readableKeys.add(String(row[primaryKeyField]));
	} catch {
		// No read access to the items
	}

	return (key, field) =>
		readableKeys.has(String(key)) && (allowedFields.includes('*') || allowedFields.includes(field));
}
