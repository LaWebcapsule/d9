import type { Knex } from 'knex';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ImportService } from './import-export.js';
import { ItemsService } from './items.js';

describe('Services / Import', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('importCSV', () => {
		const knex = { transaction: (callback: (trx: unknown) => unknown) => callback({}) } as unknown as Knex;

		async function importCSV(csv: string) {
			// importCSV registers its drain callback on stream end, so the save must still be pending by then
			const upsertOne = vi
				.spyOn(ItemsService.prototype, 'upsertOne')
				.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(1), 50)));

			const service = new ImportService({ knex, schema: { collections: {}, relations: [] } });

			await service.importCSV('articles', Readable.from([csv]));

			return upsertOne.mock.calls.map(([item]) => item);
		}

		test('builds nested objects and arrays from dotted column names', async () => {
			const items = await importCSV('id,author.name,tags.0.name\n1,Jane,news\n');

			expect(items).toEqual([{ id: '1', author: { name: 'Jane' }, tags: [{ name: 'news' }] }]);
		});

		test('does not write through inherited properties or prototype keys', async () => {
			const items = await importCSV('id,toString.call,__proto__.polluted\n1,value,yes\n');

			expect(Object.prototype.hasOwnProperty.call(Object.prototype.toString, 'call')).toBe(false);
			expect(Object.prototype.toString.call([])).toBe('[object Array]');
			expect((Object.prototype as any).polluted).toBeUndefined();
			expect(items).toEqual([{ id: '1', toString: { call: 'value' } }]);
		});
	});
});
