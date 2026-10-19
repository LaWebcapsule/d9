import request from 'supertest';
import { getUrl } from '@common/config.ts';
import vendors from '@common/get-dbs-to-test.ts';
import { CreateCollection, CreateItem, CreateRole, CreateUser, DeleteCollection } from '@common/functions.ts';
import { USER } from '@common/variables.ts';

// Regression tests for GHSA-7cvf-pxgp-42fc: manual Flow triggers must enforce the triggering user's permissions

const collection = 'test_flows_manual_trigger';

const ROLES = {
	NO_FLOW_ACCESS: 'Flows Manual Trigger - No Flow Access',
	NO_COLLECTION_ACCESS: 'Flows Manual Trigger - No Collection Access',
	FILTERED_ACCESS: 'Flows Manual Trigger - Filtered Access',
} as const;

const USERS = {
	NO_FLOW_ACCESS: { TOKEN: 'FlowsManualTriggerNoFlowToken', EMAIL: 'flows-manual-no-flow@tests.com' },
	NO_COLLECTION_ACCESS: {
		TOKEN: 'FlowsManualTriggerNoCollectionToken',
		EMAIL: 'flows-manual-no-collection@tests.com',
	},
	FILTERED_ACCESS: { TOKEN: 'FlowsManualTriggerFilteredToken', EMAIL: 'flows-manual-filtered@tests.com' },
} as const;

type VendorState = {
	flowId: string;
	readableItemId: number;
	hiddenItemId: number;
	roleIds: string[];
	userIds: string[];
};

const state: Record<string, VendorState> = {};

async function CreatePermission(vendor: string, role: string, permissionCollection: string, permissions = {}) {
	await request(getUrl(vendor))
		.post('/permissions')
		.set('Authorization', `Bearer ${USER.TESTS_FLOW.TOKEN}`)
		.send({ role, collection: permissionCollection, action: 'read', fields: ['*'], permissions });
}

function trigger(vendor: string, token: string | null, body: Record<string, unknown>) {
	const req = request(getUrl(vendor)).post(`/flows/trigger/${state[vendor]!.flowId}`).send(body);

	return token ? req.set('Authorization', `Bearer ${token}`) : req;
}

beforeAll(async () => {
	await Promise.all(
		vendors.map(async (vendor) => {
			await DeleteCollection(vendor, { collection });
			await CreateCollection(vendor, { collection, primaryKeyType: 'integer' });

			const readableItem = await CreateItem(vendor, { collection, item: {} });
			const hiddenItem = await CreateItem(vendor, { collection, item: {} });

			const roleIds: string[] = [];
			const userIds: string[] = [];

			for (const key of Object.keys(ROLES) as (keyof typeof ROLES)[]) {
				const role = await CreateRole(vendor, { name: ROLES[key], appAccessEnabled: false, adminAccessEnabled: false });
				roleIds.push(role.id);

				switch (key) {
					case 'NO_FLOW_ACCESS':
						await CreatePermission(vendor, role.id, collection);
						break;
					case 'NO_COLLECTION_ACCESS':
						await CreatePermission(vendor, role.id, 'directus_flows');
						break;
					case 'FILTERED_ACCESS':
						await CreatePermission(vendor, role.id, 'directus_flows');
						await CreatePermission(vendor, role.id, collection, { id: { _eq: readableItem.id } });
						break;
				}

				const user = await CreateUser(vendor, {
					token: USERS[key].TOKEN,
					email: USERS[key].EMAIL,
					password: 'password',
					role: role.id,
				});

				userIds.push(user.id);
			}

			const flowResponse = await request(getUrl(vendor))
				.post('/flows')
				.set('Authorization', `Bearer ${USER.TESTS_FLOW.TOKEN}`)
				.send({
					name: 'Manual Trigger Permissions',
					status: 'active',
					trigger: 'manual',
					accountability: 'all',
					options: { collections: [collection] },
				});

			state[vendor] = {
				flowId: flowResponse.body.data.id,
				readableItemId: readableItem.id,
				hiddenItemId: hiddenItem.id,
				roleIds,
				userIds,
			};

			// Flows are reloaded asynchronously after creation: wait until the manual trigger is registered
			for (let attempt = 0; attempt < 50; attempt++) {
				const response = await trigger(vendor, USER.ADMIN.TOKEN, { collection, keys: [readableItem.id] });

				if (response.statusCode < 300) return;

				await new Promise((resolve) => setTimeout(resolve, 100));
			}

			throw new Error(`Manual flow was never registered on ${vendor}`);
		})
	);
}, 300000);

