// Tests will run sequentially according to this list
export const list = {
	before: [
		{ testFilePath: '/common/seed-database.test.ts' },
		{ testFilePath: '/common/common.test.ts' },
		{ testFilePath: '/routes/schema/schema.test.ts' },
		{ testFilePath: '/routes/collections/crud.test.ts' },
		{ testFilePath: '/routes/fields/change-fields.test.ts' },
		{ testFilePath: '/routes/fields/crud.test.ts' },
	],
	after: [
		{ testFilePath: '/schema/timezone/timezone.test.ts' },
		{ testFilePath: '/schema/timezone/timezone-changed-node-tz-america.test.ts' },
		{ testFilePath: '/schema/timezone/timezone-changed-node-tz-asia.test.ts' },
		{ testFilePath: '/logger/redact.test.ts' },
		{ testFilePath: '/routes/collections/schema-cache.test.ts' },
	],
	// If specified, only run these tests sequentially
	only: [
		// { testFilePath: '/common/seed-database.test.ts' },
		// { testFilePath: '/common/common.test.ts' },
	],
};
