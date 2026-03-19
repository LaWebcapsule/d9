import type { SchemaOverview } from '@wbce-d9/types';
import type { Knex } from 'knex';
import knex from 'knex';
import { MockClient } from 'knex-mock-client';
import type { MockedFunction } from 'vitest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAuthorizationUrl, mockCallback } = vi.hoisted(() => {
	const mockAuthorizationUrl = vi.fn().mockReturnValue('https://provider.example.com/auth?state=mock-challenge');
	const mockCallback = vi.fn().mockResolvedValue({
		access_token: 'mock-access-token',
		refresh_token: 'mock-refresh-token',
		claims: () => ({
			sub: 'user-123',
			email: 'user@example.com',
			given_name: 'Test',
			family_name: 'User',
		}),
	});

	return { mockAuthorizationUrl, mockCallback };
});

vi.mock('../../database/index', () => ({
	default: vi.fn(),
	getDatabaseClient: vi.fn().mockReturnValue('postgres'),
}));

vi.mock('../../env', () => {
	const MOCK_ENV: Record<string, any> = {
		PUBLIC_URL: 'http://localhost:8055',
		SECRET: 'test-secret',
		EXTENSIONS_PATH: '/tmp/extensions',
		STORAGE_LOCATIONS: '',
		DB_CLIENT: 'sqlite3',
		RATE_LIMITER_ENABLED: false,
		CACHE_ENABLED: false,
		EMAIL_TRANSPORT: 'sendmail',
		ACCESS_TOKEN_TTL: '15m',
		REFRESH_TOKEN_TTL: '7d',
		REFRESH_TOKEN_COOKIE_NAME: 'directus_refresh_token',
		ACCESS_TOKEN_COOKIE_NAME: 'directus_access_token',
		AUTH_PROVIDERS: '',
	};

	return {
		default: MOCK_ENV,
		getEnv: vi.fn().mockImplementation(() => MOCK_ENV),
	};
});

vi.mock('../../logger', () => ({
	default: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		trace: vi.fn(),
		fatal: vi.fn(),
		debug: vi.fn(),
	},
}));

vi.mock('../../emitter', () => ({
	default: {
		emitFilter: vi.fn().mockImplementation((_: any, payload: any) => Promise.resolve(payload)),
		emitAction: vi.fn(),
	},
}));

vi.mock('../../cache', () => ({
	getCache: vi.fn().mockReturnValue({
		cache: { clear: vi.fn() },
		systemCache: { clear: vi.fn() },
	}),
}));

vi.mock('../../messenger', () => ({
	getMessenger: vi.fn().mockReturnValue({
		publish: vi.fn(),
		subscribe: vi.fn(),
	}),
}));

vi.mock('../../rate-limiter', () => ({
	default: vi.fn(),
	createRateLimiter: vi.fn(),
}));

vi.mock('../../services/mail/index', () => {
	const MailService = vi.fn();
	MailService.prototype.send = vi.fn();
	return { MailService };
});

vi.mock('../../auth', () => ({
	getAuthProvider: vi.fn(),
}));

vi.mock('../../utils/get-config-from-env', () => ({
	getConfigFromEnv: vi.fn().mockReturnValue({}),
}));

vi.mock('openid-client', () => {
	// Use a real class so the constructor works with `new issuer.Client(...)`.
	// vi.fn().mockImplementation() fails as a constructor in vitest 4.x.
	class MockIssuerClient {
		authorizationUrl: any;
		callback: any;
		userinfo: any;
		issuer: any;

		constructor() {
			this.authorizationUrl = mockAuthorizationUrl;
			this.callback = mockCallback;
			this.userinfo = vi.fn().mockResolvedValue({});
			this.issuer = { metadata: {} };
		}
	}

	return {
		Issuer: {
			discover: vi.fn().mockResolvedValue({
				metadata: { response_types_supported: ['code'] },
				Client: MockIssuerClient,
			}),
		},
		generators: {
			codeVerifier: vi.fn().mockReturnValue('mock-code-verifier'),
			codeChallenge: vi.fn().mockReturnValue('mock-code-challenge'),
		},
		errors: {
			OPError: class OPError extends Error {},
			RPError: class RPError extends Error {},
		},
	};
});

import { OpenIDAuthDriver } from './openid.js';

const testSchema = {
	collections: {
		directus_users: {
			collection: 'directus_users',
			primary: 'id',
			singleton: false,
			sortField: null,
			note: null,
			accountability: null,
			fields: {
				id: {
					field: 'id',
					defaultValue: null,
					nullable: false,
					generated: true,
					type: 'integer',
					dbType: 'integer',
					precision: null,
					scale: null,
					special: [],
					note: null,
					validation: null,
					alias: false,
				},
			},
		},
	},
	relations: [],
} as SchemaOverview;

