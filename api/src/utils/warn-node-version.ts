import { getEnv } from '../env.js';
import logger from '../logger.js';

const NEXT_NODE_MAJOR = 24;
const SWITCH_DATE = '2027-01-31';

export function warnNodeVersion(nodeVersion = process.versions.node): void {
	if (!getEnv()['NODE_VERSION_WARNING']) return;

	if (Number(nodeVersion.split('.')[0]) >= NEXT_NODE_MAJOR) return;

	logger.warn(
		`d9 will require Node.js ${NEXT_NODE_MAJOR} from ${SWITCH_DATE}. You are running Node.js ${nodeVersion}. ` +
			`See https://d9.webcapsule.io/self-hosted/node-versions.html. Set NODE_VERSION_WARNING=false to hide this message.`
	);
}
