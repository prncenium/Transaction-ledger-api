import { z } from 'zod';
import mongoose from 'mongoose';

export const objectId = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId',
});
