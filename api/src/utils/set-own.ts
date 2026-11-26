import { toPath } from 'lodash-es';

const forbiddenKeys = ['__proto__', 'constructor', 'prototype'];

/**
 * Set a value at a path, like lodash `set`, but only ever walk the object's own properties.
 *
 * A path segment named after an inherited property (e.g. `toString`) gets a new own container instead of resolving
 * to the shared built-in, so the write can't land on a prototype. Paths containing `__proto__`, `constructor` or
 * `prototype` are ignored entirely. Missing containers are created as arrays when the next segment is an index.
 */
export function setOwn(object: Record<string, any>, path: string | readonly (string | number)[], value: unknown): void {
	const keys = toPath(path);

	if (keys.some((key) => forbiddenKeys.includes(key))) return;

	let target = object;

	for (const [index, key] of keys.entries()) {
		if (index === keys.length - 1) {
			target[key] = value;
			return;
		}

		const current = Object.hasOwn(target, key) ? target[key] : undefined;

		if (current === null || (typeof current !== 'object' && typeof current !== 'function')) {
			target[key] = /^(?:0|[1-9]\d*)$/.test(keys[index + 1]!) ? [] : {};
		}

		target = target[key];
	}
}
