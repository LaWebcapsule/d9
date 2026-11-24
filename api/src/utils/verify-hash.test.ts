import argon2 from 'argon2';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { InvalidPayloadException } from '../exceptions/index.js';
import { getConfigFromEnv } from './get-config-from-env.js';
import { verifyHash } from './verify-hash.js';

vi.mock('./get-config-from-env.js', () => ({
	getConfigFromEnv: vi.fn(),
}));

beforeEach(() => {
	vi.mocked(getConfigFromEnv).mockReturnValue({});
});

describe('verifyHash', () => {
	test('verifies a hash generated with the default costs', async () => {
		const hash = await argon2.hash('secret');

		await expect(verifyHash(hash, 'secret')).resolves.toBe(true);
		await expect(verifyHash(hash, 'other')).resolves.toBe(false);
	});

	test.each([
		['memory', 'm=65536', 'm=4194304'],
		['time', 't=3', 't=1000'],
		['parallelism', 'p=4', 'p=64'],
	])('rejects a hash with a %s cost above the default', async (_, from, to) => {
		const hash = (await argon2.hash('secret')).replace(from, to);

		await expect(verifyHash(hash, 'secret')).rejects.toBeInstanceOf(InvalidPayloadException);
	});

	test('rejects a hash repeating a cost parameter', async () => {
		const hash = (await argon2.hash('secret')).replace('m=65536', 'm=65536,m=4194304');

		await expect(verifyHash(hash, 'secret')).rejects.toBeInstanceOf(InvalidPayloadException);
	});

	test('rejects a hash without cost parameters', async () => {
		await expect(verifyHash('not-a-hash', 'secret')).rejects.toBeInstanceOf(InvalidPayloadException);
	});

	test('accepts the costs configured through HASH_* variables', async () => {
		vi.mocked(getConfigFromEnv).mockReturnValue({ memoryCost: 131072, timeCost: 4 });

		const hash = await argon2.hash('secret', { memoryCost: 131072, timeCost: 4 });

		await expect(verifyHash(hash, 'secret')).resolves.toBe(true);
	});
});
