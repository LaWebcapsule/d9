import env from './env.js';
import { describe, test, expect } from 'vitest';

const transports: string[] = [];

if (env['EMAIL_SES_CONFIGURED']) {
	transports.push('ses');
}

describe('emails', () => {
	if (!transports.length) {
		test.skip('no transports configured (set EMAIL_SES_CONFIGURED to enable)', () => {});
	}

	for (const transport of transports) {
		test(`should work with ${transport} transport`, async () => {
			env['EMAIL_TRANSPORT'] = transport;

			const mailerModule = await import('./mailer.js?' + transport); //reload the module as it maintains a cache

			const mailer = mailerModule.default(); //point to "getMailer()" function

			await expect(Promise.resolve(mailer.verify())).resolves.toBeTruthy(); //Server.health only check this to be defined
		});
	}
});
