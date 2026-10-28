import { describe, expect, it } from 'vitest';
import { getUrl } from '@common/config.ts';
import request from 'supertest';
import vendors from '@common/get-dbs-to-test.ts';
import { requestGraphQL } from '@common/transport.ts';
import { TEST_USERS, USER } from '@common/variables.ts';

describe('/auth', () => {
	describe('POST /login', () => {
		describe('when correct credentials are provided', () => {
			describe('returns an access_token, expires and a refresh_token', () => {
				TEST_USERS.forEach((userKey) => {
					describe(USER[userKey].NAME, () => {
						it.each(vendors)('%s', async (vendor) => {
							// Action
							const response = await request(getUrl(vendor))
								.post(`/auth/login`)
								.send({ email: USER[userKey].EMAIL, password: USER[userKey].PASSWORD })
								.expect('Content-Type', /application\/json/);

							const mutationKey = 'auth_login';

							const gqlResponse = await requestGraphQL(getUrl(vendor), true, null, {
								mutation: {
									[mutationKey]: {
										__args: {
											email: USER[userKey].EMAIL,
											password: USER[userKey].PASSWORD,
										},
										access_token: true,
										expires: true,
										refresh_token: true,
									},
								},
							});

							// Assert
							expect(response.statusCode).toBe(200);

							expect(response.body).toMatchObject({
								data: {
									access_token: expect.any(String),
									expires: expect.any(Number),
									refresh_token: expect.any(String),
								},
							});

							expect(gqlResponse.statusCode).toBe(200);

							expect(gqlResponse.body).toMatchObject({
								data: {
									[mutationKey]: {
										access_token: expect.any(String),
										expires: expect.any(String),
										refresh_token: expect.any(String),
									},
								},
							});
						});
					});
				});
			});
		});

		describe('when incorrect credentials are provided', () => {
			describe('returns code: UNAUTHORIZED for incorrect password', () => {
				TEST_USERS.forEach((userKey) => {
					describe(USER[userKey].NAME, () => {
						it.each(vendors)('%s', async (vendor) => {
							// Action
							const response = await request(getUrl(vendor))
								.post(`/auth/login`)
								.send({
									email: USER[userKey].EMAIL,
									password: USER[userKey].PASSWORD + 'typo',
								})
								.expect('Content-Type', /application\/json/)
								.expect(401);

							const mutationKey = 'auth_login';

							const gqlResponse = await requestGraphQL(getUrl(vendor), true, null, {
								mutation: {
									[mutationKey]: {
										__args: {
											email: USER[userKey].EMAIL,
											password: USER[userKey].PASSWORD + 'typo',
										},
										access_token: true,
										expires: true,
										refresh_token: true,
									},
								},
							});

							// Assert
							expect(response.body).toMatchObject({
								errors: [
									{
										message: 'Invalid user credentials.',
										extensions: {
											code: 'INVALID_CREDENTIALS',
										},
									},
								],
							});

							expect(gqlResponse.body).toMatchObject({
								errors: [
									{
										message: 'Invalid user credentials.',
										extensions: {
											code: 'INVALID_CREDENTIALS',
										},
									},
								],
							});
						});
					});
				});
			});

			describe('returns code: UNAUTHORIZED for unregistered email', () => {
				TEST_USERS.forEach((userKey) => {
					describe(USER[userKey].NAME, () => {
						it.each(vendors)('%s', async (vendor) => {
							// Action
							const response = await request(getUrl(vendor))
								.post(`/auth/login`)
								.send({
									email: 'test@fake.com',
									password: USER[userKey].PASSWORD,
								})
								.expect('Content-Type', /application\/json/)
								.expect(401);

							const mutationKey = 'auth_login';

							const gqlResponse = await requestGraphQL(getUrl(vendor), true, null, {
								mutation: {
									[mutationKey]: {
										__args: {
											email: 'test@fake.com',
											password: USER[userKey].PASSWORD,
										},
										access_token: true,
										expires: true,
										refresh_token: true,
									},
								},
							});

							// Assert
							expect(response.body).toMatchObject({
								errors: [
									{
										message: 'Invalid user credentials.',
										extensions: {
											code: 'INVALID_CREDENTIALS',
										},
									},
								],
							});

							expect(gqlResponse.body).toMatchObject({
								errors: [
									{
										message: 'Invalid user credentials.',
										extensions: {
											code: 'INVALID_CREDENTIALS',
										},
									},
								],
							});
						});
					});
				});
			});

			describe('returns code: INVALID_CREDENTIALS for invalid email', () => {
				TEST_USERS.forEach((userKey) => {
					describe(USER[userKey].NAME, () => {
						it.each(vendors)('%s', async (vendor) => {
							// Action
							const response = await request(getUrl(vendor))
								.post(`/auth/login`)
								.send({
									email: 'invalidEmail',
									password: USER[userKey].PASSWORD,
								})
								.expect('Content-Type', /application\/json/)
								.expect(400);

							const mutationKey = 'auth_login';

							const gqlResponse = await requestGraphQL(getUrl(vendor), true, null, {
								mutation: {
									[mutationKey]: {
										__args: {
											email: 'invalidEmail',
											password: USER[userKey].PASSWORD,
										},
										access_token: true,
										expires: true,
										refresh_token: true,
									},
								},
							});

							// Assert
							expect(response.body).toMatchObject({
								errors: [
									{
										message: '"email" must be a valid email',
										extensions: {
											code: 'INVALID_PAYLOAD',
										},
									},
								],
							});

							expect(gqlResponse.body).toMatchObject({
								errors: [
									{
										message: 'Invalid user credentials.',
										extensions: {
											code: 'INVALID_CREDENTIALS',
										},
									},
								],
							});
						});
					});
				});
			});

			describe('returns message: "password is required" when no password is provided', () => {
				TEST_USERS.forEach((userKey) => {
					describe(USER[userKey].NAME, () => {
						it.each(vendors)('%s', async (vendor) => {
							// Action
							const response = await request(getUrl(vendor))
								.post(`/auth/login`)
								.send({
									email: USER[userKey].EMAIL,
								})
								.expect('Content-Type', /application\/json/)
								.expect(400);

							const mutationKey = 'auth_login';

							const gqlResponse = await requestGraphQL(getUrl(vendor), true, null, {
								mutation: {
									[mutationKey]: {
										__args: {
											email: 'invalidEmail',
										},
										access_token: true,
										expires: true,
										refresh_token: true,
									},
								},
							});

							// Assert
							expect(response.body).toMatchObject({
								errors: [
									{
										message: '"password" is required',
										extensions: {
											code: 'INVALID_PAYLOAD',
										},
									},
								],
							});

							expect(gqlResponse.body).toMatchObject({
								errors: [
									{
										message: 'GraphQL validation error.',
										extensions: {
											code: 'GRAPHQL_VALIDATION_EXCEPTION',
										},
									},
								],
							});
						});
					});
				});
			});
		});
	});
});
