import { CreateCollection, CreateField, DeleteCollection } from '../../common/functions.ts';
import vendors from '../../common/get-dbs-to-test.ts';

export const collection = 'test_indexes_crud';

export const seedDBStructure = () => {
	it.each(vendors)(
		'%s',
		async (vendor) => {
			try {
				// Delete existing collections
				await DeleteCollection(vendor, { collection });

				// Create the indexed collection
				await CreateCollection(vendor, {
					collection,
					primaryKeyType: 'integer',
				});

				await CreateField(vendor, { collection, field: 'title', type: 'string' });
				await CreateField(vendor, { collection, field: 'status', type: 'string' });

				expect(true).toBeTruthy();
			} catch (error) {
				expect(error).toBeFalsy();
			}
		},
		300000
	);
};
