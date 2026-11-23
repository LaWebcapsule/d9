import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	canSwitchTo,
	MODE_STORAGE_KEY,
	readStoredMode,
	resolveInitialMode,
	showModeSwitch,
	writeStoredMode,
} from './editor-mode';

describe('resolveInitialMode', () => {
	test.each([
		// option, stored, representable, expected mode, fellBack
		['rich-and-markdown', null, true, 'rich', false],
		['rich-and-markdown', 'markdown', true, 'markdown', false],
		['rich-and-markdown', 'rich', false, 'markdown', true],
		['rich-and-markdown', null, false, 'markdown', true],
		['rich-only', 'markdown', true, 'rich', false],
		['rich-only', null, false, 'markdown', true],
		['markdown-only', 'rich', true, 'markdown', false],
		['markdown-only', null, false, 'markdown', false],
	] as const)('%s / stored=%s / representable=%s → %s', (option, stored, representable, mode, fellBack) => {
		expect(resolveInitialMode({ option, stored, isRepresentable: () => representable })).toEqual({ mode, fellBack });
	});

	test.each([
		['markdown-only', null],
		['markdown-only', 'rich'],
		['rich-and-markdown', 'markdown'],
	] as const)('%s / stored=%s does not check representability', (option, stored) => {
		const isRepresentable = vi.fn(() => true);
		resolveInitialMode({ option, stored, isRepresentable });
		expect(isRepresentable).not.toHaveBeenCalled();
	});
});

describe('canSwitchTo', () => {
	test('rich refused when content not representable', () => {
		expect(canSwitchTo('rich', { option: 'rich-and-markdown', representable: false })).toBe(false);
	});

	test('rich allowed when representable', () => {
		expect(canSwitchTo('rich', { option: 'rich-and-markdown', representable: true })).toBe(true);
	});

	test('markdown always allowed except rich-only', () => {
		expect(canSwitchTo('markdown', { option: 'rich-and-markdown', representable: true })).toBe(true);
		expect(canSwitchTo('markdown', { option: 'rich-only', representable: true })).toBe(false);
	});

	test('nothing allowed for markdown-only except markdown', () => {
		expect(canSwitchTo('rich', { option: 'markdown-only', representable: true })).toBe(false);
	});
});

test('showModeSwitch', () => {
	expect(showModeSwitch('rich-and-markdown')).toBe(true);
	expect(showModeSwitch('rich-only')).toBe(false);
	expect(showModeSwitch('markdown-only')).toBe(false);
});

describe('stored mode', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	test('round-trips', () => {
		writeStoredMode('markdown');
		expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('markdown');
		expect(readStoredMode()).toBe('markdown');
	});

	test('invalid value reads as null', () => {
		localStorage.setItem(MODE_STORAGE_KEY, 'bogus');
		expect(readStoredMode()).toBeNull();
	});

	test('storage throwing is swallowed', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});

		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('blocked');
		});

		expect(readStoredMode()).toBeNull();
		expect(() => writeStoredMode('rich')).not.toThrow();
	});
});
