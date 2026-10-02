/* eslint-env es2022 */
/* eslint-disable no-console -- CLI script */

// For each Dependabot alert on upstream Directus 9 packages (see .pnpmfile.cjs) dismissed as
// "not used" or "inaccurate", opens a PR adding <id>.json to this folder.
//
// Requires GH_TOKEN and GITHUB_REPOSITORY. Set DRY_RUN=1 to only print what would be done.
import { existsSync } from 'node:fs';

const API = process.env.GITHUB_API_URL ?? 'https://api.github.com';
const REPO = process.env.GITHUB_REPOSITORY;
const BASE = process.env.GITHUB_REF_NAME ?? 'main';
const DRY_RUN = Boolean(process.env.DRY_RUN);
const NOT_APPLICABLE_REASONS = ['not_used', 'inaccurate'];

async function request(path, { method = 'GET', body } = {}) {
	const response = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
		method,
		headers: {
			Accept: 'application/vnd.github+json',
			Authorization: `Bearer ${process.env.GH_TOKEN}`,
			'X-GitHub-Api-Version': '2022-11-28',
		},
		body: body && JSON.stringify(body),
	});

	if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);

	return response;
}

async function api(path, options) {
	return (await request(path, options)).json();
}

// Follows the Link header until the last page
async function paginate(path) {
	const items = [];
	let url = path;

	while (url) {
		const response = await request(url);
		items.push(...(await response.json()));
		url = response.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
	}

	return items;
}

const isUpstream = (name) => name === 'directus' || name.startsWith('@directus/');

const branchName = (id) => `upstream-vulnerabilities/${id}`;

// One entry per vulnerability (CVE id, or GHSA id when there is none), with its not applicable
// alerts on upstream packages and the PR already opened for it
function groupVulnerabilities(alerts, prs) {
	const upstreamAlerts = alerts.filter(
		(alert) => isUpstream(alert.dependency.package.name) && NOT_APPLICABLE_REASONS.includes(alert.dismissed_reason)
	);

	const groups = Object.groupBy(
		upstreamAlerts,
		(alert) => alert.security_advisory.cve_id ?? alert.security_advisory.ghsa_id
	);

	return Object.entries(groups).map(([id, alerts]) => {
		const advisory = alerts[0].security_advisory;

		return {
			id,
			advisory,
			alerts,
			pr: prs.find((pr) => pr.head.ref === branchName(id)),
			date: alerts
				.map((alert) => alert.dismissed_at)
				.sort()
				.at(-1)
				.slice(0, 10),
			comment: [...new Set(alerts.map((alert) => alert.dismissed_comment).filter(Boolean))].join(' '),
		};
	});
}

function prBody(vulnerability) {
	return `## Change description

Lists upstream ${vulnerability.id} (${vulnerability.advisory.summary}) as not applicable to d9.

Dismissed Dependabot alerts:
${vulnerability.alerts.map((alert) => `- ${alert.html_url}`).join('\n')}

## Type of change

- [ ] Bug fix (fixes an issue)
- [ ] New feature (adds functionality)

## Related issues

> None

## Checklists

### Security

- [ ] Security impact of change has been considered

### Code review

- [ ] reviewers assigned
`;
}

async function openPullRequest(vulnerability) {
	const { id, advisory } = vulnerability;
	const branch = branchName(id);
	const title = `docs: list upstream ${id} as not applicable`;

	const entry = {
		id,
		ghsa: advisory.ghsa_id,
		summary: advisory.summary,
		reason: vulnerability.comment || 'The vulnerable code is not used by d9.',
		date: vulnerability.date,
	};

	const base = await api(`/repos/${REPO}/git/ref/heads/${BASE}`);
	await api(`/repos/${REPO}/git/refs`, { method: 'POST', body: { ref: `refs/heads/${branch}`, sha: base.object.sha } });

	await api(`/repos/${REPO}/contents/upstream-vulnerabilities/${id}.json`, {
		method: 'PUT',
		body: {
			message: title,
			content: Buffer.from(JSON.stringify(entry, null, '\t') + '\n').toString('base64'),
			branch,
		},
	});

	const pr = await api(`/repos/${REPO}/pulls`, {
		method: 'POST',
		body: { title, head: branch, base: BASE, body: prBody(vulnerability) },
	});

	return pr.html_url;
}

async function sync(vulnerability) {
	const { id } = vulnerability;

	if (existsSync(new URL(`${id}.json`, import.meta.url))) {
		console.log(`${id}: already listed`);
	} else if (vulnerability.pr) {
		console.log(`${id}: PR ${vulnerability.pr.html_url} already exists`);
	} else if (DRY_RUN) {
		console.log(`${id}: would open a PR listing it as not applicable`);
	} else {
		console.log(`${id}: opened ${await openPullRequest(vulnerability)}`);
	}
}

async function main() {
	const alerts = await paginate(`/repos/${REPO}/dependabot/alerts?state=dismissed&ecosystem=npm&per_page=100`);
	// Open, closed and merged PRs
	const prs = await paginate(`/repos/${REPO}/pulls?state=all&per_page=100`);

	for (const vulnerability of groupVulnerabilities(alerts, prs)) {
		try {
			await sync(vulnerability);
		} catch (error) {
			console.error(`${vulnerability.id}: ${error.message}`);
			process.exitCode = 1;
		}
	}
}

main();
