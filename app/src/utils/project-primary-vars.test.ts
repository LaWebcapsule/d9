import { describe, expect, it } from 'vitest';
import { getProjectPrimaryVars, PRIMARY_VARIABLES } from './project-primary-vars';

describe('getProjectPrimaryVars', () => {
	it('returns null without a (valid) color so the stock palette is used', () => {
		expect(getProjectPrimaryVars(null)).toBeNull();
		expect(getProjectPrimaryVars('')).toBeNull();
		expect(getProjectPrimaryVars('not-a-color')).toBeNull();
	});

	it('emits every variable it can later remove', () => {
		expect(Object.keys(getProjectPrimaryVars('#ff0000')!).sort()).toEqual([...PRIMARY_VARIABLES].sort());
	});

	it('uses the normalized project color as is, in every theme', () => {
		expect(getProjectPrimaryVars('#f00')!['--primary']).toBe('#FF0000');
	});

	it('mixes positive steps with the pos color and negative steps with the neg color, like the Sass palette', () => {
		const vars = getProjectPrimaryVars('#6644ff')!;
		expect(vars['--primary-10']).toBe('color-mix(in srgb, var(--primary) 10%, var(--primary-mix-pos))');
		expect(vars['--primary-90']).toBe('color-mix(in srgb, var(--primary) 90%, var(--primary-mix-pos))');
		expect(vars['--primary-110']).toBe('color-mix(in srgb, var(--primary) 90%, var(--primary-mix-neg))');
		expect(vars['--primary-125']).toBe('color-mix(in srgb, var(--primary) 75%, var(--primary-mix-neg))');
		expect(vars['--primary-190']).toBe('color-mix(in srgb, var(--primary) 10%, var(--primary-mix-neg))');
		expect(vars['--primary-alt']).toBe('var(--primary-10)');
	});
});
