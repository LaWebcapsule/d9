<template>
	<transition name="expand-transition" mode="in-out" :css="!disabled" v-on="disabled ? {} : methods">
		<slot />
	</transition>
</template>

<script setup lang="ts">
import ExpandMethods from './expand-methods';

interface Props {
	/** Expand on the horizontal instead vertical axis */
	xAxis?: boolean;
	/** Add a custom class to the element that is expanded */
	expandedParentClass?: string;
	/** Show and hide instantly, without the transition */
	disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	xAxis: false,
	expandedParentClass: '',
	disabled: false,
});

const emit = defineEmits([
	'beforeEnter',
	'enter',
	'afterEnter',
	'enterCancelled',
	'beforeLeave',
	'leave',
	'afterLeave',
	'leaveCancelled',
]);

const methods = ExpandMethods(props.expandedParentClass, props.xAxis, emit);
</script>
