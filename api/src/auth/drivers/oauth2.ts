import { BaseException } from '@wbce-d9/exceptions';
import type { Accountability } from '@wbce-d9/types';
import express, { Router } from 'express';
import flatten from 'flat';
import jwt from 'jsonwebtoken';
import type { BaseClient, Client, TokenSet } from 'openid-client';
import { Issuer, generators } from 'openid-client';
import { getAuthProvider } from '../../auth.js';
import { ACCESS_COOKIE_OPTIONS, REFRESH_COOKIE_OPTIONS } from '../../constants.js';
import env from '../../env.js';
import {
	InvalidConfigException,
	InvalidCredentialsException,
	InvalidTokenException,
	InvalidPayloadException,
} from '../../exceptions/index.js';
import logger from '../../logger.js';
import { respond } from '../../middleware/respond.js';
import { AuthenticationService } from '../../services/authentication.js';
import { UsersService } from '../../services/users.js';
import type { AuthDriverOptions } from '../../types/index.js';
import asyncHandler from '../../utils/async-handler.js';
import { getConfigFromEnv } from '../../utils/get-config-from-env.js';
import { getIPFromReq } from '../../utils/get-ip-from-req.js';
import { Url } from '../../utils/url.js';
import { BaseOAuthDriver, type UserPayload } from './baseoauth.js';
import { isRedirectAllowedOnLogin } from '../../utils/is-redirect-allowed-on-login.js';

export class OAuth2AuthDriver extends BaseOAuthDriver {
	client: Client;
	redirectUrl: string;
	usersService: UsersService;
	config: Record<string, any>;

	getClient(): Promise<BaseClient> {
		return Promise.resolve(this.client);
	}

	getredirectUrl(): string {
		return this.redirectUrl;
	}

	getUserService(): UsersService {
		return this.usersService;
	}

	getConfig(): Record<string, any> {
		return this.config;
	}

	getClientName(): string {
		return 'OAuth2';
	}

	constructor(options: AuthDriverOptions, config: Record<string, any>) {
		super(options, config);

		const { authorizeUrl, accessUrl, profileUrl, clientId, clientSecret, ...additionalConfig } = config;

		if (!authorizeUrl || !accessUrl || !profileUrl || !clientId || !clientSecret || !additionalConfig['provider']) {
			throw new InvalidConfigException('Invalid provider config', { provider: additionalConfig['provider'] });
		}

		const redirectUrl = new Url(env['PUBLIC_URL']).addPath('auth', 'login', additionalConfig['provider'], 'callback');

		this.redirectUrl = redirectUrl.toString();
		this.usersService = new UsersService({ knex: this.knex, schema: this.schema });
		this.config = additionalConfig;

		const issuer = new Issuer({
			authorization_endpoint: authorizeUrl,
			token_endpoint: accessUrl,
			userinfo_endpoint: profileUrl,
			issuer: additionalConfig['provider'],
		});

		const clientOptionsOverrides = getConfigFromEnv(
			`AUTH_${config['provider'].toUpperCase()}_CLIENT_`,
			[`AUTH_${config['provider'].toUpperCase()}_CLIENT_ID`, `AUTH_${config['provider'].toUpperCase()}_CLIENT_SECRET`],
			'underscore'
		);

		this.client = new issuer.Client({
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uris: [this.redirectUrl],
			response_types: ['code'],
			...clientOptionsOverrides,
		});
	}

	generateAuthUrl(codeVerifier: string, prompt = false): string {
		try {
			const codeChallenge = generators.codeChallenge(codeVerifier);
			const paramsConfig = typeof this.config['params'] === 'object' ? this.config['params'] : {};

			return this.client.authorizationUrl({
				scope: this.config['scope'] ?? 'email',
				access_type: 'offline',
				prompt: prompt ? 'consent' : undefined,
				...paramsConfig,
				code_challenge: codeChallenge,
				code_challenge_method: 'S256',
				// Some providers require state even with PKCE
				state: codeChallenge,
			});
		} catch (e) {
			throw this.handleError(e);
		}
	}

