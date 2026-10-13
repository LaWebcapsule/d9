import { toArray } from '@wbce-d9/utils';
import { URL } from 'url';
import env from '../env.js';
import isUrlAllowed from './is-url-allowed.js';

// Sentinel origin that never resolves (RFC 6761): relative paths keep it,
// anything pointing elsewhere (`//x`, `/\x`, `https://x`) does not.
const RELATIVE_BASE = 'https://relative.invalid';

function isUrlValid(url: string, base?: string) {
	try {
		new URL(url, base);
		return true;
	} catch (err) {
		return false;
	}
}

/**
 * Checks if the defined redirect after successful SSO login is in the allow list
 */
export function isRedirectAllowedOnLogin(redirect: unknown, provider: string): boolean {
	if (!redirect) return true; // empty redirect
	if (typeof redirect !== 'string') return false; // invalid type

	if (!isUrlValid(redirect)) {
		// relative path like `/admin/test`, allowed unless it resolves to another origin
		return isUrlValid(redirect, RELATIVE_BASE) && new URL(redirect, RELATIVE_BASE).origin === RELATIVE_BASE;
	}

	const { protocol: redirectProtocol, host: redirectHost } = new URL(redirect);

	const publicUrl = env['PUBLIC_URL'] as string;
	const envKey = `AUTH_${provider.toUpperCase()}_REDIRECT_ALLOW_LIST`;

	if (envKey in env) {
		if (isUrlAllowed(redirect, [...toArray(env[envKey] as string), publicUrl])) return true;
	}

	if (!isUrlValid(publicUrl)) return false;

	// allow redirects to the defined PUBLIC_URL
	const { protocol: publicProtocol, host: publicHost } = new URL(publicUrl);

	return redirectProtocol === publicProtocol && redirectHost === publicHost;
}
