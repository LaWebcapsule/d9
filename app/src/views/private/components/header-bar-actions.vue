<template>
	<div ref="actionsEl" class="actions" :class="{ active, collapsed }">
		<v-button class="expand" icon rounded secondary outlined @click="active = !active">
			<v-icon name="arrow_left" />
		</v-button>

		<div ref="buttonsEl" class="action-buttons">
			<v-button
				v-if="showSidebarToggle"
				class="sidebar-toggle"
				icon
				rounded
				secondary
				outlined
				@click="$emit('toggle:sidebar')"
			>
				<v-icon name="info" />
			</v-button>

			<slot />
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent, onBeforeUnmount, onMounted, ref } from 'vue';

export default defineComponent({
	props: {
		showSidebarToggle: {
			type: Boolean,
			default: false,
		},
	},
	emits: ['toggle:sidebar'],
	setup() {
		const actionsEl = ref<HTMLElement>();
		const buttonsEl = ref<HTMLElement>();
		const active = ref(false);
		const collapsed = ref(false);

		// Re-measure when the header changes size or buttons come and go (e.g. batch actions), but not when a button changes
		// size: the search input grows when focused and must not collapse the actions it belongs to
		const resizeObserver = new ResizeObserver(() => updateCollapsed());
		const mutationObserver = new MutationObserver(() => updateCollapsed());

		onMounted(() => {
			const header = actionsEl.value?.parentElement;
			if (header) resizeObserver.observe(header);
			if (buttonsEl.value) mutationObserver.observe(buttonsEl.value, { childList: true });

			updateCollapsed();
			// Icon fonts change the button widths once loaded
			document.fonts?.ready.then(() => updateCollapsed());
		});

		onBeforeUnmount(() => {
			resizeObserver.disconnect();
			mutationObserver.disconnect();
		});

		return { actionsEl, buttonsEl, active, collapsed };

		/**
		 * Collapse the buttons only when they do not fit in their half of the header; the other half is for the title.
		 */
		function updateCollapsed() {
			const actions = actionsEl.value;
			const buttons = buttonsEl.value;
			const header = actions?.parentElement;
			if (!actions || !buttons || !header) return;

			// Show every button for one synchronous layout read; it is undone before the browser paints
			actions.classList.add('measuring');
			const buttonsWidth = buttons.offsetWidth;
			actions.classList.remove('measuring');

			const headerStyle = getComputedStyle(header);

			const headerWidth =
				header.clientWidth - parseFloat(headerStyle.paddingLeft) - parseFloat(headerStyle.paddingRight);

			// Other elements next to the actions (e.g. the item count of a layout) share the same half
			let othersWidth = 0;
			let afterSpacer = false;

			for (const child of Array.from(header.children) as HTMLElement[]) {
				if (child.classList.contains('spacer')) {
					afterSpacer = true;
				} else if (afterSpacer && child !== actions) {
					const style = getComputedStyle(child);
					othersWidth += child.offsetWidth + parseFloat(style.marginLeft) + parseFloat(style.marginRight);
				}
			}

			collapsed.value = buttonsWidth + othersWidth > headerWidth / 2;
			if (!collapsed.value) active.value = false;
		}
	},
});
</script>

<style scoped>
.actions {
	position: relative;
	display: flex;
	background-color: transparent;
}

.actions .gradient-wrapper {
	display: contents;
}

.actions .expand {
	--v-icon-color: var(--foreground-normal);

	flex-shrink: 0;
	margin-right: 8px;
}

.actions:not(.collapsed) .expand {
	display: none;
}

.actions .action-buttons {
	display: flex;
	flex-shrink: 0;
}

.actions .action-buttons .v-button.secondary {
	--v-icon-color: var(--foreground-normal);
}

/* Also turns "display: contents" wrappers (e.g. a v-dialog around its activator button) into boxes, so the margin applies */
.actions .action-buttons > :deep(*) {
	display: inherit;
}

.actions .action-buttons > :deep(*:not(:last-child)) {
	margin-right: 8px;
}

.actions.collapsed:not(.active):not(.measuring) .action-buttons > :deep(*:not(:last-child)) {
	display: none;
}

.actions .action-buttons .sidebar-toggle {
	flex-shrink: 0;
}

/* The sidebar is visible from 960px, so its toggle is not needed there */
@media (min-width: 960px) {
	.actions .action-buttons .sidebar-toggle {
		display: none !important;
	}
}

.actions.active {
	position: absolute;
	top: 0;
	right: 0;
	align-items: center;
	justify-content: flex-end;
	height: 100%;
	padding: inherit;
	padding-left: 8px;
	background-color: var(--background-page);
}

.actions.active .expand {
	transform: rotate(180deg);
}
</style>
