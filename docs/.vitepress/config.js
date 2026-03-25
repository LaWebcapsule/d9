import { defineConfig } from 'vitepress';
import { URLS, EMAILS } from './constants.js';

// Vite plugin to replace variables in markdown files before processing
function markdownVariablesPlugin() {
	const replacements = {
		'{{WEBSITE_URL}}': URLS.WEBSITE,
		'{{DOCS_URL}}': URLS.DOCS,
		'{{GITHUB_URL}}': URLS.GITHUB,
		'{{GITHUB_DIRECTUS_URL}}': URLS.GITHUB_DIRECTUS,
		'{{GITHUB_COMMUNITY_URL}}': URLS.GITHUB_COMMUNITY,
		'{{LOCALES_URL}}': URLS.LOCALES,
		'{{EXAMPLE_URL}}': URLS.EXAMPLE,
		'{{LDAP_URL}}': URLS.LDAP,
		'{{NPM_URL}}': URLS.NPM,
		'{{DOCKER_HUB_URL}}': URLS.DOCKER_HUB,
		'{{SECURITY_EMAIL}}': EMAILS.SECURITY,
		'{{INFO_EMAIL}}': EMAILS.INFO,
		'{{SUPPORT_EMAIL}}': EMAILS.SUPPORT,
	};

	return {
		name: 'markdown-variables',
		enforce: 'pre',
		transform(code, id) {
			if (!id.endsWith('.md')) return null;

			let result = code;
			for (const [pattern, value] of Object.entries(replacements)) {
				result = result.replaceAll(pattern, value);
			}

			if (result !== code) {
				return { code: result, map: null };
			}
			return null;
		},
	};
}

export default defineConfig({
	base: '/',
	lang: 'en-US',
	title: 'd9 Docs',
	description: 'd9 — Open Data Platform. An Instant App & API for your SQL Database.',
	ignoreDeadLinks: true,
	appearance: "dark",
	vite: {
		plugins: [markdownVariablesPlugin()],
	},
	markdown: {
		theme: { light: 'github-light', dark: 'material-theme-palenight' },
		toc: {
			level: [2],
		},
	},
	head: [
		['meta', { name: 'algolia-site-verification', content: '24FDF59F0748A8B5' }],
		['link', { rel: 'shortcut icon', type: 'image/svg+xml', href: '/favicon.svg' }],
		[
			'link',
			{
				rel: 'apple-touch-icon',
				type: 'image/svg+xml',
				sizes: '180x180',
				href: '/favicon.svg',
			},
		],
		[
			'link',
			{
				rel: 'icon',
				type: 'image/svg+xml',
				sizes: '32x32',
				href: '/favicon.svg',
			},
		],
		[
			'link',
			{
				rel: 'icon',
				type: 'image/svg+xml',
				sizes: '16x16',
				href: '/favicon.svg',
			},
		],
		[
			'link',
			{
				rel: 'preconnect',
				href: 'https://fonts.googleapis.com',
				crossorigin: 'crossorigin',
			},
		],
		[
			'link',
			{
				rel: 'preconnect',
				href: 'https://fonts.gstatic.com',
				crossorigin: 'crossorigin',
			},
		],
		[
			'link',
			{
				rel: 'stylesheet',
				href: 'https://fonts.googleapis.com/css2?family=Material+Icons+Outlined',
			},
		],
		[
			'link',
			{
				rel: 'stylesheet',
				href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap',
			},
		],
	],
	lastUpdated: true,
	themeConfig: {
		siteTitle: false,
		logo: {
			light: '/logo-light.svg',
			dark: '/logo-dark.svg',
		},
		nav: [
			{ text: 'Docs', link: '/' },
			{ text: 'GitHub', link: URLS.GITHUB },
		],
		algolia: {
			appId: 'DZTKF80XYJ',
			apiKey: '6bdc1530bfb01204c81597a74278c4f4',
			indexName: 'd9 documentation',
		},
		sidebar: {
			'/': sidebar(),
		},
		editLink: {
			pattern: `${URLS.GITHUB}/edit/main/docs/:path`,
		},
	},
});

