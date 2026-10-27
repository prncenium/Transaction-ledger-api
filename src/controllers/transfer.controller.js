import { transfer } from '../services/transfer.service.js';

export async function create(req, res, next) {
  try {
    const data = await transfer(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
