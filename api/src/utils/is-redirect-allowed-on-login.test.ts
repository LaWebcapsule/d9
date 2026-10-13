import { vi, expect, test, afterEach } from 'vitest';
import { isRedirectAllowedOnLogin } from './is-redirect-allowed-on-login.js';

vi.mock('../env', () => {
	const MOCK_ENV = {
		PUBLIC_URL: 'http://public.example.com',
		AUTH_LOCALS_REDIRECT_ALLOW_LIST:
			'http://external.example.com,https://external.example.com,http://external.example.com:8055/test',
		AUTH_LOCAL_REDIRECT_ALLOW_LIST: 'http://external.example.com',
	};

	return {
		default: MOCK_ENV,
		getEnv: vi.fn().mockImplementation(() => MOCK_ENV),
	};
});

afterEach(() => {
	vi.clearAllMocks();
});

test('isRedirectAllowedOnLogin returns true with no redirect', () => {
	const redirect = undefined;
	const provider = 'local';

	expect(isRedirectAllowedOnLogin(redirect, provider)).toBe(true);
});

test('isRedirectAllowedOnLogin returns false with invalid redirect', () => {
	const redirect = 123456;
	const provider = 'local';

	expect(isRedirectAllowedOnLogin(redirect, provider)).toBe(false);
});

test('isRedirectAllowedOnLogin returns true for allowed URL', () => {
	const provider = 'locals';

	expect(isRedirectAllowedOnLogin('http://public.example.com', provider)).toBe(true);
	expect(isRedirectAllowedOnLogin('http://external.example.com', provider)).toBe(true);
	expect(isRedirectAllowedOnLogin('https://external.example.com', provider)).toBe(true);
	expect(isRedirectAllowedOnLogin('http://external.example.com:8055/test', provider)).toBe(true);
});

test('isRedirectAllowedOnLogin returns false for denied URL', () => {
	const provider = 'local';

	expect(isRedirectAllowedOnLogin('https://external.example.com', provider)).toBe(false);
	expect(isRedirectAllowedOnLogin('http://external.example.com:8055', provider)).toBe(false);
	expect(isRedirectAllowedOnLogin('http://external.example.com/test', provider)).toBe(false);
});

test('isRedirectAllowedOnLogin returns true for relative paths', () => {
	const provider = 'local';

	expect(isRedirectAllowedOnLogin('/admin/content', provider)).toBe(true);
	expect(isRedirectAllowedOnLogin('../admin/content', provider)).toBe(true);
	expect(isRedirectAllowedOnLogin('./admin/content', provider)).toBe(true);
	expect(isRedirectAllowedOnLogin('my-protocol//example.com', provider)).toBe(true);

	expect(isRedirectAllowedOnLogin('http://public.example.com/admin/content', provider)).toBe(true);
});

test('isRedirectAllowedOnLogin returns false if missing protocol', () => {
	const provider = 'local';

	expect(isRedirectAllowedOnLogin('//example.com/admin/content', provider)).toBe(false);
	expect(isRedirectAllowedOnLogin('//user@password:example.com/', provider)).toBe(false);
});

test('isRedirectAllowedOnLogin returns false for backslash authority tricks', () => {
	const provider = 'local';

	expect(isRedirectAllowedOnLogin('/\\example.com', provider)).toBe(false);
	expect(isRedirectAllowedOnLogin('\\/example.com', provider)).toBe(false);
	expect(isRedirectAllowedOnLogin('\\\\example.com', provider)).toBe(false);
	expect(isRedirectAllowedOnLogin('/\\/example.com', provider)).toBe(false);
	expect(isRedirectAllowedOnLogin('/\t/example.com', provider)).toBe(false);
	expect(isRedirectAllowedOnLogin(' //example.com', provider)).toBe(false);
	expect(isRedirectAllowedOnLogin('\t//example.com', provider)).toBe(false);
});

test('isRedirectAllowedOnLogin returns false for a scheme without authority', () => {
	const provider = 'local';

	expect(isRedirectAllowedOnLogin('https:example.com', provider)).toBe(false);
	expect(isRedirectAllowedOnLogin('https:/example.com', provider)).toBe(false);
	expect(isRedirectAllowedOnLogin('http:example.com', provider)).toBe(false);
	expect(isRedirectAllowedOnLogin('my-protocol://example.com', provider)).toBe(false);
});

test('isRedirectAllowedOnLogin returns false for a different port than PUBLIC_URL', () => {
	const provider = 'local';

	expect(isRedirectAllowedOnLogin('http://public.example.com:8443', provider)).toBe(false);
	expect(isRedirectAllowedOnLogin('http://public.example.com:8443/admin', provider)).toBe(false);
});
