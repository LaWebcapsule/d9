import argon2 from 'argon2';
import express, { type ErrorRequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, test, vi } from 'vitest';
import utilsRouter from './utils.js';

vi.mock('../env', () => {
	const MOCK_ENV = {
		EXTENSIONS_PATH: './extensions',
		EMAIL_TEMPLATES_PATH: './templates',
	};

	return {
		default: MOCK_ENV,
		getEnv: () => MOCK_ENV,
	};
});

vi.mock('../database/index.js', () => ({
	default: vi.fn(() => ({})),
}));

function createApp() {
	const app = express();

	app.use(express.json());

	app.use('/utils', utilsRouter);

	app.use(((err, _req, res, _next) => {
		res.status(err.status ?? 500).json({ code: err.code });
	}) as ErrorRequestHandler);

	return app;
}

describe('POST /utils/hash/verify', () => {
	test('verifies a hash', async () => {
		const hash = await argon2.hash('secret');

		const response = await request(createApp()).post('/utils/hash/verify').send({ string: 'secret', hash });

		expect(response.status).toBe(200);
		expect(response.body.data).toBe(true);
	});

	test('rejects a hash costlier than the generated ones without hashing', async () => {
		const verify = vi.spyOn(argon2, 'verify');
		const hash = (await argon2.hash('secret')).replace('m=65536', 'm=4194304');

		const response = await request(createApp()).post('/utils/hash/verify').send({ string: 'secret', hash });

		expect(response.status).toBe(400);
		expect(response.body.code).toBe('INVALID_PAYLOAD');
		expect(verify).not.toHaveBeenCalled();
	});
});
