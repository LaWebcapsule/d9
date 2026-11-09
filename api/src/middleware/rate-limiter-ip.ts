import type { Request, RequestHandler, Response } from 'express';
import ms from 'ms';
import type {
	RateLimiterAbstract,
	RateLimiterMemcache,
	RateLimiterMemory,
	RateLimiterRedis,
} from 'rate-limiter-flexible';
import env from '../env.js';
import { HitRateLimitException } from '../exceptions/index.js';
import { createRateLimiter } from '../rate-limiter.js';
import asyncHandler from '../utils/async-handler.js';
import { getIPFromReq } from '../utils/get-ip-from-req.js';
import { validateEnv } from '../utils/validate-env.js';

let checkRateLimit: RequestHandler = (_req, _res, next) => next();

export let rateLimiter!: RateLimiterRedis | RateLimiterMemcache | RateLimiterMemory;

if (env['RATE_LIMITER_ENABLED'] === true) {
	validateEnv(['RATE_LIMITER_STORE', 'RATE_LIMITER_DURATION', 'RATE_LIMITER_POINTS']);

	rateLimiter = createRateLimiter('RATE_LIMITER');

	checkRateLimit = asyncHandler(async (req, res, next) => {
		await consumeRateLimit(req, res, 1);
		next();
	});
}

/**
 * Consume rate limit points for the client IP of the request. A request can consume more than one
 * point when its cost is higher than a regular request, so expensive operations (like a GraphQL
 * document selecting many root fields) are accounted for in the same budget.
 * Does nothing when the rate limiter is disabled.
 */
export function createRateLimitConsumer(limiter: RateLimiterAbstract | undefined) {
	return async function consumeRateLimit(req: Request, res: Response, points = 1): Promise<void> {
		if (!limiter) return;

		try {
			await limiter.consume(getIPFromReq(req), points);
		} catch (rateLimiterRes: any) {
			if (rateLimiterRes instanceof Error) throw rateLimiterRes;

			res.set('Retry-After', String(Math.round(rateLimiterRes.msBeforeNext / 1000)));
			throw new HitRateLimitException(`Too many requests, retry after ${ms(rateLimiterRes.msBeforeNext)}.`, {
				limit: +env['RATE_LIMITER_POINTS'],
				reset: new Date(Date.now() + rateLimiterRes.msBeforeNext),
			});
		}
	};
}

export const consumeRateLimit = createRateLimitConsumer(rateLimiter);

export default checkRateLimit;
