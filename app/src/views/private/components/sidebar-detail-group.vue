<template>
	<v-item-group v-model="openDetail" class="sidebar-detail-group" scope="sidebar-detail" :mandatory="mandatory">
		<slot />
	</v-item-group>
</template>

<script lang="ts">
import { defineComponent, nextTick, onMounted, provide, ref, watch } from 'vue';
export default defineComponent({
	props: {
		sidebarOpen: {
			type: Boolean,
			default: false,
		},
	},
	setup(props) {
		// By syncing the opened item here, we can force close the module once the sidebar closes
		const openDetail = ref<string[]>([]);

		const mandatory = ref(false);

		// A page that mounts with the sidebar already open shows its first section open right away, without animation
		const animate = ref(!props.sidebarOpen);
		provide('sidebar-detail-animate', animate);

		onMounted(async () => {
			if (props.sidebarOpen === false) return;
			await openFirst();
			// Let the opened section render before the transition is enabled again
			await nextTick();
			animate.value = true;
		});

		watch(
			() => props.sidebarOpen,
			async (newOpenState) => {
				if (newOpenState === false) {
					openDetail.value = [];
				} else {
					await openFirst();
				}
			}
		);

		return {
			openDetail,
			mandatory,
		};

		// Ensures the first item in the sidebar is automatically opened whenever the sidebar opens.
		async function openFirst() {
			mandatory.value = true;
			await nextTick();

			// Still allow the user to manually close it afterwards
			mandatory.value = false;
		}
	},
});
</script>

<style lang="scss" scoped>
.sidebar-detail-group {
	display: contents;
}
</style>
