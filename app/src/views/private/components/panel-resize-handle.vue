<template>
	<div
		class="panel-resize-handle"
		:class="[`edge-${edge}`, { hover, dragging }]"
		@pointerenter="hover = true"
		@pointerleave="hover = false"
		@pointerdown="$emit('pointerdown', $event)"
		@dblclick="$emit('reset')"
	>
		<div class="grip" />
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
	/** Edge of the panel the handle sits on */
	edge: 'left' | 'right';
	dragging?: boolean;
}

withDefaults(defineProps<Props>(), { dragging: false });

defineEmits<{
	(e: 'pointerdown', event: PointerEvent): void;
	(e: 'reset'): void;
}>();

const hover = ref(false);
</script>

<style lang="scss" scoped>
.panel-resize-handle {
	position: absolute;
	top: 0;
	bottom: 0;
	z-index: 3;
	width: 8px;
	cursor: ew-resize;
	user-select: none;
	touch-action: none;

	// Hit area: 8px inside the panel plus 4px over the content
	&.edge-right {
		right: -4px;
		width: 12px;
	}

	// Inside the panel only: the sidebar clips its overflow, and the page scrollbar runs along its edge
	&.edge-left {
		left: 0;
	}

	// Thin line on the panel border, shown on hover after a short delay (as before) and while dragging
	&::before {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: 2px;
		background-color: var(--primary);
		opacity: 0;
		transition: opacity var(--fast) var(--transition);
		transition-delay: 0;
		content: '';
	}

	&.edge-right::before {
		left: 7px;
	}

	&.hover::before {
		opacity: 1;
		transition-delay: var(--slow);
	}

	&.dragging::before {
		opacity: 1;
		transition-delay: 0;
	}

	// Always visible, so the edge reads as draggable. It sits on the panel border like a tab: square on that side, fully
	// rounded on the other, with no outline along the border
	.grip {
		position: absolute;
		top: 50%;
		width: 6px;
		height: 48px;
		background-color: var(--background-normal-alt);
		// The panel background as outline: separates the grip from the section headers, which share its colour, and blends
		// into the panel elsewhere, where the grip colour already stands out
		border: 1px solid var(--background-normal);
		transform: translateY(-50%);
		transition: background-color var(--fast) var(--transition), border-color var(--fast) var(--transition);
		transition-delay: 0;
		pointer-events: none;

		// Dots: a mask over a coloured layer, so their colour can transition with the grip
		&::after {
			position: absolute;
			top: 50%;
			right: 0;
			left: 0;
			height: 18px;
			background-color: var(--foreground-subdued);
			transform: translateY(-50%);
			transition: background-color var(--fast) var(--transition);
			transition-delay: inherit;
			content: '';
			mask-image: radial-gradient(circle, #000 1px, transparent 1.5px);
			mask-position: center top;
			mask-size: 100% 6px;
		}
	}

	&.edge-left .grip {
		left: 0;
		border-left-width: 0;
		border-radius: 0 6px 6px 0;
	}

	// The handle reaches 4px past the border
	&.edge-right .grip {
		right: 4px;
		border-right-width: 0;
		border-radius: 6px 0 0 6px;
	}

	// Same delay as the line, so the grip does not blink when the pointer only passes by
	&.hover .grip {
		background-color: var(--primary);
		border-color: var(--primary);
		transition-delay: var(--slow);

		&::after {
			background-color: var(--foreground-inverted);
		}
	}

	&.dragging .grip {
		background-color: var(--primary);
		border-color: var(--primary);
		transition-delay: 0;

		&::after {
			background-color: var(--foreground-inverted);
		}
	}
}
</style>
