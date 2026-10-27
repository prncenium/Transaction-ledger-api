import { createAccount, getBalance, listAccounts } from '../services/account.service.js';

export async function create(req, res, next) {
  try {
    const account = await createAccount(req.body.name);
    res.status(201).json({ success: true, data: account });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const data = await listAccounts(req.validatedQuery);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function balance(req, res, next) {
  try {
    const data = await getBalance(req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
