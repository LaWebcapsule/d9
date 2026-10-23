// Upstream Directus 9 packages are installed only so that the lockfile (and thus
// GitHub's dependency graph / Dependabot) tracks advisories published against the
// version this fork is based on. Keep only their @directus/* dependencies.
// "directus" is a root runtime dependency, not a devDependency, so that Dependabot's
// "Dismiss low impact issues for development-scoped dependencies" preset rule doesn't
// auto-dismiss its advisories.
const UPSTREAM_DIRECTUS_VERSION = '9.26.0';

const isDirectus = (name) => name === 'directus' || name.startsWith('@directus/');

function readPackage(pkg) {
	if (pkg.name === 'directus9-monorepo' && pkg.dependencies?.directus !== UPSTREAM_DIRECTUS_VERSION) {
		throw new Error(
			`The root dependency "directus" must stay pinned to ${UPSTREAM_DIRECTUS_VERSION} (found "${pkg.dependencies?.directus}"). ` +
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
