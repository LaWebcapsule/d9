import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globalSetup: ['./globalSetup.js'],
		exclude: ['dist/**', 'node_modules/**'],
	},
});
