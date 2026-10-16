import * as oidc from 'openid-client';
import type { Knex } from 'knex';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { SchemaOverview } from '@wbce-d9/types';
import { InvalidTokenException } from '../../exceptions/index.js';
import logger from '../../logger.js';
import type { User } from '../../types/index.js';
import { OpenIDAuthDriver } from './openid.js';

vi.mock('../../env', () => {
	const MOCK_ENV = {
		SECRET: 'test',
		PUBLIC_URL: 'https://app.example',
		EXTENSIONS_PATH: './extensions',
		EMAIL_TEMPLATES_PATH: './templates',
		OAUTH2_TOKEN_TTL: 604800000,
	};

	return {
		default: MOCK_ENV,
		getEnv: () => MOCK_ENV,
	};
});

const { updateOne } = vi.hoisted(() => ({ updateOne: vi.fn() }));

vi.mock('../../database/index.js', () => ({
	default: vi.fn(),
}));

// The filter hooks return the payload unchanged
vi.mock('../../emitter.js', () => ({
	default: { emitFilter: vi.fn(async (_event: string, payload: any) => payload) },
}));

vi.mock('../../services/users.js', () => ({
	UsersService: class {
		updateOne = updateOne;
	},
}));

vi.mock('../../auth.js', () => ({
	getAuthProvider: vi.fn(),
}));

vi.mock('../../logger.js', () => ({
	default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), trace: vi.fn() },
}));

// The constructor kicks off provider discovery; stub it so no network call happens.
vi.mock('openid-client', () => {
	class ResponseBodyError extends Error {
		error: string;
		error_description?: string;

		constructor(error: string) {
			super(error);
			this.error = error;
		}
	}

	class ClientError extends Error {}

	return {
		discovery: vi.fn(async () => ({
			serverMetadata: () => ({ response_types_supported: ['code'] }),
		})),
		refreshTokenGrant: vi.fn(),
		ResponseBodyError,
		ClientError,
	};
});

function createDriver(config: Record<string, any> = {}) {
	const knex = {} as Knex;
	const schema = {} as SchemaOverview;

	return new OpenIDAuthDriver(
		{ knex, schema },
		{
			issuerUrl: 'https://idp.example',
			clientId: 'd9-client-id',
			clientSecret: 'd9-client-secret',
			provider: 'myidp',
			...config,
		}
	);
}

function createUser(authData: User['auth_data']): User {
	return { id: 'user-1', provider: 'myidp', auth_data: authData } as User;
}

const WITH_TOKEN = JSON.stringify({ refreshToken: 'stored-refresh-token' });

beforeEach(() => {
	vi.clearAllMocks();
});

describe('BaseOAuthDriver.refresh / login without a stored refresh token', () => {
	test('rejects by default (option unset)', async () => {
		const driver = createDriver();

		await expect(driver.refresh(createUser(null))).rejects.toBeInstanceOf(InvalidTokenException);
		await expect(driver.login(createUser(null))).rejects.toBeInstanceOf(InvalidTokenException);
		expect(logger.error).toHaveBeenCalledWith('No [OpenID] Session found');
	});

	test('rejects when requireRefreshToken is true', async () => {
		const driver = createDriver({ requireRefreshToken: true });

		await expect(driver.refresh(createUser(null))).rejects.toBeInstanceOf(InvalidTokenException);
	});

	test('resolves without contacting the provider when requireRefreshToken is false', async () => {
		const driver = createDriver({ requireRefreshToken: false });

		await expect(driver.refresh(createUser(null))).resolves.toBeUndefined();
		await expect(driver.login(createUser(null))).resolves.toBeUndefined();

		expect(oidc.refreshTokenGrant).not.toHaveBeenCalled();
		expect(updateOne).not.toHaveBeenCalled();
		expect(logger.error).not.toHaveBeenCalled();
	});

	test('also treats an auth_data object without refreshToken as "no token" when requireRefreshToken is false', async () => {
		const driver = createDriver({ requireRefreshToken: false });

		await expect(driver.refresh(createUser(JSON.stringify({})))).resolves.toBeUndefined();
	});
});

