import { parseJSON } from '@wbce-d9/utils';
import * as oidc from 'openid-client';
import getDatabase from '../../database/index.js';
import emitter from '../../emitter.js';
import { RecordNotUniqueException } from '../../exceptions/database/record-not-unique.js';
import {
	InvalidCredentialsException,
	InvalidProviderException,
	InvalidTokenException,
	ServiceUnavailableException,
} from '../../exceptions/index.js';
import logger from '../../logger.js';
import { UsersService } from '../../services/users.js';
import type { AuthData, User } from '../../types/index.js';
import { LocalAuthDriver } from './local.js';

export interface UserPayload {
	provider: string;
	first_name: any;
	last_name: any;
	email: any;
	external_identifier: string;
	role: string;
	auth_data: any;
}

export abstract class BaseOAuthDriver extends LocalAuthDriver {
	abstract getClient(): Promise<oidc.Configuration>;
	abstract getredirectUrl(): string;
	abstract getUserService(): UsersService;
	abstract getConfig(): Record<string, any>;
	abstract getClientName(): string;
	abstract getTokenSetAndUserInfo(
		payload: Record<string, any>
	): Promise<[oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers, Record<string, unknown>, UserPayload]>;

	generateCodeVerifier(): string {
		return oidc.randomPKCECodeVerifier();
	}

	async fetchUserId(identifier: string): Promise<string | undefined> {
		const user = await this.knex.select('id').from('directus_users').where('external_identifier', identifier).first();

		return user?.id;
	}

	override async getUserID(payload: Record<string, any>): Promise<string> {
		if (!payload['code'] || !payload['codeVerifier'] || !payload['state']) {
			logger.warn(`[${this.getClientName()}] No code, codeVerifier or state in payload`);
			throw new InvalidCredentialsException();
		}

		const [tokenSet, userInfo, userPayload] = await this.getTokenSetAndUserInfo(payload);

		const identifier = userPayload.external_identifier;

		const userId = await this.fetchUserId(identifier);

		if (userId) {
			let updateReq = {};

			if (this.getConfig()['updateUserOnLogin'] ?? false) {
				updateReq = {
					first_name: userPayload.first_name,
					last_name: userPayload.last_name,
					email: userPayload.email,
				};
			}

			// Run hook so the end user has the chance to augment the
			// user that is about to be updated
			const updatedUserPayload = await emitter.emitFilter(
				`auth.update`,
				updateReq,
				{
					identifier,
					provider: this.getConfig()['provider'],
					providerPayload: { accessToken: tokenSet.access_token, userInfo },
				},
				{ database: getDatabase(), schema: this.schema, accountability: null }
			);

			// Update user to update refresh_token and other properties that might have changed
			await this.getUserService().updateOne(userId, {
				...updatedUserPayload,
				auth_data: userPayload.auth_data ?? null,
			});

			return userId;
		}

		//  --- NEW USER ----
		const { provider, allowPublicRegistration, requireVerifiedEmail } = this.getConfig();

		const isEmailVerified = !requireVerifiedEmail || userInfo['email_verified'];

		// Is public registration allowed?
		if (!allowPublicRegistration || !isEmailVerified) {
			logger.warn(
				`[${this.getClientName()}] User doesn't exist, and public registration not allowed for provider "${provider}"`
			);

			throw new InvalidCredentialsException();
		}

		// Run hook so the end user has the chance to augment the
		// user that is about to be created
		const updatedUserPayload = await emitter.emitFilter(
			`auth.create`,
			userPayload,
			{
				identifier,
				provider: this.getConfig()['provider'],
				providerPayload: { accessToken: tokenSet.access_token, userInfo },
			},
			{ database: getDatabase(), schema: this.schema, accountability: null }
		);

		try {
			await this.getUserService().createOne(updatedUserPayload);
		} catch (e) {
			if (e instanceof RecordNotUniqueException) {
				logger.warn(e, `[${this.getClientName()}] Failed to register user. User not unique`);
				throw new InvalidProviderException();
			}

			throw e;
		}

		return (await this.fetchUserId(identifier)) as string;
	}

	override async logout(user: User): Promise<void> {
		let authData = user.auth_data as AuthData;

		if (typeof authData === 'string') {
			try {
				authData = parseJSON(authData);
			} catch {
				logger.warn(`[${this.getClientName()}] Session data isn't valid JSON: ${authData}`);
			}
		}

		if (authData?.['refreshToken']) {
			try {
				const client = await this.getClient();
				const tokenSet = await oidc.refreshTokenGrant(client, authData['refreshToken']);

				if (tokenSet.refresh_token) {
					await oidc.tokenRevocation(client, tokenSet.refresh_token);
				}

				await this.getUserService().updateOne(user.id, {
					auth_data: null,
				});

				logger.info(`[${this.getClientName()}] Session closed for user.`);
			} catch (e: any) {
				throw this.handleError(e);
			}
		} else {
			logger.warn(`[${this.getClientName()}] Session closed for user without auth_data`);
		}
	}

	override async login(user: User): Promise<void> {
		return this.refresh(user);
	}

	override async refresh(user: User): Promise<void> {
		let authData = user.auth_data as AuthData;

		if (typeof authData === 'string') {
			try {
				authData = parseJSON(authData);
			} catch {
				logger.warn(`[${this.getClientName()}] Session data isn't valid JSON: ${authData}`);
			}
		}

		if (authData?.['refreshToken']) {
			try {
				const client = await this.getClient();
				const tokenSet = await oidc.refreshTokenGrant(client, authData['refreshToken']);

				// Update user refreshToken if provided
				if (tokenSet.refresh_token) {
					await this.getUserService().updateOne(user.id, {
						auth_data: JSON.stringify({ refreshToken: tokenSet.refresh_token }),
					});
				}
			} catch (e: any) {
				throw this.handleError(e);
			}
		} else {
			// If no auth connexion, throw user out
			logger.error(`No [${this.getClientName()}] Session found`);
			throw new InvalidCredentialsException();
		}
	}

	handleError = (e: any) => {
		if (e instanceof oidc.ResponseBodyError) {
			if (e.error === 'invalid_grant') {
				// Invalid token
				logger.trace(e, `[${this.getClientName()}] Invalid grant`);
				return new InvalidTokenException();
			}

			// Server response error
			logger.trace(e, `[${this.getClientName()}] Unknown OP error`);
			return new ServiceUnavailableException('Service returned unexpected response', {
				service: 'openid',
				message: e.error_description,
			});
		} else if (e instanceof oidc.ClientError) {
			// Internal client error
			logger.trace(e, `[${this.getClientName()}] Unknown RP error`);
			return new InvalidCredentialsException();
		}

		logger.trace(e, `[${this.getClientName()}] Unknown error`);
		return e;
	};
}
