import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../types/index.js';
import { getSnapshotDiff } from './get-snapshot-diff.js';

const field = (schema: Record<string, unknown>) => ({
	collection: 'articles',
	field: 'title',
	type: 'string',
	meta: null,
	schema: { name: 'title', table: 'articles', data_type: 'varchar', is_nullable: true, is_unique: false, ...schema },
});

const snapshot = (fields: unknown[]) =>
	({ version: 1, directus: '0.0.0', collections: [], fields, relations: [] } as unknown as Snapshot);

describe('getSnapshotDiff / is_indexed', () => {
	it('ignores is_indexed when the snapshot predates the property', () => {
		const diff = getSnapshotDiff(snapshot([field({ is_indexed: false })]), snapshot([field({})]));

		expect(diff.fields).toEqual([]);
	});

	it('reports a changed is_indexed', () => {
		const diff = getSnapshotDiff(snapshot([field({ is_indexed: false })]), snapshot([field({ is_indexed: true })]));

		expect(diff.fields).toHaveLength(1);
		expect(diff.fields[0]!.diff[0]).toMatchObject({ kind: 'E', path: ['schema', 'is_indexed'], lhs: false, rhs: true });
	});
});
