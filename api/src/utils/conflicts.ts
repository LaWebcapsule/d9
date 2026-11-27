import type { Accountability, FieldFilter, SchemaOverview } from '@wbce-d9/types';
import { stableStringify, validatePayload } from '@wbce-d9/utils';
import Joi from 'joi';
import type { Knex } from 'knex';
import { webcrypto } from 'node:crypto';
import { ForbiddenException } from '../exceptions/forbidden.js';
import { InvalidPayloadException } from '../exceptions/invalid-payload.js';
import type { Item, PrimaryKey } from '../types/index.js';

/**
 * Condition for a single field: `_sha256` is the digest (see `sha256Digest` in @wbce-d9/utils) of the value the
 * client based its edits on, `_eq` the value itself as the API returns it
 */
export type OnlyIfCondition = { _sha256: string } | { _eq: unknown };

/**
 * Conditions the current field values have to meet for a mutation to be applied, by field
 */
export type OnlyIf = Record<string, OnlyIfCondition>;

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
 * Fields that are never returned as-is, so they can't be compared
 */
const UNCHECKED_SPECIALS = ['conceal', 'hash'];

const onlyIfSchema = Joi.object().pattern(
	Joi.string(),
	Joi.object({
		_sha256: Joi.string().pattern(/^[0-9a-f]{64}$/),
		_eq: Joi.any(),
	})
		.length(1)
		.required()
);

/**
 * Same result as `sha256Digest` in @wbce-d9/utils, which the clients use, without blocking the event loop
 */
export async function sha256DigestAsync(value: unknown): Promise<string> {
	const digest = await webcrypto.subtle.digest('SHA-256', Buffer.from(stableStringify(value)));
	return Buffer.from(digest).toString('hex');
}

/**
 * Split the conditions off a mutation payload
 */
export function extractOnlyIf<T extends Partial<Item>>(data: T): { data: T; onlyIf: OnlyIf | null } {
	if (!data || typeof data !== 'object' || !(META_KEY in data)) return { data, onlyIf: null };

	const { [META_KEY]: meta, ...rest } = data;

	const { onlyIf } = validateMeta(meta, { onlyIf: onlyIfSchema });

	return { data: rest as T, onlyIf: (onlyIf as OnlyIf | undefined) ?? null };
}

/**
 * Validate and return the conditions for deleting items of a nested o2m alterations object, by primary key
 */
export function extractDeleteOnlyIf(alterations: Record<string, any>): Record<string, OnlyIf> | null {
	if (!(META_KEY in alterations)) return null;

	const { deleteOnlyIf } = validateMeta(alterations[META_KEY], {
		deleteOnlyIf: Joi.object().pattern(Joi.string(), onlyIfSchema.required()),
	});

	return (deleteOnlyIf as Record<string, OnlyIf> | undefined) ?? null;
}

function validateMeta(meta: unknown, keys: Record<string, Joi.Schema>): Record<string, unknown> {
	const { error } = Joi.object(keys).required().validate(meta);

	if (error) {
		throw new InvalidPayloadException(
			`Invalid "${META_KEY}": ${error.message}. Conditions are objects of field names to a single "_sha256" or "_eq" operator.`
		);
	}

	return meta as Record<string, unknown>;
}

type DetectConflictsOptions = {
	knex: Knex;
	schema: SchemaOverview;
	accountability: Accountability | null;
	collection: string;
	keys: PrimaryKey[];
	onlyIf: OnlyIf;
	action: 'update' | 'delete';
	emitEvents?: boolean | undefined;
};

/**
 * Check the conditions sent by the client against the current values in the database.
 * Has to be called inside the transaction that does the mutation: the rows are locked until the
 * transaction finishes, so nobody can change them between the check and the write.
 */
export async function detectConflicts(options: DetectConflictsOptions): Promise<Conflict[]> {
	const { schema, collection, keys, onlyIf, action } = options;

	if (keys.length === 0) return [];

	const collectionInfo = schema.collections[collection]!;
	const primaryKeyField = collectionInfo.primary;

	const fields = Object.keys(onlyIf).filter((field) => {
		const fieldInfo = collectionInfo.fields[field];
		if (!fieldInfo || fieldInfo.alias || field === primaryKeyField) return false;
		return !fieldInfo.special?.some((special) => UNCHECKED_SPECIALS.includes(special));
	});

	const rows = await readAndLockItems({ ...options, fields });
	const conflicts: Conflict[] = [];

	for (const row of rows) {
		const key = keys.find((key) => String(key) === String(row[primaryKeyField])) ?? row[primaryKeyField];

		// Fields the user can't read are not part of the row: the result would tell if a guessed value is right
		const readableFields = fields.filter((field) => field in row);

		for (const field of await getUnmetConditions(row, readableFields, onlyIf)) {
			conflicts.push({ collection, key, action, type: 'changed', field, current: row[field] });
		}
	}

	return conflicts;
}