	async getTokenSetAndUserInfo(
		payload: Record<string, any>
	): Promise<[TokenSet, Record<string, unknown>, UserPayload]> {
		let tokenSet;
		let userInfo;

		try {
			tokenSet = await this.client.oauthCallback(
				this.redirectUrl,
				{ code: payload['code'], state: payload['state'] },
				{ code_verifier: payload['codeVerifier'], state: generators.codeChallenge(payload['codeVerifier']) }
			);

			userInfo = await this.client.userinfo(tokenSet.access_token!);
		} catch (e) {
			throw this.handleError(e);
		}

		// Flatten response to support dot indexes
		userInfo = flatten(userInfo) as Record<string, unknown>;

		const { provider, emailKey, identifierKey } = this.config;

		const email = userInfo[emailKey ?? 'email'] ? String(userInfo[emailKey ?? 'email']) : undefined;
		// Fallback to email if explicit identifier not found
		const identifier = userInfo[identifierKey] ? String(userInfo[identifierKey]) : email;

		if (!identifier) {
			logger.warn(`[OAuth2] Failed to find user identifier for provider "${provider}"`);
			throw new InvalidCredentialsException();
		}

		const userPayload: UserPayload = {
			provider,
			first_name: userInfo[this.config['firstNameKey']],
			last_name: userInfo[this.config['lastNameKey']],
			email: email,
			external_identifier: identifier,
			role: this.config['defaultRoleId'],
			auth_data: tokenSet.refresh_token ? JSON.stringify({ refreshToken: tokenSet.refresh_token }) : null,
		};

		return [tokenSet, userInfo, userPayload];
	}
}

export function createOAuth2AuthRouter(providerName: string): Router {
	const router = Router();

	router.get(
		'/',
		(req, res) => {
			const provider = getAuthProvider(providerName) as OAuth2AuthDriver;
			const codeVerifier = provider.generateCodeVerifier();
			const prompt = !!req.query['prompt'];
			const redirect = req.query['redirect'];

			if (isRedirectAllowedOnLogin(redirect, providerName) === false) {
				throw new InvalidPayloadException(`URL "${redirect}" can't be used to redirect after login`);
			}

			const token = jwt.sign({ verifier: codeVerifier, redirect, prompt }, env['SECRET'] as string, {
				expiresIn: '5m',
				issuer: 'directus',
			});

			res.cookie(`oauth2.${providerName}`, token, {
				httpOnly: true,
				sameSite: 'lax',
			});

			return res.redirect(provider.generateAuthUrl(codeVerifier, prompt));
		},
		respond
	);

	router.post(
		'/callback',
		express.urlencoded({ extended: false }),
		(req, res) => {
			res.redirect(303, `./callback?${new URLSearchParams(req.body)}`);
		},
		respond
	);

	router.get(
		'/callback',
		asyncHandler(async (req, res, next) => {
			let tokenData;

			try {
				tokenData = jwt.verify(req.cookies[`oauth2.${providerName}`], env['SECRET'] as string, {
					issuer: 'directus',
				}) as {
					verifier: string;
					redirect?: string;
					prompt: boolean;
				};
			} catch (e: any) {
				logger.warn(e, `[OAuth2] Couldn't verify OAuth2 cookie`);
				throw new InvalidCredentialsException();
			}

			const { verifier, redirect, prompt } = tokenData;

			const accountability: Accountability = {
				ip: getIPFromReq(req),
				role: null,
			};

			const userAgent = req.get('user-agent');
			if (userAgent) accountability.userAgent = userAgent;

			const origin = req.get('origin');
			if (origin) accountability.origin = origin;

			const authenticationService = new AuthenticationService({
				accountability,
				schema: req.schema,
			});

			let authResponse;

			try {
				res.clearCookie(`oauth2.${providerName}`);

				authResponse = await authenticationService.login(providerName, {
					code: req.query['code'],
					codeVerifier: verifier,
					state: req.query['state'],
				});
			} catch (error: any) {
				// Prompt user for a new refresh_token if invalidated
				if (error instanceof InvalidTokenException && !prompt) {
					return res.redirect(`./?${redirect ? `redirect=${redirect}&` : ''}prompt=true`);
				}

				if (redirect) {
					let reason = 'UNKNOWN_EXCEPTION';

					if (error instanceof BaseException) {
						reason = error.code;
					} else {
						logger.warn(error, `[OAuth2] Unexpected error during OAuth2 login`);
					}

					return res.redirect(`${redirect.split('?')[0]}?reason=${reason}`);
				}

				logger.warn(error, `[OAuth2] Unexpected error during OAuth2 login`);
				throw error;
			}

			const { accessToken, refreshToken, expires } = authResponse;

			if (redirect) {
				res?.cookie(env['ACCESS_TOKEN_COOKIE_NAME'], accessToken, ACCESS_COOKIE_OPTIONS);
				res?.cookie(env['REFRESH_TOKEN_COOKIE_NAME'], refreshToken, REFRESH_COOKIE_OPTIONS);
				return res.redirect(redirect);
			}

			res.locals['payload'] = {
				data: { access_token: accessToken, refresh_token: refreshToken, expires },
			};

			next();
		}),
		respond
	);

	return router;
}
