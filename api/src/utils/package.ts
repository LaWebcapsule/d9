import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const apiPkgPath = resolve(__dirname, '../../package.json');

const { name, version } = JSON.parse(readFileSync(apiPkgPath, 'utf8')) as {
	name: string;
	version: string;
};

function pkgVersion(path: string): string | null {
	try {
		return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).version ?? null : null;
	} catch {
		return null;
	}
}

// d9 release version (the bundle, matching the Docker image tag): dev-checkout root, then the
// installed bundle (published/projen image), then the api version as a last resort.
const mainVersion =
	pkgVersion(resolve(dirname(apiPkgPath), '../../../../../../package.json')) ??
	pkgVersion(resolve(process.cwd(), 'node_modules/@wbce-d9/directus9/package.json')) ??
	pkgVersion(resolve(process.cwd(), 'node_modules/directus9/package.json')) ??
	version;

export { name, version, mainVersion };
