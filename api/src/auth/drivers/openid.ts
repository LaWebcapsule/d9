import { BaseException } from '@wbce-d9/exceptions';
import type { Accountability } from '@wbce-d9/types';
import express, { Router } from 'express';
import flatten from 'flat';
import jwt from 'jsonwebtoken';
import * as oidc from 'openid-client';
import { getAuthProvider } from '../../auth.js';
import {
	ACCESS_COOKIE_OPTIONS,
	OAUTH2_COOKIE_CLEAR_OPTIONS,
	OAUTH2_COOKIE_OPTIONS,
	REFRESH_COOKIE_OPTIONS,
} from '../../constants.js';
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
import { isRedirectAllowedOnLogin } from '../../utils/is-redirect-allowed-on-login.js';
import { BaseOAuthDriver, type UserPayload } from './baseoauth.js';

export class OpenIDAuthDriver extends BaseOAuthDriver {
	client: Promise<oidc.Configuration>;
	redirectUrl: string;
	usersService: UsersService;
	config: Record<string, any>;

	getClient(): Promise<oidc.Configuration> {
		return this.client;
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
		return 'OpenID';
	}

	constructor(options: AuthDriverOptions, config: Record<string, any>) {
		super(options, config);

		const { issuerUrl, clientId, clientSecret, ...additionalConfig } = config;

		if (!issuerUrl || !clientId || !clientSecret || !additionalConfig['provider']) {
			throw new InvalidConfigException('Invalid provider config', { provider: additionalConfig['provider'] });
		}

		const redirectUrl = new Url(env['PUBLIC_URL']).addPath('auth', 'login', additionalConfig['provider'], 'callback');

		const clientOptionsOverrides = getConfigFromEnv(
			`AUTH_${config['provider'].toUpperCase()}_CLIENT_`,
			[`AUTH_${config['provider'].toUpperCase()}_CLIENT_ID`, `AUTH_${config['provider'].toUpperCase()}_CLIENT_SECRET`],
			'underscore'
		);

		this.redirectUrl = redirectUrl.toString();
		this.usersService = new UsersService({ knex: this.knex, schema: this.schema });
		this.config = additionalConfig;

		this.client = (async () => {
			let config: oidc.Configuration;

			try {
				config = await oidc.discovery(new URL(issuerUrl), clientId, {
					client_secret: clientSecret,
					...clientOptionsOverrides,
				});
			} catch (e) {
				logger.error(e, '[OpenID] Failed to fetch provider config');
				process.exit(1);
			}

			const supportedTypes = config!.serverMetadata().response_types_supported;

			if (supportedTypes && !supportedTypes.includes('code')) {
				throw new InvalidConfigException('OpenID provider does not support required code flow', {
					provider: additionalConfig['provider'],
				});
			}

			return config!;
		})();
	}

	async generateAuthUrl(
		codeVerifier: string,
		prompt = false,
		additionalParams?: Record<string, string> | undefined
	): Promise<string> {
		try {
			const client = await this.client;
			const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
			const paramsConfig = typeof this.config['params'] === 'object' ? this.config['params'] : {};

			delete additionalParams?.['redirect'];

			const params = {
				scope: this.config['scope'] ?? 'openid profile email',
				access_type: 'offline',
				prompt: prompt ? 'consent' : undefined,
				...paramsConfig,
				code_challenge: codeChallenge,
				code_challenge_method: 'S256',
				// Some providers require state even with PKCE
				state: codeChallenge,
				nonce: codeChallenge,
				redirect_uri: this.redirectUrl,
				...additionalParams,
			};

			return oidc.buildAuthorizationUrl(client, params).href;
		} catch (e) {
			throw this.handleError(e);
		}
	}

