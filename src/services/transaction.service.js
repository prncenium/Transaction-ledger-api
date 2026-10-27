import mongoose from 'mongoose';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';
import { AppError } from '../utils/AppError.js';

export async function createTransaction(accountId, { type, amount, reference_id, description }) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const account = await Account.findById(accountId, null, { session });
      if (!account) {
        throw new AppError(404, 'ACCOUNT_NOT_FOUND');
      }

      const existing = await Transaction.findOne({ account_id: accountId, reference_id }, null, { session });
      if (existing) {
        throw new AppError(409, 'DUPLICATE_TRANSACTION', 'Transaction already exists', [], existing);
      }

      let updatedAccount;
      if (type === 'credit') {
        updatedAccount = await Account.findOneAndUpdate(
          { _id: accountId },
          { $inc: { balance: amount } },
          { returnDocument: 'after', session }
        );
      } else {
        updatedAccount = await Account.findOneAndUpdate(
          { _id: accountId, balance: { $gte: amount } },
          { $inc: { balance: -amount } },
          { returnDocument: 'after', session }
        );
        if (!updatedAccount) {
          throw new AppError(422, 'INSUFFICIENT_BALANCE');
        }
      }

      let transaction;
      try {
        const [created] = await Transaction.create(
          [{ account_id: accountId, type, amount, reference_id, description }],
          { session }
        );
        transaction = created;
      } catch (err) {
        if (err.code === 11000) {
          const existingTx = await Transaction.findOne({ account_id: accountId, reference_id }, null, { session });
          throw new AppError(409, 'DUPLICATE_TRANSACTION', 'Transaction already exists', [], existingTx);
        }
        throw err;
      }

      result = { transaction, balance: updatedAccount.balance };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export async function getHistory(accountId, { type, page, limit }) {
  const account = await Account.findById(accountId);
  if (!account) {
    throw new AppError(404, 'ACCOUNT_NOT_FOUND');
  }

  const filter = { account_id: accountId };
  if (type) filter.type = type;

  const [transactions, total_records] = await Promise.all([
    Transaction.find(filter)
      .sort({ created_at: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Transaction.countDocuments(filter),
  ]);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total_records,
      total_pages: Math.ceil(total_records / limit),
    },
  };
}
