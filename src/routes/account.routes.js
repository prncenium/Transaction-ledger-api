import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { createAccountSchema, accountIdParamSchema, listAccountsQuerySchema } from '../validators/account.validator.js';
import { create, balance, list } from '../controllers/account.controller.js';
import transactionRoutes from './transaction.routes.js';

const router = Router();

router.post('/', validate({ body: createAccountSchema }), create);
router.get('/', validate({ query: listAccountsQuerySchema }), list);
router.get('/:id/balance', validate({ params: accountIdParamSchema }), balance);
router.use('/:id/transactions', transactionRoutes);

export default router;
