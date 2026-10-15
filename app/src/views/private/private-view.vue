<template>
	<v-info v-if="appAccess === false" center :title="t('no_app_access')" type="danger" icon="block">
		{{ t('no_app_access_copy') }}

		<template #append>
			<v-button to="/logout">{{ t('switch_user') }}</v-button>
		</template>
	</v-info>

	<div v-else class="private-view" :class="{ theme, 'full-screen': fullScreen, resizing }">
		<aside id="navigation" role="navigation" aria-label="Module Navigation" :class="{ 'is-open': navOpen }">
			<module-bar />
			<div class="module-nav alt-colors" :style="{ width: `${moduleNavWidth}px` }">
				<project-info />

				<div class="module-nav-content">
					<slot name="navigation" />
				</div>

				<panel-resize-handle
					class="module-nav-resize-handle"
					edge="right"
					:dragging="moduleNavResize.dragging.value"
					@pointerdown="moduleNavResize.onPointerDown"
					@reset="moduleNavResize.reset"
				/>
			</div>
		</aside>
		<div id="main-content" ref="contentEl" class="content">
			<header-bar
				:small="smallHeader"
				:shadow="headerShadow"
				show-sidebar-toggle
				:title="title"
				@toggle:sidebar="sidebarOpen = !sidebarOpen"
				@primary="navOpen = !navOpen"
			>
				<template v-for="(_, scopedSlotName) in $slots" #[scopedSlotName]="slotData">
					<slot :name="scopedSlotName" v-bind="slotData" />
				</template>
			</header-bar>

			<main>
				<slot />
			</main>
		</div>
		<aside
			id="sidebar"
			ref="sidebarEl"
			role="contentinfo"
			class="alt-colors"
			aria-label="Module Sidebar"
			:class="{ 'is-open': sidebarOpen }"
			:style="{ '--sidebar-width': `${sidebarResize.width.value}px` }"
			@click="openSidebar"
		>
			<panel-resize-handle
				v-if="sidebarOpen"
				class="sidebar-resize-handle"
				edge="left"
				:dragging="sidebarResize.dragging.value"
				@pointerdown="sidebarResize.onPointerDown"
				@reset="sidebarResize.reset"
			/>

			<div class="flex-container">
				<sidebar-detail-group :sidebar-open="sidebarOpen">
					<slot name="sidebar" />
				</sidebar-detail-group>

				<div class="spacer" @click="closeSidebar" />

				<notifications-preview v-model="notificationsPreviewActive" :sidebar-open="sidebarOpen" />
			</div>
		</aside>

		<v-overlay class="nav-overlay" :active="navOpen" @click="navOpen = false" />
		<v-overlay class="sidebar-overlay" :active="sidebarOpen" @click="sidebarOpen = false" />

		<notifications-drawer />
		<notifications-group v-if="notificationsPreviewActive === false" :sidebar-open="sidebarOpen" />
		<notification-dialogs />
	</div>
</template>

