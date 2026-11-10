<template>
	<live-preview v-if="previewURL" :url="previewURL" in-popup @new-window="closePopup" />
</template>

<script setup lang="ts">
import { useCollection } from '@wbce-d9/composables';
import { computed, toRefs } from 'vue';
import { useRoute } from 'vue-router';
import LivePreview from '../components/live-preview.vue';
import { usePreviewUrl } from '../composables/use-preview-url';

interface Props {
	collection: string;
	primaryKey?: string | null;
}

const props = withDefaults(defineProps<Props>(), { primaryKey: null });

const { collection, primaryKey } = toRefs(props);

const { info: collectionInfo } = useCollection(collection);

// The content language being edited in the item page that opened this window
const route = useRoute();
const language = computed(() => (typeof route.query.lang === 'string' ? route.query.lang : null));

const { previewURL } = usePreviewUrl(collectionInfo, primaryKey, language);

function closePopup() {
	window.close();
}
</script>
