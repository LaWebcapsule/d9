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

	test.each(['m', 't', 'p'])('rejects a hash whose %s cost is not a strictly positive integer', async (name) => {
		const hash = await argon2.hash('secret');

		for (const value of ['-1', '-4294967295', '-0', '0', '+5', '1e3', '3.5', '0x10', '05', '4294967297', '']) {
			const tampered = hash.replace(new RegExp(`([$,])${name}=[0-9]+`), `$1${name}=${value}`);

			await expect(verifyHash(tampered, 'secret'), `${name}=${value}`).rejects.toBeInstanceOf(InvalidPayloadException);
		}
	});

	test.each(['v=-19', 'v=4294967315', 'v=+19', 'v=1e1', 'v=20', 'v=19$v=19'])(
		'rejects a hash with version %s',
		async (version) => {
			const hash = (await argon2.hash('secret')).replace('v=19', version);

			await expect(verifyHash(hash, 'secret')).rejects.toBeInstanceOf(InvalidPayloadException);
		}
	);

	test('accepts a hash without a version', async () => {
		const hash = (await argon2.hash('secret', { version: 0x10 })).replace('$v=16', '');

		await expect(verifyHash(hash, 'secret')).resolves.toBe(true);
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
