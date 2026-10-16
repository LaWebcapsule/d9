import { CreateCollection, CreateField, DeleteCollection } from '../../common/functions.ts';
import vendors from '../../common/get-dbs-to-test.ts';
import { PRIMARY_KEY_TYPES } from '../../common/variables.ts';

export const collection = 'test_fields_delete_permissions';

export const seedDBStructure = () => {
	it.each(vendors)(
		'%s',
		async (vendor) => {
			for (const pkType of PRIMARY_KEY_TYPES) {
				try {
					const localCollection = `${collection}_${pkType}`;

					// Delete existing collections
					await DeleteCollection(vendor, { collection: localCollection });

					// Create collection
					await CreateCollection(vendor, {
						collection: localCollection,
						primaryKeyType: pkType,
					});

					await CreateField(vendor, {
						collection: localCollection,
						field: 'string_field',
						type: 'string',
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