describe('BaseOAuthDriver.refresh with a stored refresh token (requireRefreshToken: false)', () => {
	test('exchanges the token at the provider and persists a rotated token', async () => {
		vi.mocked(oidc.refreshTokenGrant).mockResolvedValue({ refresh_token: 'rotated-token' } as any);

		const driver = createDriver({ requireRefreshToken: false });

		await expect(driver.refresh(createUser(WITH_TOKEN))).resolves.toBeUndefined();

		expect(oidc.refreshTokenGrant).toHaveBeenCalledWith(expect.anything(), 'stored-refresh-token');

		expect(updateOne).toHaveBeenCalledWith('user-1', {
			auth_data: JSON.stringify({ refreshToken: 'rotated-token' }),
		});
	});

	test('still rejects when the provider reports invalid_grant (revoked)', async () => {
		vi.mocked(oidc.refreshTokenGrant).mockRejectedValue(new (oidc.ResponseBodyError as any)('invalid_grant'));

		const driver = createDriver({ requireRefreshToken: false });

		await expect(driver.refresh(createUser(WITH_TOKEN))).rejects.toBeInstanceOf(InvalidTokenException);
	});
});

describe('BaseOAuthDriver.refresh with a stored refresh token (default)', () => {
	test('behaves as before: exchanges the token', async () => {
		vi.mocked(oidc.refreshTokenGrant).mockResolvedValue({} as any);

		const driver = createDriver();

		await expect(driver.refresh(createUser(WITH_TOKEN))).resolves.toBeUndefined();

		expect(oidc.refreshTokenGrant).toHaveBeenCalledWith(expect.anything(), 'stored-refresh-token');
		expect(updateOne).not.toHaveBeenCalled();
	});
});

describe('BaseOAuthDriver.getUserID for an existing user', () => {
	const CALLBACK_PAYLOAD = { code: 'code', codeVerifier: 'verifier', state: 'state' };

	function mockProviderResponse(driver: OpenIDAuthDriver, authData: string | undefined) {
		vi.spyOn(driver, 'fetchUserId').mockResolvedValue('user-1');

		vi.spyOn(driver, 'getTokenSetAndUserInfo').mockResolvedValue([
			{ access_token: 'access-token' } as any,
			{},
			{
				provider: 'myidp',
				first_name: 'Ada',
				last_name: 'Lovelace',
				email: 'ada@example.com',
				external_identifier: 'ada@example.com',
				role: 'role-1',
				auth_data: authData,
			},
		]);
	}

	test('stores the refresh token issued by the provider', async () => {
		const driver = createDriver();
		mockProviderResponse(driver, JSON.stringify({ refreshToken: 'new-token' }));

		await expect(driver.getUserID(CALLBACK_PAYLOAD)).resolves.toBe('user-1');

		expect(updateOne).toHaveBeenCalledWith('user-1', {
			auth_data: JSON.stringify({ refreshToken: 'new-token' }),
		});
	});

	test('keeps the stored refresh token when the provider issued none', async () => {
		const driver = createDriver();
		mockProviderResponse(driver, undefined);

		await expect(driver.getUserID(CALLBACK_PAYLOAD)).resolves.toBe('user-1');

		// No update at all: auth_data is not overwritten with null, and an empty update would crash (#127)
		expect(updateOne).not.toHaveBeenCalled();
	});

	test('keeps the stored refresh token while updating the profile (updateUserOnLogin)', async () => {
		const driver = createDriver({ updateUserOnLogin: true });
		mockProviderResponse(driver, undefined);

		await expect(driver.getUserID(CALLBACK_PAYLOAD)).resolves.toBe('user-1');

		expect(updateOne).toHaveBeenCalledWith('user-1', {
			first_name: 'Ada',
			last_name: 'Lovelace',
			email: 'ada@example.com',
		});
	});
});
