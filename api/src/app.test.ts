import { Router } from 'express';
import request from 'supertest';
import { describe, expect, test, vi } from 'vitest';
import createApp from './app.js';

vi.mock('./database', () => ({
	default: vi.fn(),
	getDatabaseClient: vi.fn().mockReturnValue('postgres'),
	isInstalled: vi.fn(),
	validateDatabaseConnection: vi.fn(),
	validateDatabaseExtensions: vi.fn(),
	validateMigrations: vi.fn(),
}));

vi.mock('./env', async () => {
	const actual = (await vi.importActual('./env')) as { default: Record<string, any> };

	const MOCK_ENV = {
		...actual.default,
		KEY: 'xxxxxxx-xxxxxx-xxxxxxxx-xxxxxxxxxx',
		SECRET: 'abcdef',
		SERVE_APP: true,
		PUBLIC_URL: 'http://localhost:8055/directus',
		TELEMETRY: false,
		LOG_STYLE: 'raw',
		QS_ARRAY_LIMIT: 5,
		QS_PARAMETER_LIMIT: 10,
	};

	return {
		default: MOCK_ENV,
		getEnv: () => MOCK_ENV,
	};
});

const mockGetEndpointRouter = vi.fn().mockReturnValue(Router());
const mockGetEmbeds = vi.fn().mockReturnValue({ head: '', body: '' });

vi.mock('./extensions', () => ({
	getExtensionManager: vi.fn().mockImplementation(() => {
		return {
			initialize: vi.fn(),
			getEndpointRouter: mockGetEndpointRouter,
			getEmbeds: mockGetEmbeds,
		};
	}),
}));

vi.mock('./flows', () => ({
	getFlowManager: vi.fn().mockImplementation(() => {
		return {
			initialize: vi.fn(),
		};
	}),
}));

vi.mock('./middleware/check-ip', () => ({
	checkIP: Router(),
}));

vi.mock('./middleware/schema', () => ({
	default: Router(),
}));

vi.mock('./middleware/get-permissions', () => ({
	default: Router(),
}));

vi.mock('./auth', () => ({
	registerAuthProviders: vi.fn(),
}));

vi.mock('./webhooks', () => ({
	init: vi.fn(),
}));

