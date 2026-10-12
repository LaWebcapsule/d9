// Changelog generator: @changesets/changelog-github, plus a "security:" prefix and the CVE/GHSA ids
// mentioned in the PR description for changesets whose PR has the "security" label.
// See https://changesets.dev/guide/customize-changelog-format
/* eslint-env es2022 */
import github from '@changesets/changelog-github';
import { getCommitInfo } from '@changesets/get-github-info';

const ID_REGEX = /GHSA(?:-[23456789cfghjmpqrvwx]{4}){3}|CVE-\d{4}-\d{4,}/gi;

const normalizeId = (id) =>
	id.toUpperCase().startsWith('GHSA') ? `GHSA${id.slice(4).toLowerCase()}` : id.toUpperCase();

async function getPullRequest(repo, number) {
	const response = await fetch(`https://api.github.com/repos/${repo}/pulls/${number}`, {
		headers: {
			Accept: 'application/vnd.github+json',
			Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
		},
	});

	if (!response.ok) throw new Error(`Fetching PR #${number}: ${response.status} ${await response.text()}`);

	return response.json();
}

async function withSecurityInfo(changeset, repo) {
	if (!changeset.commit) return changeset;

	const pull = (await getCommitInfo({ repo, commit: changeset.commit }))?.pull;
	if (!pull) return changeset;

	const pr = await getPullRequest(repo, pull.number);
	if (!pr.labels.some((label) => label.name === 'security')) return changeset;

	let [firstLine, ...otherLines] = changeset.summary.split('\n');
	if (!/^security:/i.test(firstLine)) firstLine = `security: ${firstLine}`;

	const known = new Set((firstLine.match(ID_REGEX) ?? []).map(normalizeId));
	const ids = [...new Set((pr.body?.match(ID_REGEX) ?? []).map(normalizeId))].filter((id) => !known.has(id));
	if (ids.length > 0) firstLine = `${firstLine} (${ids.join(', ')})`;

	return { ...changeset, summary: [firstLine, ...otherLines].join('\n') };
}

export default {
	getReleaseLine: async (changeset, type, options) =>
		github.getReleaseLine(await withSecurityInfo(changeset, options.repo), type, options),
	getDependencyReleaseLine: github.getDependencyReleaseLine,
};
