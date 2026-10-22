import { getUrl, paths } from '@common/config.ts';
import request from 'supertest';
import vendors from '@common/get-dbs-to-test.ts';
import { createReadStream } from 'fs';
import path from 'path';
import { USER } from '@common/variables.ts';
import { sleep } from '@utils/sleep.ts';
import { spawn } from 'child_process';

const assetsDirectory = [paths.cwd, 'assets'];
const storages = ['local', 'minio'];
const imageFilePath = path.join(...assetsDirectory, 'layers.png');

describe('/assets', () => {
	describe('GET /assets/:id', () => {
		describe('Concurrent file requests', () => {
			describe.each(storages)('Storage: %s', (storage) => {
				it.each(vendors)(
					'%s',
					async (vendor) => {
						// Setup
						const spawnCountTarget = 5;
						let spawnCount = 0;
						let hasErrors = false;
						let isSpawnRunning = false;

						const insertResponse = await request(getUrl(vendor))
							.post('/files')
							.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
							.field('storage', storage)
							.attach('file', createReadStream(imageFilePath));

						// Action
						spawnAutoCannon();

						function spawnAutoCannon() {
							const url = `${getUrl(vendor)}/assets/${insertResponse.body.data.id}?access_token=${USER.ADMIN.TOKEN}`;

							// The runner shares its CPUs with autocannon, so the slowest of 100 concurrent responses can exceed autocannon's default 10s timeout
							const options = ['exec', 'autocannon', '-c', '100', '-t', '60', url];
							const child = spawn('pnpm', options);

							isSpawnRunning = true;

							child.stderr.on('data', (data) => {
								if (String(data).includes('errors')) {
									hasErrors = true;
								}
							});

							child.on('close', () => {
								spawnCount++;

								if (spawnCount < spawnCountTarget && !hasErrors) {
									spawnAutoCannon();
								} else {
									isSpawnRunning = false;
								}
							});
						}

						while (isSpawnRunning) {
							await sleep(1000 * spawnCountTarget);
						}

						// Assert
						expect(hasErrors).toBe(false);
					},
					600000
				);
			});
		});
	});
});
