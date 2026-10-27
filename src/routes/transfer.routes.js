import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { transferSchema } from '../validators/transfer.validator.js';
import { create } from '../controllers/transfer.controller.js';

const router = Router();

router.post('/', validate({ body: transferSchema }), create);

export default router;
