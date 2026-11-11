import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import CustomSequencer from './setup/customSequencer.ts';

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			'@common': fromRoot('./common'),
			'@query': fromRoot('./query'),
			'@schema': fromRoot('./schema'),
			'@utils': fromRoot('./utils'),
		},
	},
	test: {
		globalSetup: ['./setup/setup.ts', './setup/teardown.ts'],
		sequence: { sequencer: CustomSequencer },
		fileParallelism: false,
		testTimeout: 15000,
		hookTimeout: 15000,
		reporters: ['verbose'],
	},
});
