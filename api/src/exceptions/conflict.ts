import { BaseException } from '@wbce-d9/exceptions';
import type { Conflict } from '../utils/conflicts.js';

export class ConflictException extends BaseException {
	constructor(conflicts: Conflict[]) {
		super(
			`The item has been changed by someone else in the meantime. Review the changes and try again.`,
			409,
			'CONFLICT',
			{ conflicts }
		);
	}
}
