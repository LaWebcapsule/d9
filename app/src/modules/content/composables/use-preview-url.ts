import { useTemplateData } from '@/composables/use-template-data';
import { Collection } from '@/types/collections';
import { renderStringTemplate } from '@/utils/render-string-template';
import { computed, Ref } from 'vue';

/**
 * Live preview URL of an item, rendered from the `preview_url` template of its collection
 */
export function usePreviewUrl(collection: Ref<Collection | null>, primaryKey: Ref<string | null>) {
	const previewTemplate = computed(() => collection.value?.meta?.preview_url ?? '');

	const { templateData, fetchTemplateValues } = useTemplateData(collection, primaryKey, previewTemplate);

	const previewURL = computed(() => {
		if (!previewTemplate.value) return null;

		const { displayValue } = renderStringTemplate(previewTemplate.value, templateData);

		return getSafeUrl(displayValue.value);
	});

	return { previewURL, fetchTemplateValues };
}

/**
 * The URL is loaded in an iframe of the app: values from the item must not turn it into a `javascript:` URL
 */
export function getSafeUrl(url: string | false | undefined | null): string | null {
	if (!url) return null;

	try {
		const { protocol } = new URL(url, window.location.href);
		return ['http:', 'https:'].includes(protocol) ? url : null;
	} catch {
		return null;
	}
}
