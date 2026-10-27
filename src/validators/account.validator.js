import { z } from 'zod';
import { objectId } from '../utils/objectId.js';

export const createAccountSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
  })
  .strict();

export const accountIdParamSchema = z.object({
  id: objectId,
});

export const listAccountsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
