import path from 'path';
import { mergeConfig } from 'vite';
import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
	async viteFinal(config) {
		return mergeConfig(config, {
			resolve: {
				dedupe: ['@storybook/preview-api'],
				alias: [
					{
						find: '@',
						replacement: path.resolve(__dirname, '..', 'src'),
					},
					// { find: 'json2csv', replacement: 'json2csv/dist/json2csv.umd.js' },
				],
			},
		});
	},

	stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
	addons: ['@storybook/addon-links', '@storybook/addon-essentials', '@storybook/addon-actions'],
	framework: {
		name: '@storybook/vue3-vite',
		options: {},
	},
};

export default config;
