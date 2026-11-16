import type { Knex } from 'knex';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { SchemaOverview } from '@wbce-d9/types';
import { ForbiddenException, InvalidTokenException } from '../../exceptions/index.js';
import { LocalAuthDriver } from './local.js';

vi.mock('../../env', () => {
	const MOCK_ENV = {
		SECRET: 'test',
		PUBLIC_URL: 'https://app.example',
		EXTENSIONS_PATH: './extensions',
		EMAIL_TEMPLATES_PATH: './templates',
	};

	return {
		default: MOCK_ENV,
		getEnv: () => MOCK_ENV,
	};
});

type Account = { id: string; email: string; status: string; provider: string; auth_data: unknown };

const { accounts, send } = vi.hoisted(() => ({
	accounts: [] as Account[],
	send: vi.fn(),
}));

vi.mock('../../database/index.js', () => ({
	default: vi.fn(),
}));

// The filter hooks return the payload unchanged
vi.mock('../../emitter.js', () => ({
	default: { emitFilter: vi.fn(async (_event: string, payload: any) => payload) },
}));

vi.mock('../../logger.js', () => ({
	default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), trace: vi.fn() },
}));

// Only the router uses these two; stubbed so the driver loads without the export pipeline.
vi.mock('../../middleware/respond.js', () => ({
	respond: vi.fn(),
}));

vi.mock('../../services/authentication.js', () => ({
	AuthenticationService: class {},
}));

vi.mock('../../services/mail/index.js', () => ({
	MailService: class {
		send = send;
	},
}));

// Stands in for the real service on the one rule under test: `directus_users.auth_data` is a
// `system-only` field, and the payload service refuses to write such a field — to null or to a
// value — whenever the write carries an accountability (`services/payload.ts`, 'system-only').
vi.mock('../../services/users.js', async () => {
	const { ForbiddenException } = await import('../../exceptions/index.js');

	return {
		UsersService: class {
			accountability: unknown;

			constructor(options: { accountability?: unknown }) {
				this.accountability = options.accountability ?? null;
			}

			private write(data: Record<string, any>) {
				if (this.accountability && (data['auth_data'] === null || data['auth_data'])) {
					throw new ForbiddenException();
				}
			}

			async createOne(data: Record<string, any>) {
				this.write(data);
				accounts.push({ id: `user-${accounts.length + 1}`, auth_data: null, ...data } as Account);
			}

			async updateOne(id: string, data: Record<string, any>) {
				this.write(data);
				Object.assign(accounts.find((account) => account.id === id)!, data);
			}
		},
	};
});

function createDriver() {
	// Only the lookup by email goes straight to knex
	const knex = {
		select: () => ({
			from: () => ({
				whereRaw: (_sql: string, [, email]: [string, string]) => ({
					first: async () => accounts.find((account) => account.email.toLowerCase() === email),
				}),
			}),
		}),
	} as unknown as Knex;

	return new LocalAuthDriver({ knex, schema: {} as SchemaOverview }, {});
}

function mailedToken(): string {
	const url = send.mock.calls.at(-1)![0].template.data.url as string;
	return new URL(url).searchParams.get('token')!;
}

const input = { email: 'new@example.com', password: 'secret-password' };

beforeEach(() => {
	accounts.length = 0;
	send.mockReset();
});

describe('registerUser', () => {
	test('creates a draft account, mails the link and records when it was sent', async () => {
		await createDriver().registerUser('default', input);

		expect(send).toHaveBeenCalledTimes(1);

		expect(accounts).toHaveLength(1);
		expect(accounts[0]).toMatchObject({ email: input.email, status: 'draft', provider: 'default' });
		expect(JSON.parse(accounts[0]!.auth_data as string)).toHaveProperty('registerMailSentAt');
	});

	test('does not mail a pending account again within the resend interval', async () => {
		const driver = createDriver();

		await driver.registerUser('default', input);
		await driver.registerUser('default', input);

		expect(send).toHaveBeenCalledTimes(1);
		expect(accounts).toHaveLength(1);
	});

	test('sends nothing for an address that already has an active account', async () => {
		accounts.push({ id: 'user-1', email: input.email, status: 'active', provider: 'default', auth_data: null });

		await createDriver().registerUser('default', input);

		expect(send).not.toHaveBeenCalled();
	});
});

describe('verifyEmail', () => {
	test('activates the account behind a mailed token', async () => {
		const driver = createDriver();

		await driver.registerUser('default', input);

		await expect(driver.verifyEmail('default', mailedToken())).resolves.toBe('user-1');

		expect(accounts[0]).toMatchObject({ status: 'active', auth_data: null });
	});

	test('rejects a token that was already redeemed', async () => {
		const driver = createDriver();

		await driver.registerUser('default', input);
		await driver.verifyEmail('default', mailedToken());

		await expect(driver.verifyEmail('default', mailedToken())).rejects.toBeInstanceOf(InvalidTokenException);
	});

	test('rejects a token issued for another provider', async () => {
		const driver = createDriver();

		await driver.registerUser('default', input);

		await expect(driver.verifyEmail('other', mailedToken())).rejects.toBeInstanceOf(ForbiddenException);
		expect(accounts[0]!.status).toBe('draft');
	});
});
