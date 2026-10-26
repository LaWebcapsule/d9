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
const MIN_CRYSTAL_COUNT = 40;
const MIN_WIDTH = 2;
const MAX_WIDTH = 15;
const MIN_SPEED = 6;
const MAX_SPEED = 35;
const HUE_SPREAD = 40;
const GLOW = 10;
const SPRITE_PADDING = GLOW * 2;
const FRAME_INTERVAL = 1000 / 60;
// Account for sub-millisecond requestAnimationFrame timestamp variance around the 60 FPS boundary.
const FRAME_TOLERANCE = 1;

interface Crystal {
	x: number;
	y: number;
	speed: number;
	sprite: HTMLCanvasElement;
}

const container = ref<HTMLDivElement>();
const canvas = ref<HTMLCanvasElement>();

let context: CanvasRenderingContext2D | null = null;

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
let resizeFrame: number | null = null;
let lastTime = 0;
let elapsedTime = 0;
let observer: ResizeObserver | null = null;
let reducedMotion = false;
let motionQuery: MediaQueryList | null = null;

onMounted(() => {
	if (!container.value) return;

	motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
	reducedMotion = motionQuery?.matches ?? false;
	motionQuery?.addEventListener?.('change', handleMotionPreference);
	document.addEventListener('visibilitychange', syncAnimation);

	observer = new ResizeObserver(scheduleResize);
	observer.observe(container.value);
	resize();
});

onBeforeUnmount(() => {
	stopAnimation();
	if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
	observer?.disconnect();
	motionQuery?.removeEventListener?.('change', handleMotionPreference);
	document.removeEventListener('visibilitychange', syncAnimation);
});

watch(tint, () => {
	seed();
	draw();
});

function scheduleResize() {
	if (resizeFrame !== null) return;

	resizeFrame = requestAnimationFrame(() => {
		resizeFrame = null;
		resize();
	});
}

function resize() {
	if (!container.value || !canvas.value) return;

	const nextWidth = container.value.clientWidth;
	const nextHeight = container.value.clientHeight;
	if (nextWidth === width && nextHeight === height) return;

	width = canvas.value.width = nextWidth;
	height = canvas.value.height = nextHeight;
	context = canvas.value.getContext('2d');

	if (context) context.globalCompositeOperation = 'lighter';

	seed();
	draw();
	syncAnimation();
}

function seed() {
	if (width === 0 || height === 0) {
		crystals = [];
		return;
	}

	const maxHeight = height * 0.9;
	const minHeight = height * 0.5;
	const count = Math.min(CRYSTAL_COUNT, Math.max(MIN_CRYSTAL_COUNT, Math.round(width / 16)));

	crystals = Array.from({ length: count }, () => {
		const w = Math.random() * (MAX_WIDTH - MIN_WIDTH) + MIN_WIDTH;
		const h = Math.random() * (maxHeight - minHeight) + minHeight;
		const hue = tint.value.hue + (Math.random() * 2 - 1) * HUE_SPREAD;

		return {
			x: Math.random() * width,
			y: (Math.random() * height) / 2,
			speed: Math.random() * (MAX_SPEED - MIN_SPEED) + MIN_SPEED,
			sprite: createCrystalSprite(w, h, hue),
		};
	});
}

function createCrystalSprite(w: number, h: number, hue: number) {
	const sprite = document.createElement('canvas');
	sprite.width = Math.ceil(w + SPRITE_PADDING * 2);
	sprite.height = Math.ceil(h + SPRITE_PADDING * 2);

	const ctx = sprite.getContext('2d');
	if (!ctx) return sprite;

	const saturation = tint.value.saturation;
	const gradient = ctx.createLinearGradient(SPRITE_PADDING, SPRITE_PADDING, SPRITE_PADDING + w, SPRITE_PADDING + h);
	gradient.addColorStop(0, `hsl(${hue} ${saturation}% 50% / 0)`);
	gradient.addColorStop(0.2, `hsl(${hue} ${saturation}% 50% / 0.5)`);
	gradient.addColorStop(0.5, `hsl(${hue} ${Math.min(saturation + 20, 100)}% 60% / 0.8)`);
	gradient.addColorStop(0.8, `hsl(${hue} ${saturation}% 50% / 0.5)`);
	gradient.addColorStop(1, `hsl(${hue} ${saturation}% 50% / 0)`);

	ctx.shadowBlur = GLOW;
	ctx.shadowColor = `hsl(${hue} ${saturation}% 50%)`;
	ctx.fillStyle = gradient;
	ctx.fillRect(SPRITE_PADDING, SPRITE_PADDING, w, h);

	return sprite;
}

function tick(time: number) {
	frame = null;
	if (!shouldAnimate()) return;

	const delta = lastTime ? Math.min(time - lastTime, 100) : FRAME_INTERVAL;
	lastTime = time;
	elapsedTime += delta;

	if (elapsedTime >= FRAME_INTERVAL - FRAME_TOLERANCE) {
		const elapsedFrames = Math.max(1, Math.floor((elapsedTime + FRAME_TOLERANCE) / FRAME_INTERVAL));
		const movementDelta = elapsedFrames * FRAME_INTERVAL;
		elapsedTime = Math.max(0, elapsedTime - movementDelta);

		// Original pen moved `speed / 100` px per frame at 60fps
		for (const crystal of crystals) {
			crystal.x += (crystal.speed / 100) * 0.06 * movementDelta;
			if (crystal.x > width + MAX_WIDTH) crystal.x = -MAX_WIDTH;
		}

		draw();
	}

	frame = requestAnimationFrame(tick);
}

function draw() {
	if (!context) return;

	context.clearRect(0, 0, width, height);

	for (const { x, y, sprite } of crystals) {
		context.drawImage(sprite, x - SPRITE_PADDING, y - SPRITE_PADDING);
	}
}

function shouldAnimate() {
	return !reducedMotion && width > 0 && height > 0 && document.visibilityState !== 'hidden';
}

function syncAnimation() {
	if (shouldAnimate()) startAnimation();
	else stopAnimation();
}

function startAnimation() {
	if (frame !== null) return;
	frame = requestAnimationFrame(tick);
}

function stopAnimation() {
	if (frame !== null) cancelAnimationFrame(frame);
	frame = null;
	lastTime = 0;
	elapsedTime = 0;
}

function handleMotionPreference(event: MediaQueryListEvent) {
	reducedMotion = event.matches;
	draw();
	syncAnimation();
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
