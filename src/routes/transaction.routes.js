import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { accountIdParamSchema } from '../validators/account.validator.js';
import { createTransactionSchema, historyQuerySchema } from '../validators/transaction.validator.js';
import { create, history } from '../controllers/transaction.controller.js';

const router = Router({ mergeParams: true });

router.post(
  '/',
  validate({ params: accountIdParamSchema, body: createTransactionSchema }),
  create
);
router.get(
  '/',
  validate({ params: accountIdParamSchema, query: historyQuerySchema }),
  history
);

export default router;
