import logger from '../logger.js';

const NEXT_NODE_MAJOR = 24;
const SWITCH_DATE = '2027-01-31';

export function warnNodeVersion(nodeVersion = process.versions.node): void {
	if (Number(nodeVersion.split('.')[0]) >= NEXT_NODE_MAJOR) return;

	logger.warn(
		`In the next major version, scheduled for ${SWITCH_DATE}, d9 will require Node.js ${NEXT_NODE_MAJOR}. ` +
			`You are currently running Node.js ${nodeVersion}. To ensure a smooth migration, check in advance that your ` +
			`extensions and runtime environment are compatible with Node.js ${NEXT_NODE_MAJOR}. ` +
			`See https://d9.webcapsule.io/self-hosted/node-versions.html`
	);
}
