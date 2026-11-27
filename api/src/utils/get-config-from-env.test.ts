import { getConfigFromEnv } from '../../src/utils/get-config-from-env.js';
import { describe, test, expect, vi } from 'vitest';

vi.mock('../../src/env', () => {
	const MOCK_ENV = {
		OBJECT_BRAND__COLOR: 'purple',
		OBJECT_BRAND__HEX: '#6644FF',
		CAMELCASE_OBJECT__FIRST_KEY: 'firstValue',
		CAMELCASE_OBJECT__SECOND_KEY: 'secondValue',
		INHERITED_TO_STRING__CALL: 'value',
		ARRAY_LIST__0: 'first',
		ARRAY_LIST__1: 'second',
	};

	return {
		default: MOCK_ENV,
		getEnv: () => MOCK_ENV,
	};
});

describe('get config from env', () => {
	test('Keys with double underscore should be an object', () => {
		expect(getConfigFromEnv('OBJECT_')).toStrictEqual({ brand: { color: 'purple', hex: '#6644FF' } });
	});

	test('Keys with double underscore should be an object with camelCase keys', () => {
		expect(getConfigFromEnv('CAMELCASE_')).toStrictEqual({
			object: { firstKey: 'firstValue', secondKey: 'secondValue' },
		});
	});

	test('Keys named after inherited properties should not write to the prototype', () => {
		expect(getConfigFromEnv('INHERITED_')).toStrictEqual({ toString: { call: 'value' } });
		expect(Object.prototype.hasOwnProperty.call(Object.prototype.toString, 'call')).toBe(false);
		expect(Object.prototype.toString.call([])).toBe('[object Array]');
	});

	test('Numeric keys should create arrays', () => {
		expect(getConfigFromEnv('ARRAY_')).toStrictEqual({ list: ['first', 'second'] });
	});
});
