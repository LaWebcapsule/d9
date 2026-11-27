const js = require('@eslint/js');
const prettierRecommended = require('eslint-plugin-prettier/recommended');
const vue = require('eslint-plugin-vue');
const globals = require('globals');
const tseslint = require('typescript-eslint');

const defaultRules = {
	// No console statements in production
	'no-console': process.env.NODE_ENV !== 'development' ? 'error' : 'off',
	// No debugger statements in production
	'no-debugger': process.env.NODE_ENV !== 'development' ? 'error' : 'off',
	// Enforce prettier formatting
	'prettier/prettier': 'error',
	'padding-line-between-statements': [
		'error',
		{
			blankLine: 'always',
			prev: [
				'block',
				'block-like',
				'cjs-export',
				'class',
				'export',
				'import',
				'multiline-block-like',
				'multiline-const',
				'multiline-expression',
				'multiline-let',
				'multiline-var',
			],
			next: '*',
		},
		{
			blankLine: 'always',
			prev: ['const', 'let'],
			next: ['block', 'block-like', 'cjs-export', 'class', 'export', 'import'],
		},
		{
			blankLine: 'always',
			prev: '*',
			next: ['multiline-block-like', 'multiline-const', 'multiline-expression', 'multiline-let', 'multiline-var'],
		},
		{ blankLine: 'any', prev: ['export', 'import'], next: ['export', 'import'] },
	],
	'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
};

const tsVueFiles = ['**/*.ts', '**/*.mts', '**/*.vue'];

const forTsVue = (configs) => configs.map((config) => ({ ...config, files: config.files ?? tsVueFiles }));

module.exports = [
	{
		ignores: ['**/.*', '**/dist/', '**/extensions/', 'packages/extensions-sdk/templates/'],
	},
	js.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			// Global variables: Browser and Node.js
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
		rules: {
			...defaultRules,
			// Added to eslint:recommended in ESLint 9/10, not enforced yet
			'no-useless-assignment': 'off',
			'preserve-caught-error': 'off',
		},
	},
	// Configuration for ts/vue files
	...forTsVue(tseslint.configs.recommended),
	...forTsVue(vue.configs['flat/recommended']),
	{
		files: ['**/*.vue'],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser,
			},
		},
	},
	{
		files: tsVueFiles,
		rules: {
			'vue/multi-word-component-names': 'off',
			// It's recommended to turn off this rule on TypeScript projects
			'no-undef': 'off',
			// Allow ts-directive comments (used to suppress TypeScript compiler errors)
			'@typescript-eslint/ban-ts-comment': 'off',
			// Allow usage of the any type (consider to enable this rule later on)
			'@typescript-eslint/no-explicit-any': 'off',
			// Allow usage of require statements (consider to enable this rule later on)
			'@typescript-eslint/no-var-requires': 'off',
			// Allow non-null assertions for now (consider to enable this rule later on)
			'@typescript-eslint/no-non-null-assertion': 'off',
			// Allow unused arguments and variables when they begin with an underscore
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
			],
		},
	},
	prettierRecommended,
];
