import { describe, expect, test } from 'vitest';
import { setOwn } from './set-own.js';

describe('setOwn', () => {
	test('sets nested values from a string path', () => {
		const object: Record<string, any> = {};

		setOwn(object, 'a.b.c', 1);

		expect(object).toEqual({ a: { b: { c: 1 } } });
	});

	test('sets nested values from an array path', () => {
		const object: Record<string, any> = { a: { existing: true } };

		setOwn(object, ['a', 'b.c'], 1);

		expect(object).toEqual({ a: { existing: true, 'b.c': 1 } });
	});

	test('creates arrays for numeric segments', () => {
		const object: Record<string, any> = {};

		setOwn(object, 'a.0.b', 1);
		setOwn(object, ['list', 1], 'x');

		expect(Array.isArray(object['a'])).toBe(true);
		expect(object).toEqual({ a: [{ b: 1 }], list: [undefined, 'x'] });
	});

	test('replaces primitives on the path', () => {
		const object: Record<string, any> = { a: 'string' };

		setOwn(object, 'a.b', 1);

		expect(object).toEqual({ a: { b: 1 } });
	});

	test('does not write through inherited properties', () => {
		const object: Record<string, any> = {};

		setOwn(object, 'toString.call', 1);

		expect(Object.prototype.hasOwnProperty.call(Object.prototype.toString, 'call')).toBe(false);
		expect(Object.prototype.toString.call([])).toBe('[object Array]');
		expect(object).toEqual({ toString: { call: 1 } });
	});

	test.each(['__proto__.polluted', 'a.__proto__.polluted', 'constructor.prototype.polluted', 'a.prototype'])(
		'ignores %s',
		(path) => {
			const object: Record<string, any> = {};

			setOwn(object, path, 1);

			expect((Object.prototype as any).polluted).toBeUndefined();
			expect(object).toEqual({});
		}
	);
});
