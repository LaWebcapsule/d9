import type { Accountability } from '@wbce-d9/types';
import { parseJSON } from '@wbce-d9/utils';
import argon2 from 'argon2';
import { Router } from 'express';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import { performance } from 'perf_hooks';
import { ACCESS_COOKIE_OPTIONS, REFRESH_COOKIE_OPTIONS } from '../../constants.js';
import getDatabase from '../../database/index.js';
import emitter from '../../emitter.js';
import env from '../../env.js';
import {
	ForbiddenException,
	InvalidCredentialsException,
	InvalidPayloadException,
	InvalidTokenException,
} from '../../exceptions/index.js';
import logger from '../../logger.js';
import { respond } from '../../middleware/respond.js';
import { AuthenticationService } from '../../services/authentication.js';
import { MailService } from '../../services/mail/index.js';
import { UsersService } from '../../services/users.js';
import type { AuthDriverOptions, PrimaryKey, User } from '../../types/index.js';
import asyncHandler from '../../utils/async-handler.js';
import { getConfigFromEnv } from '../../utils/get-config-from-env.js';
import { getIPFromReq } from '../../utils/get-ip-from-req.js';
import isUrlAllowed from '../../utils/is-url-allowed.js';
import { verifyJWT } from '../../utils/jwt.js';
import { stall } from '../../utils/stall.js';
import { Url } from '../../utils/url.js';
import { AuthDriver } from '../auth.js';

/**
 * Shortest gap between two confirmation mails for the same pending account. Without it, replaying
 * `/register` for an address that is still awaiting confirmation would send a mail every time,
 * which turns the endpoint into a way to flood a stranger's inbox.
 */
const REGISTER_MAIL_INTERVAL = 60_000;

export class LocalAuthDriver extends AuthDriver {
	config: Record<string, any>;

	constructor(options: AuthDriverOptions, config: Record<string, any> = {}) {
		super(options, config);
		this.config = config;
	}

	async getUserID(payload: Record<string, any>): Promise<string> {
		if (!payload['email']) {
			throw new InvalidCredentialsException();
		}

		const user = await this.knex
			.select('id')
			.from('directus_users')
			.whereRaw('LOWER(??) = ?', ['email', payload['email'].toLowerCase()])
			.first();

		if (!user) {
			throw new InvalidCredentialsException();
		}

		return user.id;
	}

	async verify(user: User, password?: string): Promise<void> {
		if (!user.password || !(await argon2.verify(user.password, password as string))) {
			throw new InvalidCredentialsException();
		}
	}

	override async login(user: User, payload: Record<string, any>): Promise<void> {
		await this.verify(user, payload['password']);
	}

	private getUserService(): UsersService {
		// Registration is requested by an anonymous visitor, so the permission checks on the write
		// have nothing to check against.
		return new UsersService({
			knex: this.knex,
			schema: this.schema,
			accountability: { role: null, admin: true },
		});
	}

	private async getAccountByEmail(
		email: string
	): Promise<{ id: string; status: string; auth_data: unknown } | undefined> {
		return this.knex
			.select('id', 'status', 'auth_data')
			.from('directus_users')
			.whereRaw('LOWER(??) = ?', ['email', email.toLowerCase()])
			.first();
	}

	/**
	 * Build the confirmation link handed to a freshly registered user.
	 *
	 * Without a `verification_url` the link points back at this provider's own verify route, so the
	 * endpoint works with no frontend at all. With one, the token is appended to the caller's page,
	 * which is expected to forward it here.
	 */
	private registerUrl(provider: string, email: string, url: string | null): string {
		const payload = { email, scope: 'register', provider };

		const token = jwt.sign(payload, env['SECRET'] as string, { expiresIn: '1d', issuer: 'directus' });

		const verifyUrl = url
			? new Url(url)
			: new Url(env['PUBLIC_URL']).addPath('auth', 'login', provider, 'register', 'verify-email');

		verifyUrl.setQuery('token', token);

		return verifyUrl.toString();
	}

	/**
	 * When was the last confirmation mail for this pending account sent, if ever.
	 */
	private lastMailSentAt(authData: unknown): number {
		let data = authData;

		if (typeof data === 'string') {
			try {
				data = parseJSON(data);
			} catch {
				return 0;
			}
		}

		const sentAt = (data as Record<string, any> | null)?.['registerMailSentAt'];

		return sentAt ? Date.parse(sentAt) || 0 : 0;
	}

	/**
	 * Public self-service registration for this provider.
	 *
	 * The account is created `draft`, and d9 won't issue a token for a draft user, so nothing is
	 * reachable until the emailed link is redeemed by `verifyEmail`. An address that already has a
	 * non-draft account is ignored silently — the caller can't tell the two cases apart. An account
	 * still awaiting confirmation has its mail re-sent, which is how a client implements "resend"
	 * without a second route.
	 */
	async registerUser(
		provider: string,
		input: {
			email: string;
			password: string;
			first_name?: string | null;
			last_name?: string | null;
			verification_url?: string | null;
		}
	): Promise<void> {
		const url = input.verification_url ?? null;

		if (url && isUrlAllowed(url, this.config['registerUrlAllowList']) === false) {
			throw new InvalidPayloadException(`Url "${url}" can't be used to verify registrations.`);
		}

		const service = this.getUserService();
		const existing = await this.getAccountByEmail(input.email);

		if (existing && existing.status !== 'draft') {
			// Already confirmed, or suspended/archived. Send nothing, reveal nothing.
			return;
		}

		if (existing && Date.now() - this.lastMailSentAt(existing.auth_data) < REGISTER_MAIL_INTERVAL) {
			return;
		}

		// Not typed as `Partial<User>`: the type lists active|suspended|invited, while the schema also
		// allows draft and archived (`system-data/fields/users.yaml:116`).
		const userPayload: Record<string, any> = {
			email: input.email,
			password: input.password,
			first_name: input.first_name ?? null,
			last_name: input.last_name ?? null,
			role: this.config['defaultRoleId'] ?? null,
			status: 'draft',
		};

		if (!existing) {
			// Run hook so the end user has the chance to augment the
			// user that is about to be created
			const updatedUserPayload = await emitter.emitFilter(
				`auth.create`,
				userPayload,
				{ identifier: input.email, provider, providerPayload: {} },
				{ database: getDatabase(), schema: this.schema, accountability: null }
			);

			await service.createOne(updatedUserPayload);
		}

		const account = existing ?? (await this.getAccountByEmail(input.email));

		if (!account) return;

		const mailService = new MailService({ knex: this.knex, schema: this.schema });

		await mailService.send({
			to: input.email,
			subject: 'Please confirm your email address',
			template: {
				name: 'user-registration',
				data: {
					url: this.registerUrl(provider, input.email, url),
					email: input.email,
				},
			},
		});

		await service.updateOne(account.id, {
			auth_data: JSON.stringify({ registerMailSentAt: new Date().toISOString() }),
		});
	}

