/* eslint-disable no-console */

import { Listr } from 'listr2';
import vendors from '../common/get-dbs-to-test.ts';
import config from '../common/config.ts';
import global from './global.ts';

export async function teardown(): Promise<void> {
	if (!process.env.TEST_LOCAL) {
		await new Listr([
			{
				title: 'Stop Directus servers',
				task: () => {
					return new Listr(
						vendors.map((vendor) => {
							return {
								title: config.names[vendor]!,
								task: async () => {
									const directus = global.directus[vendor];
									directus?.kill();

									const directusNoCache = global.directusNoCache[vendor];
									directusNoCache?.kill();
								},
							};
						}),
						{ concurrent: true, exitOnError: false }
					);
				},
			},
		]).run();
	}

	console.log('\n');

	console.log(`👮‍♀️ Tests complete!\n`);
}