/**
 * Read the current values with the permissions and hooks of the user, with the query that locks the rows.
 * A separate read after locking could return the values of an older snapshot (MySQL / MariaDB with
 * REPEATABLE READ), when the transaction already read something before, as is the case for nested items.
 * Items the user isn't allowed to read are left out.
 */
async function readAndLockItems(options: DetectConflictsOptions & { fields: string[] }): Promise<Item[]> {
	const { knex, schema, accountability, collection, keys, fields, emitEvents } = options;

	// Requesting a single field the user can't read would make the whole read fail
	const readableFields = getReadableFields(accountability, collection, fields);

	if (readableFields.length === 0) return [];

	const { ItemsService } = await import('../services/items.js');
	const itemsService = new ItemsService(collection, { knex, schema, accountability });

	try {
		return await itemsService.readMany(
			keys,
			// Oracle applies a limit by wrapping the query, which then can't lock rows anymore
			{ fields: readableFields, limit: -1 },
			// The primary key isn't requested, but needed to tell the rows apart
			{ forUpdate: true, stripNonRequested: false, ...(emitEvents !== undefined && { emitEvents }) }
		);
	} catch (error) {
		// No read access to the collection, nothing to compare
		if (error instanceof ForbiddenException) return [];
		throw error;
	}
}

function getReadableFields(accountability: Accountability | null, collection: string, fields: string[]): string[] {
	if (!accountability || accountability.admin === true) return fields;

	const permission = accountability.permissions?.find(
		(permission) => permission.collection === collection && permission.action === 'read'
	);

	const allowedFields = permission?.fields ?? [];

	return allowedFields.includes('*') ? fields : fields.filter((field) => allowedFields.includes(field));
}

/**
 * Validate the current values against the conditions, the same way permission rules are validated
 * against a payload. Returns the fields with a condition that isn't met.
 */
async function getUnmetConditions(row: Item, fields: string[], onlyIf: OnlyIf): Promise<string[]> {
	if (fields.length === 0) return [];

	const digests: Record<string, string> = {};
	const rules: FieldFilter[] = [];

	for (const field of fields) {
		const condition = onlyIf[field]!;

		// Plain values are compared by their digest too: the `_eq` of filter rules treats '5' and 5 as equal and
		// doesn't support arrays
		const expected = '_sha256' in condition ? condition._sha256 : await sha256DigestAsync(condition._eq);

		digests[field] = await sha256DigestAsync(row[field]);
		rules.push({ [field]: { _eq: expected } });
	}

	const errors = validatePayload({ _and: rules }, digests, { requireAll: true });

	return errors.flatMap((error) => error.details.map((detail) => String(detail.path[0])));
}

/**
 * Returns the keys of the items that don't exist anymore, when the user is allowed to know they were
 * deleted: they can read the activity of the deletion. Anyone else could use the result to find out
 * which items exist.
 */
export async function getDeletedKeys(context: {
	knex: Knex;
	schema: SchemaOverview;
	accountability: Accountability | null;
	collection: string;
	keys: PrimaryKey[];
	emitEvents?: boolean | undefined;
}): Promise<PrimaryKey[]> {
	const { knex, schema, accountability, collection, keys, emitEvents } = context;
	const primaryKeyField = schema.collections[collection]!.primary;

	const existingKeys = (await knex.select(primaryKeyField).from(collection).whereIn(primaryKeyField, keys)).map((row) =>
		String(row[primaryKeyField])
	);

	const missingKeys = keys.filter((key) => !existingKeys.includes(String(key)));

	if (missingKeys.length === 0) return [];

	const { ActivityService } = await import('../services/activity.js');
	const activityService = new ActivityService({ knex, schema, accountability });

	let deletions: Item[];

	try {
		deletions = await activityService.readByQuery(
			{
				fields: ['item'],
				filter: {
					_and: [
						{ collection: { _eq: collection } },
						{ action: { _eq: 'delete' } },
						{ item: { _in: missingKeys.map(String) } },
					],
				},
				limit: -1,
			},
			emitEvents !== undefined ? { emitEvents } : undefined
		);
	} catch (error) {
		if (error instanceof ForbiddenException) return [];
		throw error;
	}

	const deletedKeys = new Set(deletions.map((deletion) => String(deletion['item'])));

	return missingKeys.filter((key) => deletedKeys.has(String(key)));
}
