import type { Editor, Extensions, JSONContent } from '@tiptap/core';
import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import Paragraph from '@tiptap/extension-paragraph';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import { find } from 'linkifyjs';

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
 * typed in Rich text renders literally. Leading whitespace is dropped: four spaces or a tab would make
 * the paragraph an indented code block, and markdown ignores up to three anyway.
 */
export function escapeBlockSyntax(markdown: string): string {
	return BLOCK_SYNTAX_AT_LINE_START.reduce(
		(text, pattern) => text.replace(pattern, '$1\\$2'),
		markdown.replace(/^[ \t]+/, '')
	);
}

/** URL starts that GFM (as rendered by marked) autolinks in plain text. */
const GFM_AUTOLINK_START = /^(?:(?:https?|ftp):\/\/|www\.)/i;

const hasMark = (node: JSONContent, types: string[]) => (node.marks ?? []).some((mark) => types.includes(mark.type));

/**
 * Split a plain text node so bare URLs and email addresses carry a link mark. Plain text is
 * backslash-escaped on serialization, which would put a literal backslash into the URL marked autolinks.
 */
function linkifyTextNode(node: JSONContent): JSONContent[] {
	const text = node.text ?? '';
	if (hasMark(node, ['link', 'code'])) return [node];

	const matches = find(text).filter(
		(match) => match.type === 'email' || (match.type === 'url' && GFM_AUTOLINK_START.test(match.value))
	);

	if (matches.length === 0) return [node];

	const pieces: JSONContent[] = [];
	let position = 0;

	const pushText = (piece: string, marks = node.marks) => {
		if (piece) pieces.push({ ...node, text: piece, ...(marks?.length ? { marks } : {}) });
	};

	for (const match of matches) {
		pushText(text.slice(position, match.start));

		const href =
			match.type === 'email'
				? `mailto:${match.value}`
				: match.value.startsWith('www.')
				? `http://${match.value}`
				: match.value;

		pushText(match.value, [...(node.marks ?? []), { type: 'link', attrs: { href } }]);
		position = match.end;
	}

	pushText(text.slice(position));

	return pieces;
}

/**
 * Copy of the document where bare URLs and email addresses in plain text are link marks.
 */
export function linkifyBareUrls(node: JSONContent): JSONContent {
	if (!node.content || node.type === 'codeBlock') return node;

	return {
		...node,
		content: node.content.flatMap((child) =>
			child.type === 'text' ? linkifyTextNode(child) : [linkifyBareUrls(child)]
		),
	};
}

/**
 * The editor's document as markdown. Use instead of `editor.getMarkdown()`.
 */
export function serializeMarkdown(editor: Editor): string {
	return editor.markdown?.serialize(linkifyBareUrls(editor.getJSON())) ?? '';
}

/**
 * Backslash-escape a trailing run of `#` in heading markdown; markdown reads it as the optional closing
 * sequence of an ATX heading and drops it.
 */
export function escapeClosingHashes(markdown: string): string {
	return markdown.replace(/([ \t])(#+[ \t]*)$/, '$1\\$2');
}

const RichHeading = Heading.extend({
	renderMarkdown(node, helpers, context) {
		return escapeClosingHashes(this.parent?.(node, helpers, context) ?? '');
	},
});

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
			heading: false,
			underline: false,
			link: { openOnClick: false, autolink: true },
		}),
		RichParagraph,
		RichHeading,
		TableKit.configure({ table: { resizable: false } }),
		Image.configure({ inline: false }),
		Placeholder.configure({ placeholder: options.placeholder ?? '' }),
		Markdown,
	];
}
