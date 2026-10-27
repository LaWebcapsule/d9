import type { Request, Response } from 'express';
import type { RateLimiterAbstract } from 'rate-limiter-flexible';
import { describe, expect, test, vi } from 'vitest';
import { HitRateLimitException } from '../exceptions/index.js';
import { createRateLimitConsumer } from './rate-limiter-ip.js';

function getRequest(ip = '192.0.2.1') {
	return { ip } as unknown as Request;
}

function getResponse() {
	return { set: vi.fn() } as unknown as Response;
}

describe('createRateLimitConsumer', () => {
	test('does nothing when the rate limiter is disabled', async () => {
		const consumeRateLimit = createRateLimitConsumer(undefined);

		await expect(consumeRateLimit(getRequest(), getResponse(), 10)).resolves.toBeUndefined();
	});

	test('consumes the given number of points for the request IP', async () => {
		const consume = vi.fn().mockResolvedValue({});
		const consumeRateLimit = createRateLimitConsumer({ consume } as unknown as RateLimiterAbstract);
		const res = getResponse();

		await consumeRateLimit(getRequest(), res, 4);

		expect(consume).toHaveBeenCalledTimes(1);
		expect(consume).toHaveBeenCalledWith('192.0.2.1', 4);
		expect(res.set).not.toHaveBeenCalled();
	});

	test('rejects when the budget is exhausted', async () => {
		const consume = vi.fn().mockRejectedValue({ msBeforeNext: 1500 });
		const consumeRateLimit = createRateLimitConsumer({ consume } as unknown as RateLimiterAbstract);
		const res = getResponse();

		await expect(consumeRateLimit(getRequest(), res, 4)).rejects.toBeInstanceOf(HitRateLimitException);
		expect(res.set).toHaveBeenCalledWith('Retry-After', '2');
	});

	test('rethrows unexpected errors', async () => {
		const error = new Error('Store unavailable');
		const consume = vi.fn().mockRejectedValue(error);
		const consumeRateLimit = createRateLimitConsumer({ consume } as unknown as RateLimiterAbstract);

		await expect(consumeRateLimit(getRequest(), getResponse(), 1)).rejects.toBe(error);
	});
});
