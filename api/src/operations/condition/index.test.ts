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

		expect.assertions(1); // ensure catch block is reached

		try {
			config.handler({ filter }, { data } as any);
		} catch (err: any) {
			expect(err).toEqual([{ path: ['status'], type: 'any.only' }]);
		}
	});

	test('throws error array when condition is checking for a field that is not included in data', () => {
		const filter = {
			status: {
				_eq: true,
			},
		};

		const data = {};

		expect.assertions(1); // ensure catch block is reached

		try {
			config.handler({ filter }, { data } as any);
		} catch (err: any) {
			expect(err).toEqual([{ path: ['status'], type: 'any.required' }]);
		}
	});

	test('does not leak the flow data in the thrown errors', () => {
		const filter = {
			status: {
				_eq: true,
			},
		};

		const data = {
			status: false,
			$env: { SECRET: 'env-secret' },
			$accountability: { user: 'user-id', role: 'role-id' },
			$trigger: { headers: { authorization: 'Bearer token' } },
		};

		expect.assertions(1); // ensure catch block is reached

		try {
			config.handler({ filter }, { data } as any);
		} catch (err: any) {
			expect(JSON.stringify(err)).not.toMatch(/env-secret|user-id|role-id|token/);
		}
	});

	test.each([
		['_regex', '^pk_'],
		['_starts_with', 'pk_'],
		['_nstarts_with', 'sk_'],
		['_ends_with', '_pk'],
		['_nends_with', '_123'],
	])('does not leak the tested value with %s', (operator, compareValue) => {
		const filter = {
			$env: {
				SECRET: {
					[operator]: compareValue,
				},
			},
		};

		const data = {
			$env: { SECRET: 'sk_live_123' },
		};

		expect.assertions(1); // ensure catch block is reached

		try {
			config.handler({ filter }, { data } as any);
		} catch (err: any) {
			expect(JSON.stringify(err)).not.toContain('sk_live_123');
		}
	});
});