afterAll(async () => {
	await Promise.all(
		vendors.map(async (vendor) => {
			const vendorState = state[vendor];
			if (!vendorState) return;

			const auth = `Bearer ${USER.TESTS_FLOW.TOKEN}`;

			await request(getUrl(vendor)).delete(`/flows/${vendorState.flowId}`).set('Authorization', auth);
			await request(getUrl(vendor)).delete('/users').set('Authorization', auth).send(vendorState.userIds);
			await request(getUrl(vendor)).delete('/roles').set('Authorization', auth).send(vendorState.roleIds);
			await DeleteCollection(vendor, { collection });
		})
	);
}, 300000);

describe('/flows/trigger/:id (manual)', () => {
	describe('denies unauthenticated requests', () => {
		it.each(vendors)('%s', async (vendor) => {
			const response = await trigger(vendor, null, { collection, keys: [state[vendor]!.readableItemId] });

			expect(response.statusCode).toBe(403);
		});
	});

	describe('denies users without read access to the flow', () => {
		it.each(vendors)('%s', async (vendor) => {
			const response = await trigger(vendor, USERS.NO_FLOW_ACCESS.TOKEN, {
				collection,
				keys: [state[vendor]!.readableItemId],
			});

			expect(response.statusCode).toBe(403);
		});
	});

	describe('denies users without read access to the target collection', () => {
		it.each(vendors)('%s', async (vendor) => {
			const response = await trigger(vendor, USERS.NO_COLLECTION_ACCESS.TOKEN, {
				collection,
				keys: [state[vendor]!.readableItemId],
			});

			expect(response.statusCode).toBe(403);
		});
	});

	describe('denies users targeting items outside their permissions', () => {
		it.each(vendors)('%s', async (vendor) => {
			const response = await trigger(vendor, USERS.FILTERED_ACCESS.TOKEN, {
				collection,
				keys: [state[vendor]!.hiddenItemId],
			});

			const mixedResponse = await trigger(vendor, USERS.FILTERED_ACCESS.TOKEN, {
				collection,
				keys: [state[vendor]!.readableItemId, state[vendor]!.hiddenItemId],
			});

			expect(response.statusCode).toBe(403);
			expect(mixedResponse.statusCode).toBe(403);
		});
	});

	describe('denies requests without keys when the flow requires a selection', () => {
		it.each(vendors)('%s', async (vendor) => {
			const response = await trigger(vendor, USERS.FILTERED_ACCESS.TOKEN, { collection });
			const emptyResponse = await trigger(vendor, USERS.FILTERED_ACCESS.TOKEN, { collection, keys: [] });

			expect(response.statusCode).toBe(403);
			expect(emptyResponse.statusCode).toBe(403);
		});
	});

	describe('allows users targeting items they can read', () => {
		it.each(vendors)('%s', async (vendor) => {
			const response = await trigger(vendor, USERS.FILTERED_ACCESS.TOKEN, {
				collection,
				keys: [state[vendor]!.readableItemId],
			});

			expect(response.statusCode).toBeLessThan(300);
		});
	});

	describe('allows admins', () => {
		it.each(vendors)('%s', async (vendor) => {
			const response = await trigger(vendor, USER.ADMIN.TOKEN, {
				collection,
				keys: [state[vendor]!.hiddenItemId],
			});

			expect(response.statusCode).toBeLessThan(300);
		});
	});
});
