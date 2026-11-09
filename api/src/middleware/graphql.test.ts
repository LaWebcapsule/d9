import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { InvalidPayloadException, MethodNotAllowedException } from '../exceptions/index.js';
import { parseGraphQL } from './graphql.js';
import { consumeRateLimit } from './rate-limiter-ip.js';

vi.mock('./rate-limiter-ip.js', () => ({
	default: vi.fn(),
	consumeRateLimit: vi.fn(),
}));

const consume = vi.mocked(consumeRateLimit);
let next: NextFunction & ReturnType<typeof vi.fn>;
let res: Partial<Response>;

beforeEach(() => {
	consume.mockReset();
	consume.mockResolvedValue(undefined);
	next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
	res = { locals: {}, set: vi.fn() };
});

function post(query: string, operationName?: string) {
	return { method: 'POST', body: { query, operationName } } as Request;
}

async function run(req: Request) {
	await parseGraphQL(req, res as Response, next);

	return req;
}

describe('GraphQL rate limit cost', () => {
	test('consumes one point per root field, minus the point of the request', async () => {
		const req = await run(post('{ a: articles { id } b: users { id } }'));

		expect(consume).toHaveBeenCalledTimes(1);
		expect(consume).toHaveBeenCalledWith(req, res, 1);
	});

	test('does not consume more points for a single root field', async () => {
		await run(post('{ articles { id author { name } } }'));

		expect(consume).not.toHaveBeenCalled();
	});

	test('charges the selected operation only', async () => {
		const document = 'query Small { articles } query Large { a: articles b: users c: articles }';

		await run(post(document, 'Small'));

		expect(consume).not.toHaveBeenCalled();

		const req = await run(post(document, 'Large'));

		expect(consume).toHaveBeenCalledWith(req, res, 2);
	});

	test('does not charge a request rejected before execution', async () => {
		await run({
			method: 'GET',
			query: { query: 'mutation { update_articles_item(id: 1, data: {}) { id } }' },
		} as unknown as Request);

		expect(next.mock.calls[0]![0]).toBeInstanceOf(MethodNotAllowedException);
		expect(consume).not.toHaveBeenCalled();
	});

	test('does not charge an invalid document', async () => {
		await run(post('{'));

		expect(next.mock.calls[0]![0]).toBeInstanceOf(InvalidPayloadException);
		expect(consume).not.toHaveBeenCalled();
	});
});
