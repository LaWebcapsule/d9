import { describe, expect, it } from 'vitest';
import type { Filter } from '@wbce-d9/types';
import { parseFilter } from './parse-filter.js';
import { validatePayload } from './validate-payload.js';

describe('validatePayload', () => {
	it('returns an empty array when there are no errors', () => {
		const mockFilter = { _and: [{ field: { _eq: 'field' } }] } as Filter;
		const mockPayload = { field: 'field' };
		expect(validatePayload(mockFilter, mockPayload)).toStrictEqual([]);
	});

	it('returns an array of 1 when there errors with an _and operator', () => {
		const mockFilter = { _and: [{ field: { _eq: 'field' } }] } as Filter;
		const mockPayload = { field: 'test' };
		expect(validatePayload(mockFilter, mockPayload)).toHaveLength(1);
	});

	it('returns an array of 1 when there errors with an _or operator', () => {
		const mockFilter = { _or: [{ field: { _eq: 'field' } }] } as Filter;
		const mockPayload = { field: 'test' };
		expect(validatePayload(mockFilter, mockPayload)).toHaveLength(1);
	});

	it('returns an array of 1 when there errors with an _or containing _and operators', () => {
		const mockFilter = {
			_or: [
				{
					_and: [{ a: { _eq: 1 } }, { b: { _eq: 1 } }],
				},
				{
					_and: [{ a: { _eq: 2 } }, { b: { _eq: 2 } }],
				},
			],
		} as Filter;

		expect(
			validatePayload(mockFilter, {
				a: 0,
				b: 0,
			})
		).toHaveLength(4);

		expect(
			validatePayload(mockFilter, {
				a: 0,
				b: 1,
			})
		).toHaveLength(3);

		expect(
			validatePayload(mockFilter, {
				a: 1,
				b: 2,
			})
		).toHaveLength(2);

		expect(
			validatePayload(mockFilter, {
				a: 1,
				b: 1,
			})
		).toHaveLength(0);

		expect(
			validatePayload(mockFilter, {
				a: 2,
				b: 2,
			})
		).toHaveLength(0);
	});

	it('returns an empty array when there is no error for filter field that does not exist in payload ', () => {
		const mockFilter = { field: { _eq: 'field' } } as Filter;
		// intentionally empty payload to simulate "field" was never included in payload
		const mockPayload = {};

		expect(validatePayload(mockFilter, mockPayload)).toHaveLength(0);
	});

	it('returns an empty array when there is no error for filter field that does not exist in payload with special function', () => {
		const mockFilter = {
			'count(items)': {
				_lt: '3',
			},
		};

		// intentionally empty payload to simulate "items" was never included in payload
		const mockPayload = {};
		expect(validatePayload(mockFilter, mockPayload)).toHaveLength(0);
	});

	it('returns an array of 1 when there is required error for filter field that does not exist in payload and requireAll option flag is true', () => {
		const mockFilter = { field: { _eq: 'field' } } as Filter;
		// intentionally empty payload to simulate "field" was never included in payload
		const mockPayload = {};

		const errors = validatePayload(mockFilter, mockPayload, { requireAll: true });

		expect(errors).toHaveLength(1);
		expect(errors[0]!.message).toBe(`"field" is required`);
	});

	it('rejects the payload when _in resolves to an empty list from $CURRENT_USER', () => {
		const mockFilter = parseFilter(
			{ role: { _in: '$CURRENT_USER.user_roles.role' } } as Filter,
			{ user: 'user', role: null },
			{ $CURRENT_USER: { user_roles: [] } as any }
		) as Filter;

		expect(validatePayload(mockFilter, { role: 'admin' })).toHaveLength(1);
	});
});
