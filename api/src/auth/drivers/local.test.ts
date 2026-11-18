import express, { type ErrorRequestHandler } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
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

vi.mock('../../database/index.js', () => ({
	default: vi.fn(() => ({})),
}));

vi.mock('../../services/users.js', () => ({
	UsersService: vi.fn(),
}));

vi.mock('../../services/authentication.js', () => ({
	AuthenticationService: vi.fn(),
}));

vi.mock('../../services/mail/index.js', () => ({
	MailService: vi.fn(),
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

let registerUser: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	vi.mocked(getConfigFromEnv).mockReturnValue({
		allowPublicRegistration: true,
		registerUrlAllowList: ALLOWED_URL,
	});

	registerUser = vi.spyOn(LocalAuthDriver.prototype, 'registerUser').mockResolvedValue();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('POST /auth/login/register', () => {
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
