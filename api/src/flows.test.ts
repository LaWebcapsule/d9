import type { Flow, OperationHandler, SchemaOverview } from '@wbce-d9/types';
import knex from 'knex';
import { MockClient } from 'knex-mock-client';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { getFlowManager } from './flows.js';

vi.mock('./database/index', () => ({
	default: vi.fn(),
	getDatabaseClient: vi.fn().mockReturnValue('postgres'),
}));

vi.mock('./messenger', () => ({
	getMessenger: vi.fn().mockReturnValue({ publish: vi.fn(), subscribe: vi.fn() }),
}));

const schema = {
	collections: {
		directus_users: {
			collection: 'directus_users',
			primary: 'id',
			fields: {
				id: { field: 'id', type: 'uuid', special: [] },
				email: { field: 'email', type: 'string', special: [] },
				password: { field: 'password', type: 'hash', special: ['hash', 'conceal'] },
				token: { field: 'token', type: 'string', special: ['conceal'] },
			},
		},
	},
	relations: [],
} as unknown as SchemaOverview;

const payload = { email: 'user@example.com', password: 'p4ssw0rd', token: 'static-token' };

function eventFlow(message: string): Flow {
	return {
		id: 'flow',
		trigger: 'event',
		accountability: null,
		options: { type: 'action', scope: ['items.create'], collections: ['directus_users'] },
		operation: {
			id: 'operation',
			key: 'log',
			type: 'log',
			options: { message },
			resolve: null,
			reject: null,
		},
	} as unknown as Flow;
}

describe('concealed fields in event-triggered flows', () => {
	const flowManager = getFlowManager();
	const operation = vi.fn<OperationHandler>();
	flowManager.addOperation('log', operation);

	afterEach(() => {
		vi.clearAllMocks();
	});

	async function run(message: string) {
		await (flowManager as any).executeFlow(
			eventFlow(message),
			{ event: 'users.create', collection: 'directus_users', payload: structuredClone(payload) },
			{ database: knex.default({ client: MockClient }), schema }
		);

		return operation.mock.calls[0]!;
	}

	test('are masked in the message of the log operation', async () => {
		const [options] = await run('{{ $trigger.payload }}');

		expect(options['message']).toEqual({
			email: 'user@example.com',
			password: '**********',
			token: '**********',
		});
	});

	test('are masked when referenced directly', async () => {
		const [options] = await run('{{ $trigger.payload.password }} {{ $last.payload.token }}');

		expect(options['message']).toBe('********** **********');
	});

	test('are left untouched in the data given to the operation', async () => {
		const [, context] = await run('{{ $trigger.payload.email }}');

		expect((context.data['$trigger'] as any).payload).toEqual(payload);
	});
});
