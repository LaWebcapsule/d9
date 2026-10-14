import { test, vi, afterEach, beforeEach, expect } from 'vitest';
import { getAxios, _cache, importRequestConfig } from './index.js';
import { RequestFilteringHttpAgent, RequestFilteringHttpsAgent } from 'request-filtering-agent';
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

vi.mock('axios');

vi.mock('../logger.js', () => ({ default: { warn: vi.fn() } }));

const env = vi.hoisted(() => ({ current: {} as Record<string, any> }));

vi.mock('../env.js', () => ({
	default: {},
	getEnv: () => env.current,
}));

let mockAxiosInstance: AxiosInstance;

beforeEach(() => {
	env.current = { IMPORT_IP_DENY_LIST: ['0.0.0.0', '169.254.169.254'], IMPORT_FILE_IP_ALLOW_LIST: ['10.0.0.5'] };

	mockAxiosInstance = {
		interceptors: {
			request: {
				use: vi.fn(),
			},
			response: {
				use: vi.fn(),
			},
		},
	} as unknown as AxiosInstance;

	vi.mocked(axios.create).mockReturnValue(mockAxiosInstance);
});

afterEach(() => {
	vi.resetAllMocks();
	_cache.axiosInstance = null;
});

test('Creates and returns new axios instance if cache is empty', async () => {
	const instance = await getAxios();
	expect(axios.create).toHaveBeenCalled();
	expect(instance).toBe(mockAxiosInstance);
});

test('Import request config uses request filtering agents and caps redirects', () => {
	const config = importRequestConfig();
	expect(config.maxRedirects).toBe(5);
	expect(config.httpAgent).toBeInstanceOf(RequestFilteringHttpAgent);
	expect(config.httpsAgent).toBeInstanceOf(RequestFilteringHttpsAgent);
});

test('Import request config passes IMPORT_FILE_IP_ALLOW_LIST and IMPORT_IP_DENY_LIST to the agents', () => {
	const { httpAgent, httpsAgent } = importRequestConfig();

	for (const agent of [httpAgent, httpsAgent]) {
		expect((agent as any).requestFilterOptions).toMatchObject({
			allowIPAddressList: ['10.0.0.5'],
			denyIPAddressList: ['0.0.0.0', '169.254.169.254'],
		});
	}
});

// Real axios without interceptors, to check the import request config on its own: the first request goes to [::1],
// which is allowed and never denied, and redirects to the `to` query parameter
async function importFromLocalServer(to: string) {
	const { default: realAxios } = await vi.importActual<typeof import('axios')>('axios');

	const server = http.createServer((req, res) => {
		const redirect = new URL(req.url!, 'http://localhost').searchParams.get('to');

		if (redirect) res.writeHead(302, { Location: redirect.replace('PORT', String(port)) });
		res.end('ok');
	});

	await new Promise<void>((resolve) => server.listen(0, '::', resolve));
	const { port } = server.address() as AddressInfo;

	try {
		const response = await realAxios.get(`http://[::1]:${port}/?to=${encodeURIComponent(to)}`, importRequestConfig());
		return response.status;
	} finally {
		server.close();
	}
}

test.each(['http://127.0.0.1:PORT/', 'http://localhost:PORT/'])(
	'Import request config follows redirects to IMPORT_FILE_IP_ALLOW_LIST addresses (%s)',
	async (to) => {
		env.current = { IMPORT_IP_DENY_LIST: [], IMPORT_FILE_IP_ALLOW_LIST: ['::1', '127.0.0.1'] };

		await expect(importFromLocalServer(to)).resolves.toBe(200);
	}
);

test.each(['http://127.0.0.1:PORT/', 'http://localhost:PORT/'])(
	'Import request config denies redirects to IMPORT_IP_DENY_LIST addresses even if in IMPORT_FILE_IP_ALLOW_LIST (%s)',
	async (to) => {
		env.current = { IMPORT_IP_DENY_LIST: ['127.0.0.1'], IMPORT_FILE_IP_ALLOW_LIST: ['::1', '127.0.0.1'] };

		await expect(importFromLocalServer(to)).rejects.toThrow('resolves to a denied IP address');
	}
);