	/**
	 * Redeem a registration token and activate the account. Returns the user id so the route can
	 * redirect to it.
	 *
	 * A token whose account is no longer `draft` — a link clicked twice, or an account since
	 * suspended — is reported as invalid rather than replayed.
	 */
	async verifyEmail(provider: string, token: string): Promise<PrimaryKey> {
		const {
			email,
			scope,
			provider: tokenProvider,
		} = verifyJWT(token, env['SECRET'] as string) as {
			email: string;
			scope: string;
			provider: string;
		};

		if (scope !== 'register' || tokenProvider !== provider) throw new ForbiddenException();

		const account = await this.getAccountByEmail(email);

		if (account?.status !== 'draft') {
			throw new InvalidTokenException('Token invalid.');
		}

		await this.getUserService().updateOne(account.id, { status: 'active', auth_data: null });

		return account.id;
	}
}

export function createLocalAuthRouter(provider: string): Router {
	const router = Router();

	const config = getConfigFromEnv(`AUTH_${provider.toUpperCase()}_`);

	const userLoginSchema = Joi.object({
		email: Joi.string().email().required(),
		password: Joi.string().required(),
		mode: Joi.string().valid('cookie', 'json'),
		otp: Joi.string(),
	}).unknown();

	router.post(
		'/',
		asyncHandler(async (req, res, next) => {
			const STALL_TIME = env['LOGIN_STALL_TIME'];
			const timeStart = performance.now();

			const accountability: Accountability = {
				ip: getIPFromReq(req),
				role: null,
			};

			const userAgent = req.get('user-agent');
			if (userAgent) accountability.userAgent = userAgent;

			const origin = req.get('origin');
			if (origin) accountability.origin = origin;

			const authenticationService = new AuthenticationService({
				accountability: accountability,
				schema: req.schema,
			});

			const { error } = userLoginSchema.validate(req.body);

			if (error) {
				await stall(STALL_TIME, timeStart);
				throw new InvalidPayloadException(error.message);
			}

			const mode = req.body.mode || 'json';

			const { accessToken, refreshToken, expires } = await authenticationService.login(
				provider,
				req.body,
				req.body?.otp
			);

			const payload = {
				data: { access_token: accessToken, expires },
			} as Record<string, Record<string, any>>;

			if (mode === 'json') {
				payload['data']!['refresh_token'] = refreshToken;
			}

			if (mode === 'cookie') {
				res?.cookie(env['ACCESS_TOKEN_COOKIE_NAME'], accessToken, ACCESS_COOKIE_OPTIONS);
				res?.cookie(env['REFRESH_TOKEN_COOKIE_NAME'], refreshToken, REFRESH_COOKIE_OPTIONS);
			}

			res.locals['payload'] = payload;

			return next();
		}),
		respond
	);

	// The registration routes only exist where the provider is configured for it, so an instance
	// that hasn't opted in doesn't expose them at all.
	if (config['allowPublicRegistration']) {
		const userRegisterSchema = Joi.object({
			email: Joi.string().email().required(),
			password: Joi.string().required(),
			first_name: Joi.string().allow(null, ''),
			last_name: Joi.string().allow(null, ''),
			verification_url: Joi.string().uri(),
		});

		router.post(
			'/register',
			asyncHandler(async (req, res) => {
				const { error } = userRegisterSchema.validate(req.body);
				if (error) throw new InvalidPayloadException(error.message);

				const driver = new LocalAuthDriver({ knex: getDatabase(), schema: req.schema }, config);

				// Answer before doing any work. The response must not vary — in content or in timing —
				// with whether the address is already registered, or the endpoint becomes a way to
				// enumerate accounts.
				res.status(204).end();

				try {
					await driver.registerUser(provider, {
						email: req.body.email,
						password: req.body.password,
						first_name: req.body.first_name ?? null,
						last_name: req.body.last_name ?? null,
						verification_url: req.body.verification_url ?? null,
					});
				} catch (err: any) {
					logger.warn(err, `[register] Failed to register user for provider "${provider}"`);
				}
			})
		);

		router.get(
			'/register/verify-email',
			asyncHandler(async (req, res) => {
				if (!req.query['token'] || typeof req.query['token'] !== 'string') {
					throw new InvalidPayloadException(`"token" query parameter is required`);
				}

				const driver = new LocalAuthDriver({ knex: getDatabase(), schema: req.schema }, config);

				const pk = await driver.verifyEmail(provider, req.query['token']);

				return res.redirect(new Url(env['PUBLIC_URL']).addPath('admin', 'users', String(pk)).toString());
			})
		);
	}

	return router;
}
