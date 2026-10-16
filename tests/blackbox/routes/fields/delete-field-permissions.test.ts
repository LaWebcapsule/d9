import { getUrl } from '@common/config.ts';
import { CreateField, CreateItem, CreateRole } from '@common/functions.ts';
import vendors from '@common/get-dbs-to-test.ts';
import { DisableTestCachingSetup } from '@common/index.ts';
import { PRIMARY_KEY_TYPES, ROLE, USER } from '@common/variables.ts';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { collection } from './delete-field-permissions.seed.ts';

describe.each(PRIMARY_KEY_TYPES)('/fields', (pkType) => {
	DisableTestCachingSetup();

	const localCollection = `${collection}_${pkType}`;

	// Only the first permission of a role on a collection is applied, so each test uses its own role
	const createPermission = async (vendor: string, roleName: string, action: string, fields: string[]) => {
		const role = await CreateRole(vendor, {
			name: roleName,
			appAccessEnabled: roleName === ROLE.APP_ACCESS.NAME,
			adminAccessEnabled: false,
		});

		const response = await request(getUrl(vendor))
			.post('/permissions')
			.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
			.send({ role: role.id, collection: localCollection, action, permissions: {}, fields });

		return response.body.data.id;
	};

	describe(`pkType: ${pkType}`, () => {
		describe('DELETE /:collection/:field', () => {
			describe('removes the deleted field from the permissions of the collection', () => {
				it.each(vendors)('%s', async (vendor) => {
					// Setup
					await CreateField(vendor, { collection: localCollection, field: 'removed_field', type: 'string' });

					const readPermission = await createPermission(vendor, ROLE.API_ONLY.NAME, 'read', [
						'id',
						'removed_field',
						'string_field',
					]);

					const updatePermission = await createPermission(vendor, ROLE.API_ONLY.NAME, 'update', ['removed_field']);

					// Action
					const response = await request(getUrl(vendor))
						.delete(`/fields/${localCollection}/removed_field`)
						.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

					const response2 = await request(getUrl(vendor))
						.get(`/permissions/${readPermission}`)
						.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

					const response3 = await request(getUrl(vendor))
						.get(`/permissions/${updatePermission}`)
						.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

					// Assert
					expect(response.statusCode).toBe(204);
					expect(response2.body.data.fields).toEqual(['id', 'string_field']);
					expect(response3.body.data.fields).toBeNull();
				});
			});

			describe('does not grant access to a field recreated with the same name', () => {
				it.each(vendors)('%s', async (vendor) => {
					// Setup
					await CreateField(vendor, { collection: localCollection, field: 'recreated_field', type: 'string' });
					await createPermission(vendor, ROLE.APP_ACCESS.NAME, 'read', ['id', 'recreated_field', 'string_field']);

					// Action
					await request(getUrl(vendor))
						.delete(`/fields/${localCollection}/recreated_field`)
						.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

					await CreateField(vendor, { collection: localCollection, field: 'recreated_field', type: 'string' });

					const item = await CreateItem(vendor, {
						collection: localCollection,
						item: {
							id: pkType === 'string' ? uuid() : undefined,
							string_field: 'visible',
							recreated_field: 'secret',
						},
					});

					const response = await request(getUrl(vendor))
						.get(`/items/${localCollection}/${item.id}`)
						.set('Authorization', `Bearer ${USER.APP_ACCESS.TOKEN}`);

					// Assert
					expect(response.statusCode).toBe(200);
					expect(response.body.data).toHaveProperty('string_field', 'visible');
					expect(response.body.data).not.toHaveProperty('recreated_field');
				});
			});
		});
	});
});
