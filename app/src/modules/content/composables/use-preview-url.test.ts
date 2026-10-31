import { useTemplateData } from '@/composables/use-template-data';
import { Collection } from '@/types/collections';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

vi.mock('@/composables/use-template-data', () => ({ useTemplateData: vi.fn() }));

import { getSafeUrl, usePreviewUrl } from './use-preview-url';

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

describe('usePreviewUrl', () => {
	const templateData = ref<Record<string, any>>();

	beforeEach(() => {
		templateData.value = { slug: 'my-post' };

		vi.mocked(useTemplateData).mockReturnValue({
			templateData,
			loading: ref(false),
			error: ref(null),
			fetchTemplateValues: vi.fn(),
		});
	});

	function collectionWithTemplate(previewUrl: string) {
		return ref({ collection: 'articles', meta: { preview_url: previewUrl } } as unknown as Collection);
	}

	it('renders a template without $lang as before', () => {
		const { previewURL } = usePreviewUrl(
			collectionWithTemplate('https://example.com/{{slug}}?preview=true'),
			ref('1'),
			ref('fa')
		);

		expect(previewURL.value).toBe('https://example.com/my-post?preview=true');
	});

	it('replaces $lang with the content language being edited', () => {
		const language = ref<string | undefined>('de');

		const { previewURL } = usePreviewUrl(
			collectionWithTemplate('https://example.com/{{$lang}}/{{slug}}'),
			ref('1'),
			language
		);

		expect(previewURL.value).toBe('https://example.com/de/my-post');

		language.value = 'fa';

		expect(previewURL.value).toBe('https://example.com/fa/my-post');
	});

	it('returns null while the language of a $lang template is unknown', () => {
		const { previewURL } = usePreviewUrl(
			collectionWithTemplate('https://example.com/{{$lang}}/{{slug}}'),
			ref('1'),
			ref(undefined)
		);

		expect(previewURL.value).toBeNull();
	});

	it('returns null while the item values are not loaded', () => {
		templateData.value = undefined;

		const { previewURL } = usePreviewUrl(collectionWithTemplate('https://example.com/{{slug}}'), ref('1'), ref('de'));

		expect(previewURL.value).toBeNull();
	});
});
