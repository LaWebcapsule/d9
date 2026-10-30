<template>
	<live-preview v-if="previewURL" :url="previewURL" in-popup @new-window="closePopup" />
</template>

<script setup lang="ts">
import { useCollection } from '@wbce-d9/composables';
import { toRefs } from 'vue';
import LivePreview from '../components/live-preview.vue';
import { usePreviewUrl } from '../composables/use-preview-url';

interface Props {
	collection: string;
	primaryKey?: string | null;
}

const props = withDefaults(defineProps<Props>(), { primaryKey: null });

const { collection, primaryKey } = toRefs(props);

const { info: collectionInfo } = useCollection(collection);

const { previewURL } = usePreviewUrl(collectionInfo, primaryKey);

function closePopup() {
	window.close();
}
</script>
