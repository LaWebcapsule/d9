/* eslint-disable no-console */

import { globbySync } from 'globby';
import { paths } from '@common/config.ts';
import { ClearCaches, DisableTestCachingSetup } from '@common/functions.ts';
import { list } from '../setup/sequentialTests.js';

import { seedDBStructure as seedCommon } from '../common/common.seed.ts';
import { seedDBStructure as seedChangeFields } from '../routes/fields/change-fields.seed.ts';
import { seedDBStructure as seedCrud } from '../routes/fields/crud.seed.ts';
import { seedDBStructure as seedConcealFilter } from '../routes/items/conceal-filter.seed.ts';
import { seedDBStructure as seedHashFilter } from '../routes/items/hash-filter.seed.ts';
import { seedDBStructure as seedSystemFields } from '../routes/items/system-fields.seed.ts';
import { seedDBStructure as seedM2A } from '../routes/items/m2a.seed.ts';
import { seedDBStructure as seedM2M } from '../routes/items/m2m.seed.ts';
import { seedDBStructure as seedM2O } from '../routes/items/m2o.seed.ts';
import { seedDBStructure as seedNoRelation } from '../routes/items/no-relation.seed.ts';
import { seedDBStructure as seedO2M } from '../routes/items/o2m.seed.ts';
import { seedDBStructure as seedSingleton } from '../routes/items/singleton.seed.ts';
import { seedDBStructure as seedSchema } from '../routes/schema/schema.seed.ts';

describe('Seed Database Structure', () => {
	DisableTestCachingSetup();

	const allSeeds = [
		{ path: 'common/common.seed.ts', seedFn: seedCommon },
		{ path: 'routes/fields/change-fields.seed.ts', seedFn: seedChangeFields },
		{ path: 'routes/fields/crud.seed.ts', seedFn: seedCrud },
		{ path: 'routes/items/conceal-filter.seed.ts', seedFn: seedConcealFilter },
		{ path: 'routes/items/hash-filter.seed.ts', seedFn: seedHashFilter },
		{ path: 'routes/items/system-fields.seed.ts', seedFn: seedSystemFields },
		{ path: 'routes/items/m2a.seed.ts', seedFn: seedM2A },
		{ path: 'routes/items/m2m.seed.ts', seedFn: seedM2M },
		{ path: 'routes/items/m2o.seed.ts', seedFn: seedM2O },
		{ path: 'routes/items/no-relation.seed.ts', seedFn: seedNoRelation },
		{ path: 'routes/items/o2m.seed.ts', seedFn: seedO2M },
		{ path: 'routes/items/singleton.seed.ts', seedFn: seedSingleton },
		{ path: 'routes/schema/schema.seed.ts', seedFn: seedSchema },
	];

	const foundSeeds: string[] = globbySync('**/*.seed.ts', { cwd: paths.cwd, deep: 3 });

	const missingSeeds = foundSeeds.filter((seedPath) => !allSeeds.some((s) => s.path === seedPath));

	if (missingSeeds.length > 0) {
		test('Seed files are missing', () => {
			console.warn(missingSeeds);
			expect(false).toBe(true);
		});
	}

	let seedsToRun = allSeeds;

	if (list.only.length > 0) {
		const requiredPaths = list.only.map((testEntry) => {
			return testEntry.testFilePath.slice(1).replace('.test.ts', '.seed.ts');
		});

		seedsToRun = seedsToRun.filter((seed) => {
			return requiredPaths.includes(seed.path);
		});
	}

	for (const seed of seedsToRun) {
		describe(`Seeding "${seed.path}"`, () => {
			if (typeof seed.seedFn === 'function') {
				seed.seedFn();
			}
		});
	}

	ClearCaches();
});
