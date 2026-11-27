import { marked } from 'marked';
import { describe, expect, test } from 'vitest';
import { isRepresentable, markdownToRich, richToMarkdown } from './markdown';
import demo from '../demo.md?raw';

const render = (md: string) => marked(md, { mangle: false }).replace(/\s+/g, ' ').trim();
const roundTrip = (md: string) => richToMarkdown(markdownToRich(md));

describe('supported constructs open in Rich text and render identically', () => {
	test.each([
		['headings', '# One\n\n###### Six'],
		['emphasis', '**bold** *italic* ~~strike~~ `code`'],
		['lists', '- a\n- b\n\n1. one\n2. two'],
		['ordered start', '57. foo\n58. bar'],
		['blockquote', '> quoted'],
		['fenced code with language', '```js\nconst a = 1;\n```'],
		['link with title', '[d9](https://example.com "Title")'],
		['image with title', '![alt](https://example.com/a.png "T")'],
		['autolink', 'see https://example.com'],
		['email autolink', 'mail foo@example.com'],
		['hard break', 'line one  \nline two'],
		['hr', 'a\n\n---\n\nb'],
		['aligned table', '| a | b | c |\n|:--|:-:|--:|\n| 1 | 2 | 3 |'],
	])('%s', (_name, md) => {
		expect(isRepresentable(md)).toBe(true);
		expect(render(roundTrip(md))).toBe(render(md));
	});
});

describe('unsupported constructs fall back', () => {
	test.each([
		['inline html', 'hello <span class="x">there</span>'],
		['html block', '<div>\nblock\n</div>'],
		['reference link', '[foo][1]\n\n[1]: https://example.com'],
		['indented code', 'para\n\n    code line'],
	])('%s', (_name, md) => {
		expect(isRepresentable(md)).toBe(false);
	});

	test('demo.md falls back (uses reference-style links)', () => {
		expect(isRepresentable(demo)).toBe(false);
	});
});

test('empty input is representable and round-trips to empty string', () => {
	expect(isRepresentable('')).toBe(true);
	expect(roundTrip('')).toBe('');
});

test('plain text with markdown-special characters renders literally', () => {
	const doc = {
		type: 'doc',
		content: [{ type: 'paragraph', content: [{ type: 'text', text: '# not a heading *x* a_b [y] {{ a_b }}' }] }],
	};

	const md = richToMarkdown(doc);

	expect(marked(md)).toContain('# not a heading *x* a_b [y] {{ a_b }}');
});

const paragraphs = (...texts: string[]) => ({
	type: 'doc',
	content: texts.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
});

describe('bare URLs typed as plain text are saved as working links', () => {
	test.each([
		['URL at paragraph end', 'More: https://x.com/my_page', 'https://x.com/my_page', 'https://x.com/my_page'],
		['URL mid-paragraph', 'See https://x.com/my_page for more', 'https://x.com/my_page', 'https://x.com/my_page'],
		['www URL', 'Go to www.example.com/a_b', 'http://www.example.com/a_b', 'www.example.com/a_b'],
		['email', 'Mail first_last@example.com', 'mailto:first_last@example.com', 'first_last@example.com'],
	])('%s', (_name, text, href, linkText) => {
		const html = marked(richToMarkdown(paragraphs(text)), { mangle: false });
		const anchor = new DOMParser().parseFromString(html, 'text/html').querySelector('a');

		expect(html).not.toContain('%5C');
		expect(html).not.toContain('\\');
		expect(anchor?.getAttribute('href')).toBe(href);
		expect(anchor?.textContent).toBe(linkText);
	});

	test('text a URL is only part of stays as typed', () => {
		const html = marked(richToMarkdown(paragraphs('See https://x.com/my_page, then *stars* and a_b')), {
			mangle: false,
		});

		expect(new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim()).toBe(
			'See https://x.com/my_page, then *stars* and a_b'
		);
	});
});

test.each([
	['four spaces', '    four spaces'],
	['tab', '\ttabbed'],
])('a plain-text paragraph starting with %s stays a paragraph', (_name, text) => {
	const html = marked(richToMarkdown(paragraphs('intro', text)), { mangle: false });

	expect(html).not.toContain('<pre');
	expect(html).toContain(`<p>${text.trim()}</p>`);
});

test.each([
	['Issue #', 1],
	['Issue ##', 2],
	['#', 3],
	['C#', 1],
])('heading text %j keeps its trailing #', (text, level) => {
	const doc = { type: 'doc', content: [{ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] }] };

	expect(marked(richToMarkdown(doc), { mangle: false }).trim()).toMatch(
		new RegExp(`^<h${level}[^>]*>${text}</h${level}>$`)
	);
});
