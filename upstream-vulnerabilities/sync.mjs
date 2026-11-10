/* eslint-env es2022 */
/* eslint-disable no-console -- CLI script */

// For each Dependabot alert on upstream Directus 9 packages (see .pnpmfile.cjs) dismissed as
// "not used" or "inaccurate", opens a PR adding <id>.json to this folder.
//
// Also opens a single PR adding to pnpm.auditConfig.ignoreGhsas the advisories of these alerts and
// of those dismissed as "fix started" whose comment names the merged PR that fixed them, so that
// `pnpm audit` only reports upstream advisories still to be triaged.
//
// Requires GH_TOKEN and GITHUB_REPOSITORY. Set DRY_RUN=1 to only print what would be done.
import { existsSync } from 'node:fs';

const API = process.env.GITHUB_API_URL ?? 'https://api.github.com';
const REPO = process.env.GITHUB_REPOSITORY;
const BASE = process.env.GITHUB_REF_NAME ?? 'main';
const DRY_RUN = Boolean(process.env.DRY_RUN);
const NOT_APPLICABLE_REASONS = ['not_used', 'inaccurate'];
const AUDIT_BRANCH_PREFIX = 'upstream-vulnerabilities/audit-config';
// "Fixed in #414", "fixed in PR 460"
const FIX_PR_PATTERN = /(?:#|\bPR\s*)(\d+)/i;

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
			// Commits are made by GITHUB_TOKEN's bot, signed off for the DCO check
			message: `${title}\n\nSigned-off-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>`,
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

function isTriaged(alert, mergedPrs) {
	if (NOT_APPLICABLE_REASONS.includes(alert.dismissed_reason)) return true;

	const fixPr = alert.dismissed_comment?.match(FIX_PR_PATTERN)?.[1];

	return alert.dismissed_reason === 'fix_started' && mergedPrs.has(Number(fixPr));
}

function auditIgnoredGhsas(alerts, prs) {
	const mergedPrs = new Set(prs.filter((pr) => pr.merged_at).map((pr) => pr.number));

	return new Set(
		alerts
			.filter((alert) => isUpstream(alert.dependency.package.name) && isTriaged(alert, mergedPrs))
			.map((alert) => alert.security_advisory.ghsa_id)
	);
}

async function getPackageJson(ref) {
	const file = await api(`/repos/${REPO}/contents/package.json?ref=${encodeURIComponent(ref)}`);

	return { sha: file.sha, pkg: JSON.parse(Buffer.from(file.content, 'base64').toString()) };
}

function auditPrBody(ghsas) {
	return `## Change description

Ignores in \`pnpm audit\` the upstream advisories whose Dependabot alerts are dismissed as not applicable, or as fixed
by a merged PR:

${ghsas.map((ghsa) => `- https://github.com/advisories/${ghsa}`).join('\n')}

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

// Adds the missing advisories to the open audit config PR, or opens one
async function syncAuditConfig(ghsas, prs) {
	const openPr = prs.find((pr) => pr.state === 'open' && pr.head.ref.startsWith(AUDIT_BRANCH_PREFIX));
	const branch = openPr?.head.ref ?? `${AUDIT_BRANCH_PREFIX}-${new Date().toISOString().slice(0, 10)}`;
	const baseIgnored = (await getPackageJson(BASE)).pkg.pnpm.auditConfig.ignoreGhsas;
	const { sha, pkg } = await getPackageJson(openPr ? branch : BASE);
	const ignored = pkg.pnpm.auditConfig.ignoreGhsas;
	const missing = [...ghsas].filter((ghsa) => !ignored.includes(ghsa)).sort();

	if (missing.length === 0) {
		console.log('audit config: up to date');
		return;
	}

	if (DRY_RUN) {
		console.log(`audit config: would ignore ${missing.join(', ')}`);
		return;
	}

	if (!openPr) {
		const base = await api(`/repos/${REPO}/git/ref/heads/${BASE}`);

		await api(`/repos/${REPO}/git/refs`, {
			method: 'POST',
			body: { ref: `refs/heads/${branch}`, sha: base.object.sha },
		});
	}

	ignored.push(...missing);
	const added = ignored.filter((ghsa) => !baseIgnored.includes(ghsa));
	const title = 'chore: ignore triaged upstream advisories in pnpm audit';

	await api(`/repos/${REPO}/contents/package.json`, {
		method: 'PUT',
		body: {
			message: `${title}\n\nSigned-off-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>`,
			content: Buffer.from(JSON.stringify(pkg, null, '\t') + '\n').toString('base64'),
			sha,
			branch,
		},
	});

	if (openPr) {
		await api(`/repos/${REPO}/pulls/${openPr.number}`, { method: 'PATCH', body: { body: auditPrBody(added) } });
		console.log(`audit config: updated ${openPr.html_url}`);
	} else {
		const pr = await api(`/repos/${REPO}/pulls`, {
			method: 'POST',
			body: { title, head: branch, base: BASE, body: auditPrBody(added) },
		});

		console.log(`audit config: opened ${pr.html_url}`);
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

	try {
		await syncAuditConfig(auditIgnoredGhsas(alerts, prs), prs);
	} catch (error) {
		console.error(`audit config: ${error.message}`);
		process.exitCode = 1;
	}
}

main();
