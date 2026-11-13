import { describe, expect, it } from 'vitest';
import { hashValue, stableStringify } from './hash-value.js';

describe('stableStringify', () => {
	it('sorts object keys at every level', () => {
		expect(stableStringify({ b: 1, a: { d: 2, c: [{ f: 1, e: 2 }] } })).toBe('{"a":{"c":[{"e":2,"f":1}],"d":2},"b":1}');
	});

	it('treats undefined as null', () => {
		expect(stableStringify(undefined)).toBe('null');
		expect(stableStringify({ a: undefined })).toBe('{"a":null}');
	});

	it('serializes dates as ISO strings', () => {
		expect(stableStringify(new Date('2026-01-01T00:00:00.000Z'))).toBe('"2026-01-01T00:00:00.000Z"');
	});
});

describe('hashValue', () => {
	it('returns a sha256 hex string', () => {
		expect(hashValue('abc')).toBe(hashValue('abc'));
		expect(hashValue('abc')).toMatch(/^[0-9a-f]{64}$/);
	});

	it('is independent of key order', () => {
		expect(hashValue({ a: 1, b: { c: 2, d: 3 } })).toBe(hashValue({ b: { d: 3, c: 2 }, a: 1 }));
	});

	it('distinguishes different values', () => {
		expect(hashValue('1')).not.toBe(hashValue(1));
		expect(hashValue(null)).not.toBe(hashValue(''));
		expect(hashValue([1, 2])).not.toBe(hashValue([2, 1]));
	});

	it('treats null and undefined the same', () => {
		expect(hashValue(null)).toBe(hashValue(undefined));
	});
});
