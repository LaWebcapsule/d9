import type { Filter } from '@wbce-d9/types';
import { defineOperationApi, validatePayload } from '@wbce-d9/utils';

type Options = {
	filter: Filter;
};

export default defineOperationApi<Options>({
	id: 'condition',

	handler: ({ filter }, { data }) => {
		const errors = validatePayload(filter, data, { requireAll: true });

		if (errors.length > 0) {
			// Joi errors hold the validated payload (_original, details[].context), which includes $env and
			// $accountability: only keep the messages, as the rejection data can be returned by webhook flows
			throw errors.map((error) => ({
				message: error.message,
				details: error.details.map(({ message, path, type }) => ({ message, path, type })),
			}));
		} else {
			return null;
		}
	},
});
