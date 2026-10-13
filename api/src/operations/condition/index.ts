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
			// Joi errors hold the validated data ($env, $accountability…) in _original, details[].context and in some
			// messages: only keep the path and type, both derived from the filter, as webhook flows can return them
			throw errors.flatMap((error) => error.details.map(({ path, type }) => ({ path, type })));
		} else {
			return null;
		}
	},
});
