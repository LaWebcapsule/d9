import type { AxiosResponse } from 'axios';
import { validateIP } from './validate-ip.js';

export const responseInterceptor = async (config: AxiosResponse<any, any>) => {
	validateIP(config.request.socket.remoteAddress, config.request.url);
	return config;
};
