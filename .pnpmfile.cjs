// Upstream Directus 9 packages are installed only so that the lockfile (and thus
// GitHub's dependency graph / Dependabot) tracks advisories published against the
// version this fork is based on. Keep only their @directus/* dependencies.
const UPSTREAM_DIRECTUS_VERSION = '9.26.0';

const isDirectus = (name) => name === 'directus' || name.startsWith('@directus/');

function readPackage(pkg) {
	if (pkg.name === 'directus9-monorepo' && pkg.devDependencies?.directus !== UPSTREAM_DIRECTUS_VERSION) {
		throw new Error(
			`The root devDependency "directus" must stay pinned to ${UPSTREAM_DIRECTUS_VERSION} (found "${pkg.devDependencies?.directus}"). ` +
				'It is the upstream version this fork is based on, kept only to surface its security advisories (see .pnpmfile.cjs).'
		);
	}

	if (!isDirectus(pkg.name)) return pkg;

	pkg.dependencies = Object.fromEntries(Object.entries(pkg.dependencies ?? {}).filter(([name]) => isDirectus(name)));
	pkg.optionalDependencies = {};
	pkg.peerDependencies = {};
	pkg.peerDependenciesMeta = {};

	return pkg;
}

module.exports = { hooks: { readPackage } };
