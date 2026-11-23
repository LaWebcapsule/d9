import type { Extensions } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Paragraph from '@tiptap/extension-paragraph';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';

export type RichExtensionsOptions = {
	placeholder?: string;
};

/**
 * Line starts that markdown would read as block syntax (ATX heading, list item, setext underline,
 * thematic break). Inline syntax characters, `<` and `>` are already escaped by @tiptap/markdown.
 */
const BLOCK_SYNTAX_AT_LINE_START: RegExp[] = [
	/^( {0,3})(#)(?=#{0,5}(?:[ \t]|$))/gm,
	/^( {0,3})([-+])(?=[ \t]|$)/gm,
	/^( {0,3}\d{1,9})([.)])(?=[ \t]|$)/gm,
	/^( {0,3})([-=])(?=[-= \t]*$)/gm,
];

/**
 * Backslash-escape paragraph text that would otherwise be parsed as block syntax, so plain text
 * typed in Rich text renders literally.
 */
export function escapeBlockSyntax(markdown: string): string {
	return BLOCK_SYNTAX_AT_LINE_START.reduce((text, pattern) => text.replace(pattern, '$1\\$2'), markdown);
}

const RichParagraph = Paragraph.extend({
	renderMarkdown(node, helpers, context) {
		return escapeBlockSyntax(this.parent?.(node, helpers, context) ?? '');
	},
});

/**
 * Extensions of the Rich text editor. Everything here must round-trip through GFM markdown;
 * StarterKit's underline is disabled because markdown has no underline syntax.
 */
export function createRichExtensions(options: RichExtensionsOptions = {}): Extensions {
	return [
		StarterKit.configure({
			paragraph: false,
			underline: false,
			link: { openOnClick: false, autolink: true },
		}),
		RichParagraph,
		TableKit.configure({ table: { resizable: false } }),
		Image.configure({ inline: false }),
		Placeholder.configure({ placeholder: options.placeholder ?? '' }),
		Markdown,
	];
}