	async getTokenSetAndUserInfo(
		payload: Record<string, any>
	): Promise<[oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers, Record<string, unknown>, UserPayload]> {
		let tokenSet: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
		let userInfo: Record<string, unknown>;

		try {
			const client = await this.client;
			const codeChallenge = await oidc.calculatePKCECodeChallenge(payload['codeVerifier']);

			const callbackUrl = new URL(payload['callbackPath'], this.redirectUrl)

			tokenSet = await oidc.authorizationCodeGrant(
				client,
				callbackUrl,
				{
					pkceCodeVerifier: payload['codeVerifier'],
					expectedState: codeChallenge,
					expectedNonce: codeChallenge
				}
			);

			userInfo = (tokenSet.claims() ?? {}) as Record<string, unknown>;

			if (client.serverMetadata().userinfo_endpoint) {
				userInfo = {
					...userInfo,
					...(await oidc.fetchUserInfo(client, tokenSet.access_token!, tokenSet.claims()?.sub ?? oidc.skipSubjectCheck)),
				};
			}
		} catch (e) {
			throw this.handleError(e);
		}

		// Flatten response to support dot indexes
		userInfo = flatten(userInfo) as Record<string, unknown>;

		const { provider, identifierKey } = this.config;

		const email = userInfo['email'] ? String(userInfo['email']) : undefined;
		// Fallback to email if explicit identifier not found
		const identifier = userInfo[identifierKey ?? 'sub'] ? String(userInfo[identifierKey ?? 'sub']) : email;

		if (!identifier) {
			logger.warn(`[OpenID] Failed to find user identifier for provider "${provider}"`);
			throw new InvalidCredentialsException();
		}

		const userPayload = {
			provider,
			first_name: userInfo['given_name'],
			last_name: userInfo['family_name'],
			email: email,
			external_identifier: identifier,
			role: this.config['defaultRoleId'],
			auth_data: tokenSet.refresh_token && JSON.stringify({ refreshToken: tokenSet.refresh_token }),
		};

		return [tokenSet, userInfo, userPayload];
	}
}

export function createOpenIDAuthRouter(providerName: string): Router {
	const router = Router();

	router.get(
		'/',
		asyncHandler(async (req, res) => {
			const provider = getAuthProvider(providerName) as OpenIDAuthDriver;
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

			const additionalParams = Object.fromEntries(
				Object.entries(req.query)
					.filter(([k, v]) => k !== 'prompt' && typeof v === 'string')
					.map(([k, v]) => [k, v as string])
			);

			const authUrl = await provider.generateAuthUrl(codeVerifier, prompt, additionalParams);

			const urlParams = new URL(authUrl);
			const state = urlParams.searchParams.get('state');

			const cookieName = `openid.${providerName}.${state || ''}`;

			res.cookie(cookieName, token, OAUTH2_COOKIE_OPTIONS);

			return res.redirect(authUrl);
		}),
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
			const redirectUrl = req.query['redirect'] as string;
			const validRedirectUrl = isRedirectAllowedOnLogin(redirectUrl, providerName) ? redirectUrl : null;
			const state = req.query['state'] as string;

			const cookieName = `openid.${providerName}.${state || ''}`;
			const cookieValue = req.cookies[cookieName];

			let tokenData;

			try {
				tokenData = jwt.verify(cookieValue, env['SECRET'] as string, {
					issuer: 'directus',
				}) as {
					verifier: string;
					redirect?: string;
					prompt: boolean;
				};
			} catch (e: any) {
				logger.warn(e, `[OpenID] Couldn't verify OpenID cookie ${state ? `for state ${state}` : ''}`);

				const baseUrl = env['PUBLIC_URL'];
				const loginPath = '/admin/login';
				const url = new URL(loginPath, baseUrl);

				const redirectTo = validRedirectUrl || url.toString();
				return res.redirect(`${redirectTo}?reason=INVALID_CREDENTIALS`);
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
				authResponse = await authenticationService.login(providerName, {
					code: req.query['code'],
					codeVerifier: verifier,
					state: req.query['state'],
					iss: req.query['iss'],
					redirect: validRedirectUrl,
					callbackPath: req.originalUrl,
				});
			} catch (error: any) {
				// Prompt user for a new refresh_token if invalidated
				if (error instanceof InvalidTokenException && !prompt) {
					return res.redirect(`./?${redirect ? `redirect=${redirect}&` : ''}prompt=true`);
				}

				logger.warn(error);

				if (redirect) {
					let reason = 'UNKNOWN_EXCEPTION';

					if (error instanceof BaseException) {
						reason = error.code;
					} else {
						logger.warn(error, `[OpenID] Unexpected error during OpenID login`);
					}

					return res.redirect(`${redirect.split('?')[0]}?reason=${reason}`);
				}

				logger.warn(error, `[OpenID] Unexpected error during OpenID login`);
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
