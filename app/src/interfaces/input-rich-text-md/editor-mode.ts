export type EditorModeOption = 'rich-and-markdown' | 'rich-only' | 'markdown-only';
export type EditorMode = 'rich' | 'markdown';

export const MODE_STORAGE_KEY = 'd9.markdown-editor-mode';

export function readStoredMode(): EditorMode | null {
	try {
		const value = localStorage.getItem(MODE_STORAGE_KEY);
		return value === 'rich' || value === 'markdown' ? value : null;
	} catch {
		return null;
	}
}

export function writeStoredMode(mode: EditorMode): void {
	try {
		localStorage.setItem(MODE_STORAGE_KEY, mode);
	} catch {
		// Storage unavailable (private mode, blocked site data): the mode simply isn't remembered.
	}
}

/**
 * Mode the editor opens in. `isRepresentable` is only called when the result depends on it, as the
 * check parses and renders the whole value.
 */
export function resolveInitialMode(args: {
	option: EditorModeOption;
	stored: EditorMode | null;
	isRepresentable: () => boolean;
}): { mode: EditorMode; fellBack: boolean } {
	const { option, stored, isRepresentable } = args;

	if (option === 'markdown-only') return { mode: 'markdown', fellBack: false };

	// rich-and-markdown: honour the stored preference, default to rich when the content allows it.
	if (option === 'rich-and-markdown' && stored === 'markdown') return { mode: 'markdown', fellBack: false };

	return isRepresentable() ? { mode: 'rich', fellBack: false } : { mode: 'markdown', fellBack: true };
}

export function canSwitchTo(
	target: EditorMode,
	args: { option: EditorModeOption; representable: boolean }
): boolean {
	const { option, representable } = args;

	if (target === 'rich') return option !== 'markdown-only' && representable;
	return option !== 'rich-only';
}

export function showModeSwitch(option: EditorModeOption): boolean {
	return option === 'rich-and-markdown';
}
