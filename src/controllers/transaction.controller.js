import { createTransaction, getHistory } from '../services/transaction.service.js';

export async function create(req, res, next) {
  try {
    const data = await createTransaction(req.params.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function history(req, res, next) {
  try {
    const data = await getHistory(req.params.id, req.validatedQuery);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
