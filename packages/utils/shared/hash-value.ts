import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

/**
 * Serialize a value to JSON with object keys sorted at every level, so structurally equal values
 * always produce the same string regardless of key order
 */
export function stableStringify(value: unknown): string {
	return JSON.stringify(normalize(value));
}

/**
 * Generate a SHA-256 hex hash of a (JSON compatible) value. Used to detect concurrent edits:
 * clients send the hash of the value they loaded, the API compares it with the hash of the current value
 */
export function hashValue(value: unknown): string {
	return bytesToHex(sha256(utf8ToBytes(stableStringify(value))));
}

function normalize(value: unknown): unknown {
	if (value === undefined) return null;
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) return value.map(normalize);

	if (value !== null && typeof value === 'object') {
		const result: Record<string, unknown> = {};

		for (const key of Object.keys(value).sort()) {
			result[key] = normalize((value as Record<string, unknown>)[key]);
		}

		return result;
	}

	return value;
}
