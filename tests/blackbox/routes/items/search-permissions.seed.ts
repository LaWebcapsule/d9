import { expect, it } from 'vitest';
import { CreateCollection, CreateField, CreateFieldM2O, DeleteCollection } from '../../common/functions.ts';
import vendors from '../../common/get-dbs-to-test.ts';
import { PRIMARY_KEY_TYPES } from '../../common/variables.ts';

export const collection = 'test_items_search_permissions';
export const collectionRelated = 'test_items_search_permissions_related';

export const seedDBStructure = () => {
	it.each(vendors)(
		'%s',
		async (vendor) => {
			for (const pkType of PRIMARY_KEY_TYPES) {
				try {
					const localCollection = `${collection}_${pkType}`;
					const localCollectionRelated = `${collectionRelated}_${pkType}`;

					// Delete existing collections
					await DeleteCollection(vendor, { collection: localCollection });
					await DeleteCollection(vendor, { collection: localCollectionRelated });

					for (const name of [localCollection, localCollectionRelated]) {
						await CreateCollection(vendor, {
							collection: name,
							primaryKeyType: pkType,
						});

						await CreateField(vendor, {
							collection: name,
							field: 'allowed_field',
							type: 'string',
						});

						await CreateField(vendor, {
							collection: name,
							field: 'forbidden_field',
							type: 'string',
						});
					}

					await CreateFieldM2O(vendor, {
						collection: localCollection,
						field: 'related_id',
						primaryKeyType: pkType,
						otherCollection: localCollectionRelated,
					});

					expect(true).toBeTruthy();
				} catch (error) {
					expect(error).toBeFalsy();
				}
			}
		},
		300000
	);
};
