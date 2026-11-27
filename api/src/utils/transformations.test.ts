import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import type { Transformation } from '../types/index.js';
import { capResizeAfterTrim, getMaxOutputDimension } from './transformations.js';

describe('getMaxOutputDimension', () => {
	test.each<[string, any[][], number]>([
		['no resize', [['blur', 1]], 6000],
		['explicit size', [['resize', { width: 200, height: 100 }]], 200],
		['positional size', [['resize', 200, 100]], 200],
		['missing side follows the aspect ratio', [['resize', { width: 6000 }]], 36000000],
		['fit outside grows the other side', [['resize', { width: 6000, height: 6000, fit: 'outside' }]], 36000000],
		['fit inside', [['resize', { width: 6000, height: 6000, fit: 'inside' }]], 6000],
		['without enlargement', [['resize', { width: 20000, withoutEnlargement: true }]], 6000],
		[
			'extract before resize',
			[
				['extract', { left: 0, top: 0, width: 1, height: 1 }],
				['resize', 6000],
			],
			6000,
		],
		[
			'rotate before resize',
			[
				['rotate', 90],
				['resize', null, 6000],
			],
			36000000,
		],
		['extend', [['extend', { top: 10, bottom: 10 }]], 6020],
	])('%s', (_, transforms, expected) => {
		expect(getMaxOutputDimension(transforms, 1, 6000)).toBe(expected);
	});

	test('leaves invalid values to Sharp', () => {
		expect(getMaxOutputDimension([['resize', { width: 'XYZ' as any }]], 100, 100)).toBe(-Infinity);
	});
});

describe('capResizeAfterTrim', () => {
	test.each<[string, any, any[][]]>([
		['no trim', [['resize', { width: 6000 }]], [['resize', { width: 6000 }]]],
		[
			'missing height',
			[['trim'], ['resize', { width: 6000 }]],
			[['trim'], ['resize', { width: 6000, height: 6000, fit: 'inside' }]],
		],
		[
			'missing width, positional',
			[['trim'], ['resize', null, 300, { withoutEnlargement: true }]],
			[['trim'], ['resize', { width: 6000, height: 300, fit: 'inside', withoutEnlargement: true }]],
		],
		[
			'trim after the resize',
			[
				['resize', 300],
				['trim', { threshold: 0 }],
			],
			[
				['resize', { width: 300, height: 6000, fit: 'inside' }],
				['trim', { threshold: 0 }],
			],
		],
		[
			'both sides set',
			[['trim'], ['resize', { width: 300, height: 200, fit: 'cover' }]],
			[['trim'], ['resize', { width: 300, height: 200, fit: 'cover' }]],
		],
	])('%s', (_, transforms, expected) => {
		expect(capResizeAfterTrim(transforms, 6000)).toEqual(expected);
	});

	test.each([[{ width: 300, fit: 'outside' }], [{ width: 300, height: 300, fit: 'outside' }]])(
		'refuses fit outside with a trim (%o)',
		(options) => {
			expect(() => capResizeAfterTrim([['trim'], ['resize', options as any]], 6000)).toThrow(/outside/);
		}
	);

	test('keeps a trimmed resize within the limit, extend still counted on top', () => {
		const capped = capResizeAfterTrim(
			[['trim'], ['resize', { width: 6000 }], ['extend', { top: 10, bottom: 10 }]] as Transformation[],
			6000
		);

		// The worst case of a capped resize no longer depends on what the trim leaves
		expect(getMaxOutputDimension(capped, 1, 6000)).toBe(6020);
		expect(getMaxOutputDimension(capped, 6000, 1)).toBe(6020);
		expect(getMaxOutputDimension(capped, 1, 1)).toBe(6020);
	});

	test('caps the output of a real trim that leaves a 1px wide strip', async () => {
		// A 1x600 black line on a 20x600 white canvas: the trim leaves 1x600, so a 600px wide resize would be 600x360000
		const input = await sharp({ create: { width: 20, height: 600, channels: 3, background: '#fff' } })
			.composite([{ input: { create: { width: 1, height: 600, channels: 3, background: '#000' } }, left: 10, top: 0 }])
			.png()
			.toBuffer();

		const transformer = sharp(input);

		capResizeAfterTrim([['trim'], ['resize', { width: 600 }]], 600).forEach(([method, ...args]) =>
			(transformer[method] as any).apply(transformer, args)
		);

		const { info } = await transformer.raw().toBuffer({ resolveWithObject: true });

		expect(Math.max(info.width, info.height)).toBeLessThanOrEqual(600);
	});
});
