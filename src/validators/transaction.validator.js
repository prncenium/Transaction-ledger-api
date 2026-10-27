import { z } from 'zod';

export const createTransactionSchema = z
  .object({
    type: z.enum(['credit', 'debit'], { message: 'INVALID_TRANSACTION_TYPE' }),
    amount: z.number().int().positive(),
    reference_id: z.string().trim().min(1).max(100),
    description: z.string().trim().max(255).optional().default(''),
  })
  .strict();

export const historyQuerySchema = z.object({
  type: z.enum(['credit', 'debit']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