function sidebar() {
	return [
		{
			text: 'Getting Started',
			items: [
				{
					text: 'Introduction',
					link: '/getting-started/introduction',
				},
				{
					text: 'Quickstart Guide',
					link: '/getting-started/quickstart',
				},
				{
					text: 'Architecture',
					link: '/getting-started/architecture',
				},
				{
					text: 'Help & Support',
					link: '/getting-started/support',
				},
				{
					text: 'Supporting d9',
					link: '/getting-started/backing-directus',
				},
				{
					text: 'Resources',
					link: '/getting-started/resources',
				},
				{
					text: 'Glossary',
					link: '/getting-started/glossary',
				},
			],
		},
		{
			text: 'Data Studio App',
			collapsible: true,
			collapsed: true,
			items: [
				{
					link: '/app/overview',
					text: 'Overview',
				},
				{
					link: '/app/content',
					text: 'Content',
					type: 'page',
					items: [
						{
							link: '/app/content/collections',
							text: 'Collection Page',
							type: 'page',
						},
						{
							link: '/app/content/items',
							text: 'Item Page',
						},
						{
							link: '/app/content/shares',
							text: 'Shares',
						},
					],
				},
				{
					link: '/app/user-directory',
					text: 'User Directory',
				},
				{
					link: '/app/file-library',
					text: 'File Library',
				},
				{
					link: '/app/insights',
					text: 'Insights',
				},
				{
					link: '/app/settings',
					text: 'Settings',
				},
				{
					link: '/app/display-templates',
					text: 'Display Templates',
				},
				{
					link: '/app/filters',
					text: 'Filters',
				},
				{
					link: '/app/layouts',
					text: 'Layouts',
				},
				{
					link: '/app/import-export',
					text: 'Import / Export',
				},
				{
					link: '/app/project-settings',
					text: 'Project Settings',
				},
				{
					link: '/app/data-model',
					text: 'Data Model',
					items: [
						{
							link: '/app/data-model/collections',
							text: 'Collections',
						},
						{
							link: '/app/data-model/fields',
							text: 'Fields',
							collapsible: true,
							collapsed: true,
							items: [
								{
									link: '/app/data-model/fields/text-numbers',
									text: 'Text & Numbers',
								},
								{
									link: '/app/data-model/fields/selection',
									text: 'Selection',
								},
								{
									link: '/app/data-model/fields/relational',
									text: 'Relational',
								},
								{
									link: '/app/data-model/fields/presentation',
									text: 'Presentation',
								},
								{
									link: '/app/data-model/fields/groups',
									text: 'Groups',
								},
								{
									link: '/app/data-model/fields/other',
									text: 'Other',
								},
							],
						},
						{
							link: '/app/data-model/relationships',
							text: 'Relationships',
						},
					],
				},
				{
					link: '/app/users-roles-permissions',
					text: 'Users, Roles & Permissions',
					items: [
						{
							link: '/app/users-roles-permissions/users',
							text: 'Users',
						},
						{
							link: '/app/users-roles-permissions/roles',
							text: 'Roles',
						},
						{
							link: '/app/users-roles-permissions/permissions',
							text: 'Permissions',
						},
					],
				},
				{
					link: '/app/presets-bookmarks',
					text: 'Presets & Bookmarks',
				},
				{
					link: '/app/translation-strings',
					text: 'Translation Strings',
				},
				{
					link: '/app/webhooks',
					text: 'Webhooks',
				},
				{
					link: '/app/flows',
					text: 'Flows',
					collapsible: false,
					items: [
						{
							link: '/app/flows/triggers',
							text: 'Triggers',
						},
						{
							link: '/app/flows/operations',
							text: 'Operations',
						},
					],
				},
				{
					link: '/app/activity-log',
					text: 'Activity Log',
				},
			],
		},
		{
			text: 'API Reference',
			collapsible: true,
			collapsed: true,
			items: [
				{
					link: '/reference/introduction',
					text: 'Introduction',
				},
				{
					link: '/reference/authentication',
					text: 'Authentication',
				},
				{
					link: '/reference/query',
					text: 'Global Parameters',
				},
				{
					link: '/reference/filter-rules',
					text: 'Filter Rules',
				},
				{
					link: '/reference/items',
					text: 'Items',
				},
				{
					link: '/reference/files',
					text: 'Files',
				},
				{
					link: '/reference/sdk',
					text: 'JS-SDK',
				},
				{
					link: '/reference/system/activity',
					text: 'Activity',
				},
				{
					link: '/reference/system/collections',
					text: 'Collections',
				},
				{
					link: '/reference/system/dashboards',
					text: 'Dashboards',
				},
				{
					link: '/reference/system/extensions',
					text: 'Extensions',
				},
				{
					link: '/reference/system/fields',
					text: 'Fields',
				},
				{
					link: '/reference/system/flows',
					text: 'Flows',
				},
				{
					link: '/reference/system/folders',
					text: 'Folders',
				},
				{
					link: '/reference/system/notifications',
					text: 'Notifications',
				},
				{
					link: '/reference/system/operations',
					text: 'Operations',
				},
				{
					link: '/reference/system/panels',
					text: 'Panels',
				},
				{
					link: '/reference/system/permissions',
					text: 'Permissions',
				},
				{
					link: '/reference/system/presets',
					text: 'Presets',
				},
				{
					link: '/reference/system/relations',
					text: 'Relations',
				},
				{
					link: '/reference/system/revisions',
					text: 'Revisions',
				},
				{
					link: '/reference/system/roles',
					text: 'Roles',
				},
				{
					link: '/reference/system/schema',
					text: 'Schema',
				},
				{
					link: '/reference/system/server',
					text: 'Server',
				},
				{
					link: '/reference/system/settings',
					text: 'Settings',
				},
				{
					link: '/reference/system/shares',
					text: 'Shares',
				},
				{
					link: '/reference/system/users',
					text: 'Users',
				},
				{
					link: '/reference/system/utilities',
					text: 'Utilities',
				},
				{
					link: '/reference/system/webhooks',
					text: 'Webhooks',
				},
			],
		},
		{
			text: 'Guides',
			collapsible: true,
			collapsed: true,
			items: [
				{
					text: 'Flows',
					items: [
						{ text: 'For Loops In Flows', link: '/guides/flows/flows-for-loop' },
						{ text: 'Slugify Text With Flows', link: '/guides/flows/slugify-text-with-run-script' },
					],
				},
				{
					text: 'Headless CMS',
					items: [
						{ text: 'Content Approval Workflows', link: '/guides/headless-cms/approval-workflows' },
						{
							text: 'Re-Usable Page Components',
							link: '/guides/headless-cms/reusable-components',
						},
						{
							link: '/guides/headless-cms/schedule-content/index.html',
							text: 'Scheduling Future Content',
						},
						{
							link: '/guides/headless-cms/trigger-static-builds/index.html',
							text: 'Trigger Static Site Builds',
						},
						{
							text: 'Build a Static Website',
							link: '/guides/headless-cms/build-static-website/index.html',
						},
					],
				},
				{
					link: '/guides/migration/index.html',
					text: 'Schema Migration',
				},
			],
		},
		{
			text: 'Use Cases',
			collapsible: true,
			collapsed: true,
			items: [
				{
					text: 'Headless CMS',
					items: [
						{
							text: 'Introduction',
							link: '/use-cases/headless-cms/introduction',
						},
						{
							text: 'Concepts',
							link: '/use-cases/headless-cms/concepts',
						},
						{
							text: 'Security Best Practices',
							link: '/use-cases/headless-cms/security',
						},
					],
				},
			],
		},
		{
			text: 'Extensions',
			collapsible: true,
			collapsed: true,
			items: [
				{
					link: '/extensions/introduction',
					text: 'Introduction',
				},
				{
					link: '/extensions/creating-extensions',
					text: 'Creating Extensions',
				},
				{
					link: '/extensions/displays',
					text: 'Displays',
				},
				{
					link: '/extensions/email-templates',
					text: 'Email Templates',
				},
				{
					link: '/extensions/endpoints',
					text: 'Endpoints',
				},
				{
					link: '/extensions/hooks',
					text: 'Hooks',
				},
				{
					link: '/extensions/interfaces',
					text: 'Interfaces',
				},
				{
					link: '/extensions/layouts',
					text: 'Layouts',
				},
				{
					link: '/extensions/migrations',
					text: 'Migrations',
				},
				{
					link: '/extensions/modules',
					text: 'Modules',
				},
				{
					link: '/extensions/operations',
					text: 'Operations',
				},
				{
					link: '/extensions/panels',
					text: 'Panels',
				},
				{
					link: '/extensions/themes',
					text: 'Themes',
				},
				{
					link: '/extensions/bundles',
					text: 'Bundles',
				},
			],
		},
		{
			text: 'Contributing',
			collapsible: true,
			collapsed: true,
			items: [
				{
					link: '/contributing/introduction',
					text: 'Introduction',
				},
				{
					link: '/contributing/codebase-overview',
					text: 'Codebase Overview',
				},
				{
					link: '/contributing/running-locally',
					text: 'Running Locally',
				},
				{
					link: '/contributing/github-ci',
					text: 'GitHub CI',
				},
				{
					link: '/contributing/translations',
					text: 'Translating the App',
				},
			],
		},
		{
			text: 'Self Hosted',
			collapsible: true,
			collapsed: true,
			items: [
				{
					link: '/self-hosted/quickstart',
					text: 'Quickstart',
				},
				{
					link: '/self-hosted/config-options',
					text: 'Config Options',
				},
				{
					link: '/self-hosted/docker-guide',
					text: 'Docker Guide',
				},
				{
					link: '/self-hosted/cli',
					text: 'CLI',
				},
				{
					link: '/self-hosted/sso',
					text: 'Single Sign-On (SSO)',
				},
				{
					type: 'page',
					link: '/self-hosted/upgrades-migrations',
					text: 'Upgrades & Migrations',
				},
			],
		},
	];
}