describe('createApp', async () => {
	describe('Content Security Policy', () => {
		test('Should set content-security-policy header by default', async () => {
			const app = await createApp();
			const response = await request(app).get('/');

			expect(response.headers).toHaveProperty('content-security-policy');
		});
	});

	describe('Root Redirect', () => {
		test('Should redirect root path by default', async () => {
			const app = await createApp();
			const response = await request(app).get('/');

			expect(response.status).toEqual(302);
		});
	});

	describe('robots.txt file', () => {
		test('Should respond with default robots.txt content', async () => {
			const app = await createApp();
			const response = await request(app).get('/robots.txt');

			expect(response.text).toEqual('User-agent: *\nDisallow: /');
		});
	});

	describe('Admin App', () => {
		test('Should set <base /> tag href to public url with admin relative path', async () => {
			const app = await createApp();
			const response = await request(app).get('/admin');

			expect(response.text).toEqual(expect.stringContaining(`<base href="/directus/admin/" />`));
		});

		test('Should remove <embed-head /> and <embed-body /> tags when there are no custom embeds', async () => {
			mockGetEmbeds.mockReturnValueOnce({ head: '', body: '' });

			const app = await createApp();
			const response = await request(app).get('/admin');

			expect(response.text).not.toEqual(expect.stringContaining(`<embed-head />`));
			expect(response.text).not.toEqual(expect.stringContaining(`<embed-body />`));
		});

		test('Should replace <embed-head /> tag with custom embed head', async () => {
			const mockEmbedHead = '<!-- Test Embed Head -->';
			mockGetEmbeds.mockReturnValueOnce({ head: mockEmbedHead, body: '' });

			const app = await createApp();
			const response = await request(app).get('/admin');

			expect(response.text).toEqual(expect.stringContaining(mockEmbedHead));
		});

		test('Should replace <embed-body /> tag with custom embed body', async () => {
			const mockEmbedBody = '<!-- Test Embed Body -->';
			mockGetEmbeds.mockReturnValueOnce({ head: '', body: mockEmbedBody });

			const app = await createApp();
			const response = await request(app).get('/admin');

			expect(response.text).toEqual(expect.stringContaining(mockEmbedBody));
		});
	});

	describe('Server ping endpoint', () => {
		test('Should respond with pong', async () => {
			const app = await createApp();
			const response = await request(app).get('/server/ping');

			expect(response.text).toEqual('pong');
		});
	});

	describe('Custom Endpoints', () => {
		test('Should not contain route for custom endpoint', async () => {
			const testRoute = '/custom-endpoint-to-test';

			const app = await createApp();
			const response = await request(app).get(testRoute);

			expect(response.body).toEqual({
				errors: [
					{
						extensions: {
							code: 'ROUTE_NOT_FOUND',
						},
						message: `Route ${testRoute} doesn't exist.`,
					},
				],
			});
		});

		test('Should contain route for custom endpoint', async () => {
			const testRoute = '/custom-endpoint-to-test';
			const testResponse = { key: 'value' };
			const mockRouter = Router();

			mockRouter.use(testRoute, (_, res) => {
				res.json(testResponse);
			});

			mockGetEndpointRouter.mockReturnValueOnce(mockRouter);

			const app = await createApp();
			const response = await request(app).get(testRoute);

			expect(response.body).toEqual(testResponse);
		});
	});

	describe('Not Found Handler', () => {
		test('Should return ROUTE_NOT_FOUND error when a route does not exist', async () => {
			const testRoute = '/this-route-does-not-exist';

			const app = await createApp();
			const response = await request(app).get(testRoute);

			expect(response.body).toEqual({
				errors: [
					{
						extensions: {
							code: 'ROUTE_NOT_FOUND',
						},
						message: `Route ${testRoute} doesn't exist.`,
					},
				],
			});
		});
	});

	describe('Query Parser', () => {
		test('Should parse array indices within QS_ARRAY_LIMIT as array', async () => {
			const mockRouter = Router();

			mockRouter.use('/test-query', (req, res) => {
				res.json(req.query);
			});

			mockGetEndpointRouter.mockReturnValueOnce(mockRouter);

			const app = await createApp();
			// QS_ARRAY_LIMIT is set to 5, so index 4 should be parsed as array
			const response = await request(app).get('/test-query?a[0]=x&a[4]=y');

			expect(Array.isArray(response.body.a)).toBe(true);
			expect(response.body.a).toContain('x');
			expect(response.body.a).toContain('y');
		});

		test('Should parse array index exactly at QS_ARRAY_LIMIT-1 as array', async () => {
			const mockRouter = Router();

			mockRouter.use('/test-query', (req, res) => {
				res.json(req.query);
			});

			mockGetEndpointRouter.mockReturnValueOnce(mockRouter);

			const app = await createApp();
			// QS_ARRAY_LIMIT is set to 5, so index 4 (QS_ARRAY_LIMIT-1) is the last index parsed as array
			const response = await request(app).get('/test-query?a[0]=x&a[4]=y');

			expect(Array.isArray(response.body.a)).toBe(true);
			expect(response.body.a).toContain('x');
			expect(response.body.a).toContain('y');
		});

		test('Should convert to object when array index exceeds QS_ARRAY_LIMIT', async () => {
			const mockRouter = Router();

			mockRouter.use('/test-query', (req, res) => {
				res.json(req.query);
			});

			mockGetEndpointRouter.mockReturnValueOnce(mockRouter);

			const app = await createApp();
			// QS_ARRAY_LIMIT is set to 5, so index 6 exceeds limit and converts to object
			const response = await request(app).get('/test-query?a[0]=x&a[5]=y');

			expect(Array.isArray(response.body.a)).toBe(false);
			expect(response.body.a).toEqual({ '0': 'x', '5': 'y' });
		});

		test('Should parse parameters within QS_PARAMETER_LIMIT', async () => {
			const mockRouter = Router();

			mockRouter.use('/test-query', (req, res) => {
				res.json(req.query);
			});

			mockGetEndpointRouter.mockReturnValueOnce(mockRouter);

			const app = await createApp();
			const response = await request(app).get('/test-query?a=1&b=2&c=3&d=4&e=5');

			expect(response.body).toEqual({ a: '1', b: '2', c: '3', d: '4', e: '5' });
		});

		test('Should ignore parameters exceeding QS_PARAMETER_LIMIT', async () => {
			const mockRouter = Router();

			mockRouter.use('/test-query', (req, res) => {
				res.json(req.query);
			});

			mockGetEndpointRouter.mockReturnValueOnce(mockRouter);

			const app = await createApp();
			// QS_PARAMETER_LIMIT is set to 10, so params beyond 10 should be ignored
			const response = await request(app).get('/test-query?a=1&b=2&c=3&d=4&e=5&f=6&g=7&h=8&i=9&j=10&k=11&l=12');

			expect(response.body).not.toHaveProperty('k');
			expect(response.body).not.toHaveProperty('l');
		});
	});
});
