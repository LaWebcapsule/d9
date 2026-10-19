import cookieParser from 'cookie-parser';
import express from 'express';
import type { Knex } from 'knex';
import * as oidc from 'openid-client';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { SchemaOverview } from '@wbce-d9/types';
import { getAuthProvider } from '../../auth.js';
import { OpenIDAuthDriver, createOpenIDAuthRouter } from './openid.js';

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

vi.mock('../../services/users.js', () => ({
	UsersService: vi.fn(),
}));

vi.mock('../../auth.js', () => ({
	getAuthProvider: vi.fn(),
}));

// The constructor kicks off provider discovery; stub it so no network call happens
// and capture the parameters handed to the authorization-URL builder.
vi.mock('openid-client', () => ({
	discovery: vi.fn(async () => ({
		serverMetadata: () => ({ response_types_supported: ['code'] }),
	})),
	calculatePKCECodeChallenge: vi.fn(async () => 'SERVER_CHALLENGE'),
	randomPKCECodeVerifier: vi.fn(() => 'server-code-verifier'),
	buildAuthorizationUrl: vi.fn(
		(_client: unknown, params: Record<string, string>) =>
			new URL(`https://idp.example/authorize?${new URLSearchParams(params).toString()}`)
	),
}));

const SERVER_REDIRECT_URI = 'https://app.example/auth/login/myidp/callback';

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

/** Resolve the `params` object that `generateAuthUrl` passed to buildAuthorizationUrl. */
async function capturedParams(driver: OpenIDAuthDriver, additionalParams?: Record<string, string>) {
	await driver.getClient();
	vi.mocked(oidc.buildAuthorizationUrl).mockClear();
	await driver.generateAuthUrl('code-verifier', false, additionalParams);
	return vi.mocked(oidc.buildAuthorizationUrl).mock.calls[0]![1] as Record<string, string>;
}

beforeEach(() => {
	vi.mocked(oidc.buildAuthorizationUrl).mockClear();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('OpenIDAuthDriver.generateAuthUrl', () => {
	test('uses the server-set parameters when none are supplied', async () => {
		const params = await capturedParams(createDriver());

		expect(params['redirect_uri']).toBe(SERVER_REDIRECT_URI);
		expect(params['state']).toBe('SERVER_CHALLENGE');
		expect(params['nonce']).toBe('SERVER_CHALLENGE');
		expect(params['code_challenge']).toBe('SERVER_CHALLENGE');
	});

	test('forwards the additional params it is given (e.g. kc_action)', async () => {
		const params = await capturedParams(createDriver(), { kc_action: 'UPDATE_PASSWORD' });

		expect(params['kc_action']).toBe('UPDATE_PASSWORD');
	});

	test('server-set parameters always win over caller-supplied ones', async () => {
		const params = await capturedParams(createDriver(), {
			redirect_uri: 'https://attacker.example/cb',
			state: 'ATTACKER',
			nonce: 'ATTACKER',
			code_challenge: 'ATTACKER',
		});

		expect(params['redirect_uri']).toBe(SERVER_REDIRECT_URI);
		expect(params['state']).toBe('SERVER_CHALLENGE');
		expect(params['nonce']).toBe('SERVER_CHALLENGE');
		expect(params['code_challenge']).toBe('SERVER_CHALLENGE');
	});
});

describe('createOpenIDAuthRouter GET / (filters reserved query params)', () => {
	function app() {
		const instance = express();
		instance.use(cookieParser());
		instance.use('/auth/login/myidp', createOpenIDAuthRouter('myidp'));
		return instance;
	}

	beforeEach(() => {
		vi.mocked(getAuthProvider).mockReturnValue(createDriver());
	});

	test('drops reserved protocol params but forwards kc_action', async () => {
		const res = await request(app()).get(
			'/auth/login/myidp?kc_action=UPDATE_PASSWORD&redirect_uri=https://attacker.example/cb&state=ATTACKER&client_id=attacker-client&response_type=token&request_uri=https://attacker.example/req'
		);

		expect(res.status).toBe(302);

		const location = new URL(res.headers['location']!);
		// legitimate Keycloak param is preserved
		expect(location.searchParams.get('kc_action')).toBe('UPDATE_PASSWORD');
		// server values win / attacker values are gone
		expect(location.searchParams.get('redirect_uri')).toBe(SERVER_REDIRECT_URI);
		expect(location.searchParams.get('state')).toBe('SERVER_CHALLENGE');
		expect(location.searchParams.get('client_id')).not.toBe('attacker-client');
		expect(location.searchParams.get('response_type')).not.toBe('token');
		expect(location.searchParams.get('request_uri')).toBeNull();
	});
});

describe('createOpenIDAuthRouter GET /callback (preserves PR #163 behavior)', () => {
	// Mounts the real router so the actual catch block runs. A missing/invalid cookie
	// makes jwt.verify throw, which must redirect with reason=INVALID_CREDENTIALS
	// (PR #163) instead of throwing an error — and this security fix must not regress it.
	function app() {
		const instance = express();
		instance.use(cookieParser());
		instance.use('/auth/login/myidp', createOpenIDAuthRouter('myidp'));
		return instance;
	}

	test('redirects to the login page with reason=INVALID_CREDENTIALS when the cookie is missing', async () => {
		const res = await request(app()).get('/auth/login/myidp/callback?state=somestate');

		expect(res.status).toBe(302);
		expect(res.headers['location']).toBe('https://app.example/admin/login?reason=INVALID_CREDENTIALS');
	});

	test('redirects to an allowed redirect target with reason=INVALID_CREDENTIALS on cookie failure', async () => {
		const res = await request(app()).get('/auth/login/myidp/callback?state=somestate&redirect=/admin/content');

		expect(res.status).toBe(302);
		expect(res.headers['location']).toBe('/admin/content?reason=INVALID_CREDENTIALS');
	});

	test('does not honor a disallowed redirect target, falling back to the login page', async () => {
		const res = await request(app()).get('/auth/login/myidp/callback?state=somestate&redirect=//attacker.example/cb');

		expect(res.status).toBe(302);
		expect(res.headers['location']).toBe('https://app.example/admin/login?reason=INVALID_CREDENTIALS');
	});
});
