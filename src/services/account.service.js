import Account from '../models/Account.js';
import { AppError } from '../utils/AppError.js';

export async function createAccount(name) {
  return Account.create({ name });
}

export async function listAccounts({ page, limit }) {
  const [items, total_records] = await Promise.all([
    Account.find()
      .sort({ created_at: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Account.countDocuments(),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total_records,
      total_pages: Math.ceil(total_records / limit),
    },
  };
}

export async function getBalance(id) {
  const account = await Account.findById(id);
  if (!account) {
    throw new AppError(404, 'ACCOUNT_NOT_FOUND');
  }
  return {
    account_id: account.id,
    name: account.name,
    balance: account.balance,
    created_at: account.created_at,
  };
}
