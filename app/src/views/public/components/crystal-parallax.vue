<template>
	<div ref="container" class="crystal-parallax" :style="styles">
		<canvas ref="canvas" />
		<div class="vignette" />
	</div>
</template>

<script lang="ts" setup>
/**
 * Animated "crystal" background for the public (login) pages, tinted by the project color.
 * Adapted from "Crystal Parallax" by Tibixx (https://codepen.io/Tibixx/pen/xmOaWe), MIT licensed.
 */
import Color from 'color';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

interface Props {
	/** Any CSS color, usually the instance primary color */
	color: string;
}

const props = defineProps<Props>();

const CRYSTAL_COUNT = 100;
const MIN_WIDTH = 2;
const MAX_WIDTH = 15;
const MIN_SPEED = 6;
const MAX_SPEED = 35;
const HUE_SPREAD = 40;
const GLOW = 10;

interface Crystal {
	x: number;
	y: number;
	w: number;
	h: number;
	hue: number;
	speed: number;
}

const container = ref<HTMLDivElement>();
const canvas = ref<HTMLCanvasElement>();

const tint = computed(() => {
	let hsl: { h: number; s: number; l: number };

	try {
		hsl = Color(props.color).hsl().object() as { h: number; s: number; l: number };
	} catch {
		hsl = { h: 250, s: 100, l: 63 };
	}

	return { hue: Number.isNaN(hsl.h) ? 0 : hsl.h, saturation: Math.min(hsl.s, 70) };
});

const styles = computed(() => {
	const { hue, saturation } = tint.value;
	const base = `hsl(${hue} ${Math.min(saturation, 50)}% 8%)`;

	return {
		'--crystal-base': base,
		'--crystal-glow': `hsl(${hue} ${saturation}% 50% / 0.8)`,
	};
});

let crystals: Crystal[] = [];
let width = 0;
let height = 0;
let frame: number | null = null;
let lastTime = 0;
let observer: ResizeObserver | null = null;

const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

onMounted(() => {
	if (!container.value) return;

	observer = new ResizeObserver(resize);
	observer.observe(container.value);
	resize();

	if (reducedMotion) draw();
	else frame = requestAnimationFrame(tick);
});

onBeforeUnmount(() => {
	if (frame !== null) cancelAnimationFrame(frame);
	observer?.disconnect();
});

watch(tint, () => {
	seed();
	if (reducedMotion) draw();
});

function resize() {
	if (!container.value || !canvas.value) return;

	width = canvas.value.width = container.value.clientWidth;
	height = canvas.value.height = container.value.clientHeight;

	seed();
	if (reducedMotion) draw();
}

function seed() {
	const maxHeight = height * 0.9;
	const minHeight = height * 0.5;

	crystals = Array.from({ length: CRYSTAL_COUNT }, () => ({
		x: Math.random() * width,
		y: (Math.random() * height) / 2,
		w: Math.random() * (MAX_WIDTH - MIN_WIDTH) + MIN_WIDTH,
		h: Math.random() * (maxHeight - minHeight) + minHeight,
		hue: tint.value.hue + (Math.random() * 2 - 1) * HUE_SPREAD,
		speed: Math.random() * (MAX_SPEED - MIN_SPEED) + MIN_SPEED,
	}));
}

function tick(time: number) {
	const delta = lastTime ? Math.min(time - lastTime, 100) : 16;
	lastTime = time;

	// Original pen moved `speed / 100` px per frame at 60fps
	for (const crystal of crystals) {
		crystal.x += (crystal.speed / 100) * 0.06 * delta;
		if (crystal.x > width + MAX_WIDTH) crystal.x = -MAX_WIDTH;
	}

	draw();
	frame = requestAnimationFrame(tick);
}

function draw() {
	const ctx = canvas.value?.getContext('2d');
	if (!ctx) return;

	const saturation = tint.value.saturation;

	ctx.clearRect(0, 0, width, height);
	ctx.globalCompositeOperation = 'lighter';
	ctx.shadowBlur = GLOW;

	for (const { x, y, w, h, hue } of crystals) {
		const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
		gradient.addColorStop(0, `hsl(${hue} ${saturation}% 50% / 0)`);
		gradient.addColorStop(0.2, `hsl(${hue} ${saturation}% 50% / 0.5)`);
		gradient.addColorStop(0.5, `hsl(${hue} ${Math.min(saturation + 20, 100)}% 60% / 0.8)`);
		gradient.addColorStop(0.8, `hsl(${hue} ${saturation}% 50% / 0.5)`);
		gradient.addColorStop(1, `hsl(${hue} ${saturation}% 50% / 0)`);

		ctx.shadowColor = `hsl(${hue} ${saturation}% 50%)`;
		ctx.fillStyle = gradient;
		ctx.fillRect(x, y, w, h);
	}
}
</script>

<style lang="scss" scoped>
.crystal-parallax {
	overflow: hidden;
	background-color: var(--crystal-base);
	background-image: radial-gradient(ellipse at center, var(--crystal-glow) 0%, transparent 100%);

	canvas {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.vignette {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		background: radial-gradient(
			ellipse at center,
			transparent 10%,
			color-mix(in srgb, var(--crystal-base) 80%, transparent) 80%,
			var(--crystal-base) 100%
		);
	}
}
</style>
