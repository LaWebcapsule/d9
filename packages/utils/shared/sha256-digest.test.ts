import { describe, expect, it } from 'vitest';
import { sha256Digest, stableStringify } from './sha256-digest.js';

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

describe('sha256Digest', () => {
	it('returns a sha256 hex string', () => {
		expect(sha256Digest('abc')).toBe(sha256Digest('abc'));
		expect(sha256Digest('abc')).toMatch(/^[0-9a-f]{64}$/);
	});

	it('is independent of key order', () => {
		expect(sha256Digest({ a: 1, b: { c: 2, d: 3 } })).toBe(sha256Digest({ b: { d: 3, c: 2 }, a: 1 }));
	});

	it('distinguishes different values', () => {
		expect(sha256Digest('1')).not.toBe(sha256Digest(1));
		expect(sha256Digest(null)).not.toBe(sha256Digest(''));
		expect(sha256Digest([1, 2])).not.toBe(sha256Digest([2, 1]));
	});

	it('treats null and undefined the same', () => {
		expect(sha256Digest(null)).toBe(sha256Digest(undefined));
	});
});
