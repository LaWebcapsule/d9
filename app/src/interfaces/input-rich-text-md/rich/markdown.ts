import { Editor, type JSONContent } from '@tiptap/core';
import { marked } from 'marked';
import { createRichExtensions } from './extensions';

function withEditor<T>(content: string | JSONContent, contentType: 'markdown' | 'json', fn: (editor: Editor) => T): T {
	const editor = new Editor({ extensions: createRichExtensions(), content, contentType });

	try {
		return fn(editor);
	} finally {
		editor.destroy();
	}
}

export function markdownToRich(markdown: string): JSONContent {
	return withEditor(markdown, 'markdown', (editor) => editor.getJSON());
}

export function richToMarkdown(doc: JSONContent): string {
	return withEditor(doc, 'json', (editor) => editor.getMarkdown());
}

/**
 * Whitespace-normalized HTML as rendered by the app's markdown renderer. `mangle` is off because it
 * randomly entity-encodes email addresses, which would make two renders of the same input differ.
 */
function render(markdown: string): string {
	return marked(markdown, { mangle: false }).replace(/\s+/g, ' ').trim();
}

type Token = { type: string; codeBlockStyle?: string; tokens?: Token[]; items?: Token[]; [key: string]: unknown };

function hasUnsupportedToken(tokens: Token[]): boolean {
	return tokens.some((token) => {
		if (token.type === 'html') return true;
		if (token.type === 'code' && token.codeBlockStyle === 'indented') return true;

		const children: Token[] = [...(token.tokens ?? []), ...(token.items ?? [])];

		if (token.type === 'table') {
			const table = token as unknown as { header: { tokens: Token[] }[]; rows: { tokens: Token[] }[][] };
			for (const cell of [...table.header, ...table.rows.flat()]) children.push(...cell.tokens);
		}

		return hasUnsupportedToken(children);
	});
}

/**
 * Whether the markdown can be edited in Rich text without changing how it renders.
 */
export function isRepresentable(markdown: string): boolean {
	try {
		const tokens = marked.lexer(markdown);

		if (Object.keys(tokens.links).length > 0) return false;
		if (hasUnsupportedToken(tokens as unknown as Token[])) return false;

		return render(richToMarkdown(markdownToRich(markdown))) === render(markdown);
	} catch {
		return false;
	}
}
