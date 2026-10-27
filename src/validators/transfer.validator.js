import { z } from 'zod';
import { objectId } from '../utils/objectId.js';

export const transferSchema = z
  .object({
    from_account_id: objectId,
    to_account_id: objectId,
    amount: z.number().int().positive(),
    reference_id: z.string().trim().min(1).max(100),
    description: z.string().trim().max(255).optional().default(''),
  })
  .strict()
  .refine((data) => data.from_account_id !== data.to_account_id, {
    message: 'Cannot transfer to same account',
    path: ['to_account_id'],
  });
