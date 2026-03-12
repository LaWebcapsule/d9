import type { Accountability } from '@wbce-d9/types';
import type { NextFunction, Request, Response } from 'express';
import { isEqual } from 'lodash-es';
import getDatabase from '../database/index.js';
import emitter from '../emitter.js';
import env from '../env.js';
import { InvalidCredentialsException, InvalidTokenException } from '../exceptions/index.js';
import asyncHandler from '../utils/async-handler.js';
import { getIPFromReq } from '../utils/get-ip-from-req.js';
import isDirectusJWT from '../utils/is-directus-jwt.js';
import { verifyAccessJWT } from '../utils/jwt.js';
import { ACCESS_COOKIE_CLEAR_OPTIONS, REFRESH_COOKIE_CLEAR_OPTIONS } from '../constants.js';

/**
 * Verify the passed JWT and assign the user ID and role to `req`
 */
export const handler = async (req: Request, _res: Response, next: NextFunction) => {
	const defaultAccountability: Accountability = {
		user: null,
		role: null,
		admin: false,
		app: false,
		ip: getIPFromReq(req),
	};

	const userAgent = req.get('user-agent');
	if (userAgent) defaultAccountability.userAgent = userAgent;

	const origin = req.get('origin');
	if (origin) defaultAccountability.origin = origin;

	const database = getDatabase();

	const customAccountability = await emitter.emitFilter(
		'authenticate',
		defaultAccountability,
		{
			req,
		},
		{
			database,
			schema: null,
			accountability: null,
		}
	);

	if (customAccountability && isEqual(customAccountability, defaultAccountability) === false) {
		req.accountability = customAccountability;
		return next();
	}

	try {
		req.accountability = defaultAccountability;

		if (req.token) {
			if (isDirectusJWT(req.token)) {
				const payload = verifyAccessJWT(req.token, env['SECRET']);

				// Try finding the user with a valid refresh token stored in the access token
				const user = await database
					.select({
						session_expires: 's.expires',
						user_id: 'u.id',
						session_id: 's.session_id',
					})
					.from('directus_sessions AS s')
					.leftJoin('directus_users AS u', 's.user', 'u.id')
					.where('s.session_id', payload.session_id)
					.andWhere('s.expires', '>=', new Date())
					.first();

				if (!user) {
					throw new InvalidCredentialsException();
				}

				req.accountability.role = payload.role;
				req.accountability.admin = payload.admin_access === true || payload.admin_access == 1;
				req.accountability.app = payload.app_access === true || payload.app_access == 1;
				req.accountability.session_id = user.session_id;

				if (payload.share) req.accountability.share = payload.share;
				if (payload.share_scope) req.accountability.share_scope = payload.share_scope;
				if (payload.id) req.accountability.user = payload.id;
			} else {
				// Try finding the user with the provided token
				const user = await database
					.select(
						'directus_users.id',
						'directus_users.role',
						'directus_roles.admin_access',
						'directus_roles.app_access'
					)
					.from('directus_users')
					.leftJoin('directus_roles', 'directus_users.role', 'directus_roles.id')
					.where({
						'directus_users.token': req.token,
						status: 'active',
					})
					.first();

				if (!user) {
					throw new InvalidCredentialsException();
				}

				req.accountability.user = user.id;
				req.accountability.role = user.role;
				req.accountability.admin = user.admin_access === true || user.admin_access == 1;
				req.accountability.app = user.app_access === true || user.app_access == 1;
			}
		}
	} catch (error) {
		if (error instanceof InvalidCredentialsException || error instanceof InvalidTokenException) {
			if (req?.cookies[env['ACCESS_TOKEN_COOKIE_NAME']]) {
				_res?.clearCookie(env['ACCESS_TOKEN_COOKIE_NAME'], ACCESS_COOKIE_CLEAR_OPTIONS);
			}

			if (req?.cookies[env['REFRESH_TOKEN_COOKIE_NAME']]) {
				_res?.clearCookie(env['REFRESH_TOKEN_COOKIE_NAME'], REFRESH_COOKIE_CLEAR_OPTIONS);
			}
		}

		throw error;
	}

	return next();
};

export default asyncHandler(handler);
