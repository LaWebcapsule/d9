import type { Accountability, PermissionsAction, SchemaOverview } from '@wbce-d9/types';
import { hashValue } from '@wbce-d9/utils';
import type { Knex } from 'knex';
import { isPlainObject } from 'lodash-es';
import { getHelpers } from '../database/helpers/index.js';
import { getDatabaseClient } from '../database/index.js';
import { InvalidPayloadException } from '../exceptions/invalid-payload.js';
import type { Item, PrimaryKey } from '../types/index.js';
import { getColumn } from './get-column.js';

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
	/** Current value of the field */
	current?: unknown;
	/** User and timestamp of the latest change of the item, only included when the user is allowed to read them */
	user?: string;
	timestamp?: string;
};

/**
 * Reserved key for information about a mutation that isn't part of the item itself. Items can contain
 * `base`, nested o2m alterations `deleteBase`.
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
 * Split the base off a mutation payload
 */
export function extractBase<T extends Partial<Item>>(data: T): { data: T; base: ConflictBase | null } {
	if (!data || typeof data !== 'object' || !(META_KEY in data)) return { data, base: null };

	const { [META_KEY]: meta, ...rest } = data;

	assertMeta(meta, 'base');

	if (meta['base'] === undefined) return { data: rest as T, base: null };

	assertBase(meta['base'], `${META_KEY}.base`);

	return { data: rest as T, base: meta['base'] };
}

/**
 * Validate and return the delete base of a nested o2m alterations object
 */
export function extractDeleteBase(alterations: Record<string, any>): Record<string, ConflictBase> | null {
	if (!(META_KEY in alterations)) return null;

	const meta = alterations[META_KEY];

	assertMeta(meta, 'deleteBase');

	if (meta['deleteBase'] === undefined) return null;

	if (!isPlainObject(meta['deleteBase'])) {
		throw new InvalidPayloadException(`"${META_KEY}.deleteBase" has to be an object of primary keys to field hashes.`);
	}

	const deleteBase = meta['deleteBase'] as Record<string, unknown>;

	for (const [key, base] of Object.entries(deleteBase)) {
		assertBase(base, `${META_KEY}.deleteBase.${key}`);
	}

	return deleteBase as Record<string, ConflictBase>;
}

function assertMeta(meta: unknown, allowedKey: string): asserts meta is Record<string, unknown> {
	if (!isPlainObject(meta) || Object.keys(meta as object).some((key) => key !== allowedKey)) {
		throw new InvalidPayloadException(`"${META_KEY}" has to be an object that only contains "${allowedKey}".`);
	}
}

function assertBase(base: unknown, path: string): asserts base is ConflictBase {
	if (!isPlainObject(base) || Object.values(base as object).some((hash) => hash !== null && typeof hash !== 'string')) {
		throw new InvalidPayloadException(`"${path}" has to be an object of field names to value hashes.`);
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

	const userUpdatedField = getFieldWithSpecial(collectionInfo, 'user-updated');
	const dateUpdatedField = getFieldWithSpecial(collectionInfo, 'date-updated');

	const rows = await readAndLockRows(knex, schema, collection, keys, [
		...fields,
		...(userUpdatedField ? [userUpdatedField] : []),
		...(dateUpdatedField ? [dateUpdatedField] : []),
	]);

	const canRead = await getReadAccess({ knex, schema, accountability, collection, keys });

	const getLastChangeFromActivity = (key: PrimaryKey) =>
		readLastChangeFromActivity({ knex, schema, accountability, collection, key });

	const conflicts: Conflict[] = [];

	for (const key of keys) {
		const row = rows.find((row) => String(row[primaryKeyField]) === String(key));

		if (!row) {
			// Deleting an item that is already gone is fine
			if (action === 'update') {
				conflicts.push({ collection, key, action, type: 'deleted', ...(await getLastChangeFromActivity(key)) });
			}

			continue;
		}

		// Fields the user can't read are not compared: the result would tell if a guessed value is right
		const changedFields = fields.filter((field) => canRead(key, field) && hashValue(row[field]) !== base[field]);

		if (changedFields.length === 0) continue;

		// The fields that track the latest change are part of the locked row and follow the field permissions
		const lastChange: Pick<Conflict, 'user' | 'timestamp'> = {};

		if (userUpdatedField && canRead(key, userUpdatedField) && row[userUpdatedField]) {
			lastChange.user = String(row[userUpdatedField]);
		}

		if (dateUpdatedField && canRead(key, dateUpdatedField) && row[dateUpdatedField]) {
			const timestamp = toISOString(row[dateUpdatedField]);
			if (timestamp) lastChange.timestamp = timestamp;
		}

		if (!lastChange.user || !lastChange.timestamp) {
			Object.assign(lastChange, { ...(await getLastChangeFromActivity(key)), ...lastChange });
		}

		for (const field of changedFields) {
			conflicts.push({ collection, key, action, type: 'changed', field, current: row[field], ...lastChange });
		}
	}

	return conflicts;
}

function toISOString(value: unknown): string | null {
	const date = new Date(value as string | number | Date);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getFieldWithSpecial(collectionInfo: SchemaOverview['collections'][string], special: string) {
	return Object.values(collectionInfo.fields).find((field) => !field.alias && field.special?.includes(special))?.field;
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

/**
 * User and timestamp of the latest activity of an item, if the user is allowed to read it
 */
async function readLastChangeFromActivity(context: {
	knex: Knex;
	schema: SchemaOverview;
	accountability: Accountability | null;
	collection: string;
	key: PrimaryKey;
}): Promise<Pick<Conflict, 'user' | 'timestamp'>> {
	const { knex, schema, accountability, collection, key } = context;

	const activity = await knex
		.select('id', 'user', 'timestamp')
		.from('directus_activity')
		.where({ collection, item: String(key) })
		.orderBy('id', 'desc')
		.first();

	if (!activity) return {};

	if (accountability && accountability.admin !== true) {
		try {
			const { ActivityService } = await import('../services/activity.js');
			const activityService = new ActivityService({ knex, schema, accountability });
			const rows = await activityService.readMany([activity.id], { fields: ['user', 'timestamp'] });

			if (rows.length === 0) return {};
		} catch {
			return {};
		}
	}

	const timestamp = activity.timestamp ? toISOString(activity.timestamp) : null;

	return {
		...(activity.user ? { user: String(activity.user) } : {}),
		...(timestamp ? { timestamp } : {}),
	};
}
