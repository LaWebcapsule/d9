import { marked } from 'marked';
import { describe, expect, test } from 'vitest';
import { isRepresentable, markdownToRich, richToMarkdown } from './markdown';
import demo from '../demo.md?raw';

const render = (md: string) => marked(md).replace(/\s+/g, ' ').trim();
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
