import deepDiff from 'deep-diff';
import { orderBy, unset } from 'lodash-es';
import type { Snapshot, SnapshotDiff } from '../types/index.js';
import { DiffKind } from '../types/index.js';
import { sanitizeCollection, sanitizeField, sanitizeRelation } from './sanitize-schema.js';

export function getSnapshotDiff(current: Snapshot, after: Snapshot): SnapshotDiff {
	const diffedSnapshot: SnapshotDiff = {
		collections: orderBy(
			[
				...current.collections.map((currentCollection) => {
					const afterCollection = after.collections.find(
						(afterCollection) => afterCollection.collection === currentCollection.collection
					);

					return {
						collection: currentCollection.collection,
						diff: deepDiff.diff(sanitizeCollection(currentCollection), sanitizeCollection(afterCollection)),
					};
				}),
				...after.collections
					.filter((afterCollection) => {
						const currentCollection = current.collections.find(
							(currentCollection) => currentCollection.collection === afterCollection.collection
						);

						return !!currentCollection === false;
					})
					.map((afterCollection) => ({
						collection: afterCollection.collection,
						diff: deepDiff.diff(undefined, sanitizeCollection(afterCollection)),
					})),
			].filter((obj) => Array.isArray(obj.diff)) as SnapshotDiff['collections'],
			'collection'
		),
		fields: orderBy(
			[
				...current.fields.map((currentField) => {
					const afterField = after.fields.find(
						(afterField) => afterField.collection === currentField.collection && afterField.field === currentField.field
					);

					const isAutoIncrementPrimaryKey =
						!!currentField.schema?.is_primary_key && !!currentField.schema?.has_auto_increment;

					const sanitizedCurrentField = sanitizeField(currentField, isAutoIncrementPrimaryKey);
					const sanitizedAfterField = sanitizeField(afterField, isAutoIncrementPrimaryKey);

					// Snapshots taken before `is_indexed` existed must not report every column as changed
					if (sanitizedAfterField?.schema && sanitizedAfterField.schema.is_indexed === undefined) {
						unset(sanitizedCurrentField, 'schema.is_indexed');
					}

					return {
						collection: currentField.collection,
						field: currentField.field,
						diff: deepDiff.diff(sanitizedCurrentField, sanitizedAfterField),
					};
				}),
				...after.fields
					.filter((afterField) => {
						const currentField = current.fields.find(
							(currentField) =>
								currentField.collection === afterField.collection && afterField.field === currentField.field
						);

						return !!currentField === false;
					})
					.map((afterField) => ({
						collection: afterField.collection,
						field: afterField.field,
						diff: deepDiff.diff(undefined, sanitizeField(afterField)),
					})),
			].filter((obj) => Array.isArray(obj.diff)) as SnapshotDiff['fields'],
			['collection']
		),
		relations: orderBy(
			[
				...current.relations.map((currentRelation) => {
					const afterRelation = after.relations.find(
						(afterRelation) =>
							afterRelation.collection === currentRelation.collection && afterRelation.field === currentRelation.field
					);

					return {
						collection: currentRelation.collection,
						field: currentRelation.field,
						related_collection: currentRelation.related_collection,
						diff: deepDiff.diff(sanitizeRelation(currentRelation), sanitizeRelation(afterRelation)),
					};
				}),
				...after.relations
					.filter((afterRelation) => {
						const currentRelation = current.relations.find(
							(currentRelation) =>
								currentRelation.collection === afterRelation.collection && afterRelation.field === currentRelation.field
						);

						return !!currentRelation === false;
					})
					.map((afterRelation) => ({
						collection: afterRelation.collection,
						field: afterRelation.field,
						related_collection: afterRelation.related_collection,
						diff: deepDiff.diff(undefined, sanitizeRelation(afterRelation)),
					})),
			].filter((obj) => Array.isArray(obj.diff)) as SnapshotDiff['relations'],
			['collection']
		),
	};

	/**
	 * When you delete a collection, we don't have to individually drop all the fields/relations as well
	 */

	const deletedCollections = diffedSnapshot.collections
		.filter((collection) => collection.diff?.[0]?.kind === DiffKind.DELETE)
		.map(({ collection }) => collection);

	diffedSnapshot.fields = diffedSnapshot.fields.filter(
		(field) => deletedCollections.includes(field.collection) === false
	);

	diffedSnapshot.relations = diffedSnapshot.relations.filter(
		(relation) => deletedCollections.includes(relation.collection) === false
	);

	return diffedSnapshot;
}