describe('OpenIDAuthDriver', () => {
	let db: MockedFunction<Knex>;
	let service: OpenIDAuthDriver;

	beforeAll(async () => {
		db = vi.mocked(knex.default({ client: MockClient }));
	});

	beforeEach(() => {
		service = new OpenIDAuthDriver(
			{ knex: db, schema: testSchema },
			{
				issuerUrl: 'https://provider.example.com',
				clientId: 'test-client-id',
				clientSecret: 'test-client-secret',
				provider: 'test-provider',
				scope: 'openid profile email',
			}
		);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('generateAuthUrl', () => {
		it('uses clean redirect_uri without appended query params', async () => {
			await service.generateAuthUrl('test-verifier', false);

			expect(mockAuthorizationUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					redirect_uri: 'http://localhost:8055/auth/login/test-provider/callback',
				})
			);
		});

		it('does not append redirect to redirect_uri when additionalParams contains redirect', async () => {
			await service.generateAuthUrl('test-verifier', false, {
				redirect: 'http://localhost:8055/admin/content' as any,
			});

			const calledWith = mockAuthorizationUrl.mock.calls[0]![0] as Record<string, unknown>;

			expect(calledWith['redirect_uri']).toBe('http://localhost:8055/auth/login/test-provider/callback');
			expect(calledWith['redirect_uri']).not.toContain('?redirect=');
			expect(calledWith).not.toHaveProperty('redirect');
		});

		it('passes other additionalParams through while stripping redirect', async () => {
			await service.generateAuthUrl('test-verifier', false, {
				redirect: 'http://localhost:8055/admin/content' as any,
				login_hint: 'user@example.com',
			});

			const calledWith = mockAuthorizationUrl.mock.calls[0]![0] as Record<string, unknown>;

			expect(calledWith['login_hint']).toBe('user@example.com');
			expect(calledWith).not.toHaveProperty('redirect');
		});

		it('works when additionalParams is undefined', async () => {
			await service.generateAuthUrl('test-verifier', false, undefined);

			expect(mockAuthorizationUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					redirect_uri: 'http://localhost:8055/auth/login/test-provider/callback',
				})
			);
		});

		it('includes prompt=consent when prompt flag is true', async () => {
			await service.generateAuthUrl('test-verifier', true);

			expect(mockAuthorizationUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: 'consent',
				})
			);
		});
	});

	describe('getTokenSetAndUserInfo', () => {
		it('passes clean redirect_uri to client.callback', async () => {
			await service.getTokenSetAndUserInfo({
				code: 'auth-code',
				codeVerifier: 'test-verifier',
				state: 'test-state',
			});

			expect(mockCallback).toHaveBeenCalledWith(
				'http://localhost:8055/auth/login/test-provider/callback',
				expect.objectContaining({ code: 'auth-code' }),
				expect.any(Object)
			);
		});

		it('does not modify redirect_uri when payload contains redirect', async () => {
			await service.getTokenSetAndUserInfo({
				code: 'auth-code',
				codeVerifier: 'test-verifier',
				state: 'test-state',
				redirect: 'http://localhost:8055/admin/content',
			});

			const calledRedirectUri = mockCallback.mock.calls[0]![0];

			expect(calledRedirectUri).toBe('http://localhost:8055/auth/login/test-provider/callback');
			expect(calledRedirectUri).not.toContain('?redirect=');
		});

		it('returns tokenSet, userInfo, and userPayload', async () => {
			const [tokenSet, userInfo, userPayload] = await service.getTokenSetAndUserInfo({
				code: 'auth-code',
				codeVerifier: 'test-verifier',
				state: 'test-state',
			});

			expect(tokenSet).toHaveProperty('access_token', 'mock-access-token');
			expect(userInfo).toHaveProperty('email', 'user@example.com');
			expect(userPayload).toMatchObject({
				provider: 'test-provider',
				email: 'user@example.com',
				external_identifier: 'user-123',
			});
		});

		it('includes refresh_token in auth_data when provider returns one', async () => {
			const [, , userPayload] = await service.getTokenSetAndUserInfo({
				code: 'auth-code',
				codeVerifier: 'test-verifier',
				state: 'test-state',
			});

			expect(userPayload.auth_data).toBe(JSON.stringify({ refreshToken: 'mock-refresh-token' }));
		});

		it('returns falsy auth_data when provider does not return a refresh_token', async () => {
			mockCallback.mockResolvedValueOnce({
				access_token: 'mock-access-token',
				refresh_token: undefined,
				claims: () => ({
					sub: 'user-123',
					email: 'user@example.com',
					given_name: 'Test',
					family_name: 'User',
				}),
			});

			const [, , userPayload] = await service.getTokenSetAndUserInfo({
				code: 'auth-code',
				codeVerifier: 'test-verifier',
				state: 'test-state',
			});

			// When no refresh_token, auth_data should be falsy.
			// The baseoauth.ts ?? null fix handles coercing this to null for Knex.
			expect(userPayload.auth_data).toBeFalsy();
		});
	});
});