<script lang="ts" setup>
import { useElementSize } from '@wbce-d9/composables';
import { usePanelResize } from '@/composables/use-panel-resize';
import { useTitle } from '@/composables/use-title';
import { useWindowSize } from '@/composables/use-window-size';
import { useAppStore } from '@/stores/app';
import { useUserStore } from '@/stores/user';
import { storeToRefs } from 'pinia';
import { computed, provide, ref, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import HeaderBar from './components/header-bar.vue';
import ModuleBar from './components/module-bar.vue';
import NotificationDialogs from './components/notification-dialogs.vue';
import NotificationsDrawer from './components/notifications-drawer.vue';
import NotificationsGroup from './components/notifications-group.vue';
import NotificationsPreview from './components/notifications-preview.vue';
import PanelResizeHandle from './components/panel-resize-handle.vue';
import ProjectInfo from './components/project-info.vue';
import SidebarDetailGroup from './components/sidebar-detail-group.vue';

interface Props {
	title?: string | null;
	smallHeader?: boolean;
	headerShadow?: boolean;
}

const props = withDefaults(defineProps<Props>(), { title: null, smallHeader: false, headerShadow: true });

const { t } = useI18n();

const router = useRouter();

const contentEl = ref<Element>();
const sidebarEl = ref<Element>();
const { width: windowWidth } = useWindowSize();
const { width: sidebarWidth } = useElementSize(sidebarEl);

const { title } = toRefs(props);
const navOpen = ref(false);
const userStore = useUserStore();
const appStore = useAppStore();

const appAccess = computed(() => {
	if (!userStore.currentUser) return true;
	return userStore.currentUser?.role?.app_access || false;
});

const notificationsPreviewActive = ref(false);

const { sidebarOpen, fullScreen } = storeToRefs(appStore);

// 60 = module bar width, 590 = minimum content width
const moduleNavResize = usePanelResize({
	edge: 'right',
	defaultWidth: 220,
	minWidth: 150,
	maxWidth: computed(() => {
		// Sidebar is part of the layout here, and its width changes
		if (windowWidth.value > 1260) return windowWidth.value - (590 + 60 + sidebarWidth.value);
		// 60 = closed sidebar width
		if (windowWidth.value > 960) return windowWidth.value - (590 + 60 + 60);
		// Overlay: keep 60px of the page visible
		return windowWidth.value - (60 + 60);
	}),
	storageKey: 'module-nav-width',
	snap: 10,
});

const moduleNavWidth = moduleNavResize.width;

const sidebarResize = usePanelResize({
	edge: 'left',
	defaultWidth: 280,
	minWidth: 150,
	maxWidth: computed(() => {
		if (windowWidth.value > 1260) return windowWidth.value - (590 + 60 + moduleNavWidth.value);
		// Overlay over the content: keep 60px of it visible
		if (windowWidth.value > 960) return windowWidth.value - (60 + moduleNavWidth.value + 60);
		return windowWidth.value - 60;
	}),
	storageKey: 'sidebar-width',
	snap: 8,
	collapse: {
		threshold: 48,
		onCollapse: () => (sidebarOpen.value = false),
	},
});

const resizing = computed(() => moduleNavResize.dragging.value || sidebarResize.dragging.value);

const theme = computed(() => {
	return userStore.currentUser?.theme || 'auto';
});

provide('main-element', contentEl);

router.afterEach(() => {
	contentEl.value?.scrollTo({ top: 0 });
	fullScreen.value = false;
});

useTitle(title);

// The empty area below the sections closes the open sidebar
function closeSidebar(event: MouseEvent) {
	if (sidebarOpen.value === false) return;
	event.stopPropagation();
	sidebarOpen.value = false;
}

function openSidebar(event: PointerEvent) {
	if (event.target && (event.target as HTMLElement).classList.contains('close') === false) {
		sidebarOpen.value = true;
	}
}
</script>

<style lang="scss" scoped>
.private-view {
	--content-padding: 12px;
	--content-padding-bottom: 60px;
	--layout-offset-top: calc(var(--header-bar-height) - 1px);

	display: flex;
	width: 100%;
	height: 100%;
	overflow-x: hidden;
	background-color: var(--background-page);

	.nav-overlay {
		--v-overlay-z-index: 49;

		@media (min-width: 960px) {
			display: none;
		}
	}

	.sidebar-overlay {
		--v-overlay-z-index: 29;

		@media (min-width: 1260px) {
			display: none;
		}
	}

	#navigation {
		position: fixed;
		top: 0;
		left: 0;
		z-index: 50;
		display: flex;
		height: 100%;
		font-size: 0;
		transform: translateX(-100%);
		transition: transform var(--slow) var(--transition);

		&.is-open {
			transform: translateX(0);
		}

		&:not(.is-open) {
			.module-nav-resize-handle {
				display: none;
			}
		}

		.module-nav {
			position: relative;
			display: inline-block;
			width: 220px;
			height: 100%;
			font-size: 1rem;
			background-color: var(--background-normal);

			&-content {
				--v-list-item-background-color-hover: var(--background-normal-alt);
				--v-list-item-background-color-active: var(--background-normal-alt);

				height: calc(100% - 64px);
				overflow-x: hidden;
				overflow-y: auto;
			}
		}

		@media (min-width: 960px) {
			position: relative;
			transform: none;

			&:not(.is-open) {
				.module-nav-resize-handle {
					display: block;
				}
			}
		}
	}

	#main-content {
		--border-radius: 6px;
		--input-height: 60px;
		--input-padding: 16px; /* (60 - 4 - 24) / 2 */

		position: relative;
		flex-grow: 1;
		width: 100%;
		height: 100%;
		overflow: auto;
		scroll-padding-top: 100px;

		/* Page Content Spacing (Could be converted to Project Setting toggle) */
		font-size: 15px;
		line-height: 24px;

		main {
			display: contents;
		}

		/* Offset for partially visible sidebar */
		@media (min-width: 960px) {
			margin-right: 60px;
		}

		@media (min-width: 1260px) {
			margin-right: 0;
		}
	}

	#sidebar {
		position: fixed;
		top: 0;
		right: 0;
		z-index: 30;
		width: var(--sidebar-width, 280px);
		height: 100%;
		overflow: hidden;
		background-color: var(--background-normal);
		transform: translateX(100%);
		transition: transform var(--slow) var(--transition);

		.spacer {
			flex-grow: 1;
		}

		&.is-open {
			transform: translateX(0);

			// Marks where the sections end and the area that closes the sidebar begins
			.spacer {
				border-top: 1px solid var(--border-normal);
				cursor: pointer;
			}
		}

		.flex-container {
			display: flex;
			flex-direction: column;
			width: var(--sidebar-width, 280px);
			height: 100%;
		}

		@media (min-width: 960px) {
			transform: translateX(calc(100% - 60px));
		}

		@media (min-width: 1260px) {
			position: relative;
			flex-basis: 60px;
			flex-shrink: 0;
			transition: flex-basis var(--slow) var(--transition), transform var(--slow) var(--transition);

			&.is-open {
				flex-basis: var(--sidebar-width, 280px);
			}
		}
	}

	@media (min-width: 600px) {
		--content-padding: 32px;
		--content-padding-bottom: 132px;
	}

	&.resizing {
		cursor: ew-resize;
		user-select: none;

		#sidebar {
			transition: none;
		}
	}

	&.full-screen {
		#navigation {
			position: fixed;
			transform: translateX(-100%);
			transition: none;
		}

		#main-content {
			margin: 0;
		}

		#sidebar {
			position: fixed;
			transform: translateX(100%);
			transition: none;
		}
	}
}
</style>
