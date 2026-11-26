import type { ChildProcess } from 'node:child_process';
import type { Knex } from 'knex';
import axios from 'axios';
import { sleep } from './sleep.ts';

export async function awaitDatabaseConnection(database: Knex, checkSQL: string): Promise<void | null> {
	for (let attempt = 0; attempt <= 30; attempt++) {
		try {
			await database.raw(checkSQL);
			return null; // success
		} catch (error) {
			await sleep(5000);
			continue;
		}
	}

	throw new Error(`Couldn't connect to DB`);
}

export async function awaitDirectusConnection(port: number, server?: ChildProcess): Promise<void | null> {
	let serverOutput = '';
	server?.stdout?.on('data', (data) => (serverOutput += data));
	server?.stderr?.on('data', (data) => (serverOutput += data));

	for (let attempt = 0; attempt <= 100; attempt++) {
		if (typeof server?.exitCode === 'number') {
			throw new Error(
				`Directus on port ${port} exited with code ${server.exitCode} before answering:\n${serverOutput}`
			);
		}

		try {
			await axios.get(`http://127.0.0.1:${port}/server/ping`);
			return null; // success
		} catch {
			await sleep(5000);
			continue;
		}
	}

	throw new Error(`Couldn't connect to Directus`);
}
