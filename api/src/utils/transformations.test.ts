import { describe, expect, test } from 'vitest';
import { getMaxOutputDimension } from './transformations.js';

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
