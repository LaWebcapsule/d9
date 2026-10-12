import { describe, expect, test } from 'vitest';

import config from './index.js';

describe('Operations / Condition', () => {
	test('returns null when condition passes', () => {
		const filter = {
			status: {
				_eq: true,
			},
		};

		const data = {
			status: true,
		};

		expect(config.handler({ filter }, { data } as any)).toBe(null);
	});

	test('throws error array when conditions fails', () => {
		const filter = {
			status: {
				_eq: true,
			},
		};

		const data = {
			status: false,
		};

		expect.assertions(2); // ensure catch block is reached

		try {
			config.handler({ filter }, { data } as any);
		} catch (err: any) {
			expect(err).toHaveLength(1);
			expect(err[0]!.message).toBe(`"status" must be [true]`);
		}
	});

	test('throws error array when condition is checking for a field that is not included in data', () => {
		const filter = {
			status: {
				_eq: true,
			},
		};

		const data = {};

		expect.assertions(2); // ensure catch block is reached

		try {
			config.handler({ filter }, { data } as any);
		} catch (err: any) {
			expect(err).toHaveLength(1);
			expect(err[0]!.message).toBe(`"status" is required`);
		}
	});

	test('does not leak the validated data in the thrown errors', () => {
		const filter = {
			status: {
				_eq: true,
			},
		};

		const data = {
			status: false,
			$env: { SECRET: 'secret' },
			$accountability: { user: 'user-id', role: 'role-id' },
		};

		expect.assertions(2);

		try {
			config.handler({ filter }, { data } as any);
		} catch (err: any) {
			expect(err).toEqual([
				{
					message: `"status" must be [true]`,
					details: [{ message: `"status" must be [true]`, path: ['status'], type: 'any.only' }],
				},
			]);

			expect(JSON.stringify(err)).not.toMatch(/secret|user-id|role-id/);
		}
	});
});
