import type { File, Transformation, TransformationParams } from '../types/index.js';

export function resolvePreset(input: TransformationParams, file: File): Transformation[] {
	const transforms = input.transforms ?? [];

	if (input.format || input.quality)
		transforms.push([
			'toFormat',
			input.format || (file.type!.split('/')[1] as any),
			{
				quality: input.quality ? Number(input.quality) : undefined,
			},
		]);

	if (input.width || input.height)
		transforms.push([
			'resize',
			{
				width: input.width ? Number(input.width) : undefined,
				height: input.height ? Number(input.height) : undefined,
				fit: input.fit,
				withoutEnlargement: input.withoutEnlargement ? Boolean(input.withoutEnlargement) : undefined,
			},
		]);

	return transforms;
}

/**
 * Try to extract a file format from an array of `Transformation`'s.
 */
export function maybeExtractFormat(transforms: Transformation[]): string | undefined {
	const toFormats = transforms.filter((t) => t[0] === 'toFormat');
	const lastToFormat = toFormats[toFormats.length - 1];
	return lastToFormat ? lastToFormat[1]?.toString() : undefined;
}

/**
 * Upper bound of the largest side of the image produced by `transforms` from a `width` x `height` source, so a request
 * for a huge output can be refused before Sharp allocates it. An extract or rotation made before the resize changes its
 * input, so every candidate input is considered and the worst case is returned.
 */
export function getMaxOutputDimension(transforms: readonly (readonly any[])[], width: number, height: number): number {
	let inputs: [number, number][] = [[width, height]];
	const outputs: [number, number][] = [];
	let extracted = false;
	let extendX = 0;
	let extendY = 0;

	for (const [method, ...args] of transforms) {
		if (method === 'resize') {
			outputs.push(...inputs.map((input) => getResizeOutput(input, args)));
		} else if (method === 'extract' && outputs.length === 0 && !extracted) {
			// Only the first extract before a resize crops its input, later ones crop its output
			inputs = [[Number(args[0]?.width), Number(args[0]?.height)]];
			extracted = true;
		} else if (method === 'rotate' && outputs.length === 0) {
			inputs = [...inputs, ...inputs.map(([w, h]): [number, number] => [h, w])];
		} else if (method === 'extend') {
			const extend =
				typeof args[0] === 'object' && args[0] !== null
					? args[0]
					: { top: args[0], bottom: args[0], left: args[0], right: args[0] };

			extendX = Math.max(extendX, Number(extend.left ?? 0) + Number(extend.right ?? 0));
			extendY = Math.max(extendY, Number(extend.top ?? 0) + Number(extend.bottom ?? 0));
		}
	}

	// Invalid values are left for Sharp to reject with its own error
	const sides = (outputs.length > 0 ? outputs : inputs).flatMap(([w, h]) => [w + extendX, h + extendY]);
	return Math.max(...sides.filter((side) => !Number.isNaN(side)));
}

function getResizeOutput([inputWidth, inputHeight]: [number, number], args: any[]): [number, number] {
	const options =
		typeof args[0] === 'object' && args[0] !== null ? args[0] : { width: args[0], height: args[1], ...args[2] };

	const width = options.width == null ? undefined : Number(options.width);
	const height = options.height == null ? undefined : Number(options.height);
	const fit = options.fit ?? 'cover';

	// Without enlargement, no side grows beyond the input
	if (options.withoutEnlargement || (width === undefined && height === undefined)) return [inputWidth, inputHeight];

	if (width !== undefined && height !== undefined && !['inside', 'outside'].includes(fit)) return [width, height];

	// A missing side follows the input's aspect ratio
	const scales: number[] = [];
	if (width !== undefined) scales.push(width / inputWidth);
	if (height !== undefined) scales.push(height / inputHeight);
	const scale = fit === 'inside' ? Math.min(...scales) : Math.max(...scales);

	return [Math.round(inputWidth * scale), Math.round(inputHeight * scale)];
}
