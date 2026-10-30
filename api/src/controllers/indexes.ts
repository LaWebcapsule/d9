import { Router } from 'express';
import validateCollection from '../middleware/collection-exists.js';
import { respond } from '../middleware/respond.js';
import { IndexesService } from '../services/indexes.js';
import type { IndexPayload } from '@wbce-d9/types';
import asyncHandler from '../utils/async-handler.js';

const router = Router();

router.get(
	'/:collection',
	validateCollection,
	asyncHandler(async (req, res, next) => {
		const service = new IndexesService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const data = await service.readAll(req.params['collection']!);

		res.locals['payload'] = { data, meta: { capabilities: service.capabilities } };
		return next();
	}),
	respond
);

router.post(
	'/:collection',
	validateCollection,
	asyncHandler(async (req, res, next) => {
		const service = new IndexesService({
			accountability: req.accountability,
			schema: req.schema,
		});

		const name = await service.createOne(req.params['collection']!, req.body as IndexPayload);
		const data = await service.readOne(req.params['collection']!, name);

		res.locals['payload'] = { data };
		return next();
	}),
	respond
);

router.delete(
	'/:collection/:name',
	validateCollection,
	asyncHandler(async (req, res, next) => {
		const service = new IndexesService({
			accountability: req.accountability,
			schema: req.schema,
		});

		await service.deleteOne(req.params['collection']!, req.params['name']!);

		res.locals['payload'] = { data: null };
		return next();
	}),
	respond
);

export default router;
