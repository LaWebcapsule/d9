import { randIp, randUrl } from '@ngneat/falso';
import os from 'node:os';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getEnv } from '../env.js';
import logger from '../logger.js';
import { validateIP } from './validate-ip.js';

vi.mock('../env');
vi.mock('node:os');

vi.mock('../logger.js', () => ({
	default: {
		warn: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
	},
}));

let sample: {
	ip: string;
	url: string;
};

beforeEach(() => {
	sample = {
		ip: randIp(),
		url: randUrl(),
	};
});

afterEach(() => {
	vi.resetAllMocks();
});

test(`Does nothing if IP is valid`, async () => {
	vi.mocked(getEnv).mockReturnValue({ IMPORT_IP_DENY_LIST: [] });
	validateIP(sample.ip, sample.url);
});

test(`Throws error if passed IP is denylisted`, async () => {
	vi.mocked(getEnv).mockReturnValue({ IMPORT_IP_DENY_LIST: [sample.ip] });

	expect(() => validateIP(sample.ip, sample.url)).toThrow(
		`Requested URL "${sample.url}" resolves to a denied IP address`
	);
});

test(`Throws error for invalid CIDR in deny list`, async () => {
	vi.mocked(getEnv).mockReturnValue({ IMPORT_IP_DENY_LIST: ['192.0.0.36/33'] });

	expect(() => validateIP(sample.ip, sample.url)).toThrow(
		'The value of "prefix" is out of range. It must be >= 0 && <= 32. Received 33'
	);
});

test(`Throws error for malformed CIDR in deny list`, async () => {
	vi.mocked(getEnv).mockReturnValue({ IMPORT_IP_DENY_LIST: ['192.168.1.1/abc'] });

	expect(() => validateIP(sample.ip, sample.url)).toThrow('Invalid CIDR format: prefix length must be a number');
});

test(`Checks against IPs of local networkInterfaces if IP deny list contains 0.0.0.0`, async () => {
	vi.mocked(getEnv).mockReturnValue({ IMPORT_IP_DENY_LIST: ['0.0.0.0'] });
	vi.mocked(os.networkInterfaces).mockReturnValue({});
	validateIP(sample.ip, sample.url);
	expect(os.networkInterfaces).toHaveBeenCalledOnce();
});

test(`Throws error if IP address matches resolved localhost IP`, async () => {
	vi.mocked(getEnv).mockReturnValue({ IMPORT_IP_DENY_LIST: ['0.0.0.0'] });

	vi.mocked(os.networkInterfaces).mockReturnValue({
		fa0: undefined,
		lo0: [
			{
				address: '127.0.0.1',
				netmask: '255.0.0.0',
				family: 'IPv4',
				mac: '00:00:00:00:00:00',
				internal: true,
				cidr: '127.0.0.1/8',
			},
		],
		en0: [
			{
				address: sample.ip,
				netmask: '255.0.0.0',
				family: 'IPv4',
				mac: '00:00:00:00:00:00',
				internal: true,
				cidr: `${sample.ip}/24`,
			},
		],
	});

	expect(() => validateIP(sample.ip, sample.url)).toThrow(
		`Requested URL "${sample.url}" resolves to a denied IP address`
	);
});

test(`Throws error if IP matches any address in the loopback range (127.0.0.0/8)`, async () => {
	vi.mocked(getEnv).mockReturnValue({ IMPORT_IP_DENY_LIST: ['0.0.0.0'] });
	vi.mocked(os.networkInterfaces).mockReturnValue({});

	// Test various loopback addresses that should be blocked
	const loopbackIPs = ['127.0.0.1', '127.0.0.2', '127.8.16.32', '127.127.127.127'];

	for (const loopbackIP of loopbackIPs) {
		expect(() => validateIP(loopbackIP, sample.url)).toThrow(
			`Requested URL "${sample.url}" resolves to a denied IP address`
		);
	}
});

test(`Allows non-loopback addresses when 0.0.0.0 is in deny list`, async () => {
	vi.mocked(getEnv).mockReturnValue({ IMPORT_IP_DENY_LIST: ['0.0.0.0'] });
	vi.mocked(os.networkInterfaces).mockReturnValue({});

	// These should NOT be blocked
	const validIPs = ['126.255.255.255', '128.0.0.1', '192.168.1.1', '10.0.0.1'];

	for (const validIP of validIPs) {
		expect(() => validateIP(validIP, sample.url)).not.toThrow();
	}
});

test(`Handles CIDR ranges correctly`, async () => {
	vi.mocked(getEnv).mockReturnValue({ IMPORT_IP_DENY_LIST: ['192.168.1.0/24'] });

	// Should block IPs in the 192.168.1.0/24 range
	expect(() => validateIP('192.168.1.100', sample.url)).toThrow();
	expect(() => validateIP('192.168.1.1', sample.url)).toThrow();
	expect(() => validateIP('192.168.1.255', sample.url)).toThrow();

	// Should NOT block IPs outside the range
	expect(() => validateIP('192.168.2.1', sample.url)).not.toThrow();
	expect(() => validateIP('10.0.0.1', sample.url)).not.toThrow();
});

test(`Blocks IPv6 local interface addresses if IP deny list contains 0.0.0.0`, async () => {
	vi.mocked(getEnv).mockReturnValue({ IMPORT_IP_DENY_LIST: ['0.0.0.0'] });

	vi.mocked(os.networkInterfaces).mockReturnValue({
		lo0: [
			{
				address: '::1',
				netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
				family: 'IPv6',
				mac: '00:00:00:00:00:00',
				internal: true,
				cidr: '::1/128',
				scopeid: 0,
			},
		],
	});

	expect(() => validateIP('::1', sample.url)).toThrow(`Requested URL "${sample.url}" resolves to a denied IP address`);

	expect(logger.warn).not.toHaveBeenCalled();
});
