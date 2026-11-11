import api from '@/api';
import { Collection } from '@/types/collections';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { useTemplateData } from './use-template-data';

vi.mock('@/api', () => ({ default: { get: vi.fn() } }));
vi.mock('@/utils/adjust-fields-for-displays', () => ({ adjustFieldsForDisplays: (fields: string[]) => fields }));

beforeEach(() => {
	vi.mocked(api.get)
		.mockReset()
		.mockResolvedValue({ data: { data: { slug: 'my-post' } } });
});

test('does not request $-prefixed template variables as fields', async () => {
	const collection = ref({ collection: 'articles', meta: {} } as unknown as Collection);

	const { templateData } = useTemplateData(collection, ref('1'), ref('https://example.com/{{$lang}}/{{slug}}'));

	await flushPromises();

	expect(api.get).toHaveBeenCalledWith('/items/articles/1', { params: { fields: ['slug'] } });
	expect(templateData.value).toEqual({ slug: 'my-post' });
});
