import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { RequestFilteringHttpAgent, RequestFilteringHttpsAgent } from 'request-filtering-agent';
import { getEnv } from '../env.js';
import { requestInterceptor } from './request-interceptor.js';
import { responseInterceptor } from './response-interceptor.js';
import { validateIP } from './validate-ip.js';

export const _cache: { axiosInstance: AxiosInstance | null } = {
	axiosInstance: null,
};

export async function getAxios() {
	if (!_cache.axiosInstance) {
		const axios = (await import('axios')).default;
		_cache.axiosInstance = axios.create();
		_cache.axiosInstance.interceptors.request.use(requestInterceptor);
		_cache.axiosInstance.interceptors.response.use(responseInterceptor);
	}

	return _cache.axiosInstance;
}

const denyListLookup = async (hostname: string, options: object) => {
	const addresses = await lookup(hostname, { ...options, all: true });

	for (const { address } of addresses) {
		validateIP(address, hostname);
	}

	return [addresses] as [typeof addresses];
};

// IP addresses in the redirect URL are connected to without DNS lookup
const denyListBeforeRedirect: NonNullable<AxiosRequestConfig['beforeRedirect']> = ({ hostname, href }) => {
	if (isIP(hostname) !== 0) validateIP(hostname, href);
};

/**
 * Request config for file imports, where the URL is user-provided: only public IP addresses (or those in
 * IMPORT_FILE_IP_ALLOW_LIST) are allowed, checked on every connection (including redirects).
 * request-filtering-agent skips its deny list for addresses in its allow list, so IMPORT_IP_DENY_LIST is checked again
 * on every DNS lookup and redirect to make sure it always takes precedence over IMPORT_FILE_IP_ALLOW_LIST
 */
export const importRequestConfig = () => {
	const env = getEnv();

	const options = {
		denyIPAddressList: env['IMPORT_IP_DENY_LIST'],
		allowIPAddressList: env['IMPORT_FILE_IP_ALLOW_LIST'],
	};

	return {
		maxRedirects: 5,
		httpAgent: new RequestFilteringHttpAgent(options),
		httpsAgent: new RequestFilteringHttpsAgent(options),
		lookup: denyListLookup,
		beforeRedirect: denyListBeforeRedirect,
	} satisfies AxiosRequestConfig;
};
