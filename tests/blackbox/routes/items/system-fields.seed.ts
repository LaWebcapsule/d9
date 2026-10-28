import { CreateCollection, CreateField, DeleteCollection } from '../../common/functions.ts';
import vendors from '../../common/get-dbs-to-test.ts';
import { PRIMARY_KEY_TYPES } from '../../common/variables.ts';

export const collection = 'test_items_system_fields';

export type Item = {
	id?: number | string;
	string_field?: string;
	date_created?: string | null;
	user_created?: string | null;
	date_updated?: string | null;
	user_updated?: string | null;
};

export const seedDBStructure = () => {
	it.each(vendors)(
		'%s',
		async (vendor) => {
			for (const pkType of PRIMARY_KEY_TYPES) {
				try {
					const localCollection = `${collection}_${pkType}`;

					await DeleteCollection(vendor, { collection: localCollection });

					await CreateCollection(vendor, {
						collection: localCollection,
						primaryKeyType: pkType,
					});

					await CreateField(vendor, {
						collection: localCollection,
						field: 'string_field',
						type: 'string',
						meta: {},
					});

					await CreateField(vendor, {
						collection: localCollection,
						field: 'date_created',
						type: 'timestamp',
						meta: { special: ['date-created'] },
					});

					await CreateField(vendor, {
						collection: localCollection,
						field: 'user_created',
						type: 'uuid',
						meta: { special: ['user-created'] },
					});

					await CreateField(vendor, {
						collection: localCollection,
						field: 'date_updated',
						type: 'timestamp',
						meta: { special: ['date-updated'] },
					});

					await CreateField(vendor, {
						collection: localCollection,
						field: 'user_updated',
						type: 'uuid',
						meta: { special: ['user-updated'] },
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

export const seedDBValues = async () => {
	// The structure is all this suite needs; every item is created by the tests themselves
	return true;
};
