import { beforeAll, describe, expect, it } from 'vitest';
import { getUrl } from '@common/config.ts';
import { CreateItem, CreateRole } from '@common/functions.ts';
import vendors from '@common/get-dbs-to-test.ts';
import { DisableTestCachingSetup } from '@common/index.ts';
import { PRIMARY_KEY_TYPES, ROLE, USER } from '@common/variables.ts';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { collection, collectionRelated } from './search-permissions.seed.ts';

describe.each(PRIMARY_KEY_TYPES)('/items', (pkType) => {
	DisableTestCachingSetup();

	const localCollection = `${collection}_${pkType}`;
	const localCollectionRelated = `${collectionRelated}_${pkType}`;

	const allowedValue = `allowed-${uuid()}`;
	const forbiddenValue = `forbidden-${uuid()}`;
	const relatedAllowedValue = `related-allowed-${uuid()}`;
	const relatedForbiddenValue = `related-forbidden-${uuid()}`;

	beforeAll(async () => {
		for (const vendor of vendors) {
			const role = await CreateRole(vendor, {
				name: ROLE.API_ONLY.NAME,
				appAccessEnabled: false,
				adminAccessEnabled: false,
			});

			for (const [name, fields] of [
				[localCollection, ['id', 'allowed_field', 'related_id']],
				[localCollectionRelated, ['id', 'allowed_field']],
			] as const) {
				await request(getUrl(vendor))
					.post('/permissions')
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.send({ role: role.id, collection: name, action: 'read', permissions: {}, fields });
			}

			// Role that can only read the primary key, which doesn't match a text search
			const idOnlyRole = await CreateRole(vendor, {
				name: ROLE.APP_ACCESS.NAME,
				appAccessEnabled: true,
				adminAccessEnabled: false,
			});

			await request(getUrl(vendor))
				.post('/permissions')
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
				.send({ role: idOnlyRole.id, collection: localCollection, action: 'read', permissions: {}, fields: ['id'] });

			await CreateItem(vendor, {
				collection: localCollection,
				item: {
					id: pkType === 'string' ? uuid() : undefined,
					allowed_field: allowedValue,
					forbidden_field: forbiddenValue,
					related_id: {
						id: pkType === 'string' ? uuid() : undefined,
						allowed_field: relatedAllowedValue,
						forbidden_field: relatedForbiddenValue,
					},
				},
			});
		}
	}, 300000);

	describe(`pkType: ${pkType}`, () => {
		describe(`GET /${localCollection}`, () => {
			describe('searches in the fields the role can read', () => {
				it.each(vendors)('%s', async (vendor) => {
					// Action
					const response = await request(getUrl(vendor))
						.get(`/items/${localCollection}`)
						.query({ search: allowedValue, meta: 'filter_count' })
						.set('Authorization', `Bearer ${USER.API_ONLY.TOKEN}`);

					// Assert
					expect(response.statusCode).toEqual(200);
					expect(response.body.data.length).toBe(1);
					expect(Number(response.body.meta.filter_count)).toBe(1);
				});
			});

			describe('does not search in the fields the role cannot read', () => {
				it.each(vendors)('%s', async (vendor) => {
					// Action
					const response = await request(getUrl(vendor))
						.get(`/items/${localCollection}`)
						.query({ search: forbiddenValue, meta: 'filter_count,total_count' })
						.set('Authorization', `Bearer ${USER.API_ONLY.TOKEN}`);

					// Assert
					expect(response.statusCode).toEqual(200);
					expect(response.body.data.length).toBe(0);
					expect(Number(response.body.meta.filter_count)).toBe(0);
					// The total count ignores the search
					expect(Number(response.body.meta.total_count)).toBe(1);
				});
			});

			describe('returns no item when the role cannot read any field matching the search', () => {
				it.each(vendors)('%s', async (vendor) => {
					// Action
					const response = await request(getUrl(vendor))
						.get(`/items/${localCollection}`)
						.query({ search: forbiddenValue, meta: 'filter_count' })
						.set('Authorization', `Bearer ${USER.APP_ACCESS.TOKEN}`);

					// Assert
					expect(response.statusCode).toEqual(200);
					expect(response.body.data.length).toBe(0);
					expect(Number(response.body.meta.filter_count)).toBe(0);
				});
			});

			describe('searches in all the fields for admins', () => {
				it.each(vendors)('%s', async (vendor) => {
					// Action
					const response = await request(getUrl(vendor))
						.get(`/items/${localCollection}`)
						.query({ search: forbiddenValue, meta: 'filter_count' })
						.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

					// Assert
					expect(response.statusCode).toEqual(200);
					expect(response.body.data.length).toBe(1);
					expect(Number(response.body.meta.filter_count)).toBe(1);
				});
			});

			describe('deep searches in the related fields the role can read', () => {
				it.each(vendors)('%s', async (vendor) => {
					// Action
					const response = await request(getUrl(vendor))
						.get(`/items/${localCollection}`)
						.query({
							filter: JSON.stringify({ allowed_field: { _eq: allowedValue } }),
							fields: 'id,related_id.id',
							deep: JSON.stringify({ related_id: { _search: relatedAllowedValue } }),
						})
						.set('Authorization', `Bearer ${USER.API_ONLY.TOKEN}`);

					// Assert
					expect(response.statusCode).toEqual(200);
					expect(response.body.data.length).toBe(1);
					expect(response.body.data[0].related_id).not.toBeNull();
				});
			});

			describe('does not deep search in the related fields the role cannot read', () => {
				it.each(vendors)('%s', async (vendor) => {
					// Action
					const response = await request(getUrl(vendor))
						.get(`/items/${localCollection}`)
						.query({
							filter: JSON.stringify({ allowed_field: { _eq: allowedValue } }),
							fields: 'id,related_id.id',
							deep: JSON.stringify({ related_id: { _search: relatedForbiddenValue } }),
						})
						.set('Authorization', `Bearer ${USER.API_ONLY.TOKEN}`);

					// Assert
					expect(response.statusCode).toEqual(200);
					expect(response.body.data.length).toBe(1);
					expect(response.body.data[0].related_id).toBeNull();
				});
			});
		});
	});
});
