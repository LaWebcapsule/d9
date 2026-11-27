import type { SchemaOverview } from '@wbce-d9/types';
import express, { type ErrorRequestHandler } from 'express';
import type { Knex } from 'knex';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ForbiddenException, InvalidTokenException } from '../../exceptions/index.js';
import { getConfigFromEnv } from '../../utils/get-config-from-env.js';
import { LocalAuthDriver, createLocalAuthRouter } from './local.js';

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
	default: vi.fn(() => ({})),
}));

// The filter hooks return the payload unchanged
vi.mock('../../emitter.js', () => ({
	default: { emitFilter: vi.fn(async (_event: string, payload: any) => payload) },
}));

// Stands in for the real service on one rule: `directus_users.auth_data` is a `system-only` field,
// and the payload service refuses to write such a field — to null or to a value — whenever the
// write carries an accountability (`services/payload.ts`, 'system-only').
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

				Object.assign(
					accounts.find((account) => account.id === id)!,
					data
				);
			}
		},
	};
});

vi.mock('../../services/authentication.js', () => ({
	AuthenticationService: vi.fn(),
}));

vi.mock('../../services/mail/index.js', () => ({
	MailService: class {
		send = send;
	},
}));

vi.mock('../../logger.js', () => ({
	default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), trace: vi.fn() },
}));

vi.mock('../../utils/get-config-from-env.js', () => ({
	getConfigFromEnv: vi.fn(),
}));

const ALLOWED_URL = 'https://app.example/verify-email';

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
	res.status(err.status ?? 500).json({ code: err.code });
};

function createApp() {
	const app = express();
	app.use(express.json());
	app.use('/auth/login', createLocalAuthRouter('default'));
	app.use(errorHandler);
	return app;
}

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

	vi.mocked(getConfigFromEnv).mockReturnValue({
		allowPublicRegistration: true,
		registerUrlAllowList: ALLOWED_URL,
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('POST /auth/login/register', () => {
	let registerUser: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		registerUser = vi.spyOn(LocalAuthDriver.prototype, 'registerUser').mockResolvedValue();
	});

	test('rejects a verification_url outside the allow list before responding, without registering', async () => {
		const res = await request(createApp())
			.post('/auth/login/register')
			.send({ email: 'user@example.com', password: 'secret', verification_url: 'https://evil.example/verify' });

		expect(res.status).toBe(400);
		expect(res.body.code).toBe('INVALID_PAYLOAD');
		expect(registerUser).not.toHaveBeenCalled();
	});

	test('accepts a verification_url on the allow list', async () => {
		const res = await request(createApp())
			.post('/auth/login/register')
			.send({ email: 'user@example.com', password: 'secret', verification_url: ALLOWED_URL });

		expect(res.status).toBe(204);

		expect(registerUser).toHaveBeenCalledWith(
			'default',
			expect.objectContaining({ email: 'user@example.com', verification_url: ALLOWED_URL })
		);
	});

	test('accepts a request without verification_url', async () => {
		const res = await request(createApp())
			.post('/auth/login/register')
			.send({ email: 'user@example.com', password: 'secret' });

		expect(res.status).toBe(204);
		expect(registerUser).toHaveBeenCalledWith('default', expect.objectContaining({ verification_url: null }));
	});

	test('rejects any verification_url when no allow list is configured', async () => {
		vi.mocked(getConfigFromEnv).mockReturnValue({ allowPublicRegistration: true });

		const res = await request(createApp())
			.post('/auth/login/register')
			.send({ email: 'user@example.com', password: 'secret', verification_url: ALLOWED_URL });

		expect(res.status).toBe(400);
		expect(registerUser).not.toHaveBeenCalled();
	});

	test('is not mounted when public registration is disabled', async () => {
		vi.mocked(getConfigFromEnv).mockReturnValue({});

		const res = await request(createApp())
			.post('/auth/login/register')
			.send({ email: 'user@example.com', password: 'secret' });

		expect(res.status).toBe(404);
		expect(registerUser).not.toHaveBeenCalled();
	});
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
