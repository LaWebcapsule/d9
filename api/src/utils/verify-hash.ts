import argon2 from 'argon2';
import { InvalidPayloadException } from '../exceptions/index.js';
import { getConfigFromEnv } from './get-config-from-env.js';

// The cost parameters argon2.hash uses when generateHash doesn't override them through HASH_* variables
const DEFAULT_COSTS = { m: 65536, t: 3, p: 4 };

/**
 * Verify a string against a hash supplied by the caller.
 *
 * argon2 reads its cost parameters (memory, iterations, parallelism) from the encoded hash, so verifying an untrusted
 * hash costs whatever the caller asks for. Hashes that are costlier than the ones generateHash produces are rejected
 * before any hashing work is done.
 */
export async function verifyHash(hash: string, stringToVerify: string): Promise<boolean> {
	const { memoryCost, timeCost, parallelism } = getConfigFromEnv('HASH_', 'HASH_RAW');

	const maxCosts: Record<string, number> = {
		m: Math.max(DEFAULT_COSTS.m, Number(memoryCost) || 0),
		t: Math.max(DEFAULT_COSTS.t, Number(timeCost) || 0),
		p: Math.max(DEFAULT_COSTS.p, Number(parallelism) || 0),
	};

	// $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>
	const params = hash
		.split('$')
		.flatMap((segment) => segment.split(','))
		.map((param) => param.split('='));

	for (const [name, max] of Object.entries(maxCosts)) {
		const values = params.filter(([key]) => key === name).map(([, value]) => Number(value));

		if (values.length !== 1 || !Number.isInteger(values[0]) || values[0]! > max) {
			throw new InvalidPayloadException(`"hash" is invalid`);
		}
	}

	return await argon2.verify(hash, stringToVerify);
}
