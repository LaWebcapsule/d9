import { describe, expect, it, vi } from 'vitest';

vi.mock('@/composables/use-template-data', () => ({ useTemplateData: vi.fn() }));
vi.mock('@/utils/render-string-template', () => ({ renderStringTemplate: vi.fn() }));

import { getSafeUrl } from './use-preview-url';

describe('getSafeUrl', () => {
	it.each(['https://example.com/blog/my-post?preview=true', 'http://localhost:3000/', '/preview/1'])(
		'keeps the http(s) URL %s',
		(url) => {
			expect(getSafeUrl(url)).toBe(url);
		}
	);

	it.each(['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x'])(
		'rejects the URL %s',
		(url) => {
			expect(getSafeUrl(url)).toBeNull();
		}
	);

	it.each([undefined, null, false, ''])('returns null for the empty value %s', (url) => {
		expect(getSafeUrl(url)).toBeNull();
	});
});
