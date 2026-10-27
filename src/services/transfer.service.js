import mongoose from 'mongoose';
import crypto from 'crypto';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';
import { AppError } from '../utils/AppError.js';

export async function transfer({ from_account_id, to_account_id, amount, reference_id, description }) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const fromAccount = await Account.findById(from_account_id, null, { session });
      const toAccount = await Account.findById(to_account_id, null, { session });
      if (!fromAccount) {
        throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Source account not found');
      }
      if (!toAccount) {
        throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Destination account not found');
      }

      const existing = await Transaction.findOne({
        reference_id,
        account_id: { $in: [from_account_id, to_account_id] },
      }, null, { session });
      if (existing) {
        throw new AppError(409, 'DUPLICATE_TRANSACTION', 'Transaction already exists', [], existing);
      }

      const transfer_id = crypto.randomUUID();

      const debitedAccount = await Account.findOneAndUpdate(
        { _id: from_account_id, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { returnDocument: 'after', session }
      );
      if (!debitedAccount) {
        throw new AppError(422, 'INSUFFICIENT_BALANCE');
      }

      const creditedAccount = await Account.findOneAndUpdate(
        { _id: to_account_id },
        { $inc: { balance: amount } },
        { returnDocument: 'after', session }
      );

      let transactions;
      try {
        transactions = await Transaction.create(
          [
            {
              account_id: from_account_id,
              type: 'debit',
              amount,
              reference_id,
              transfer_id,
              description: description || `Transfer to ${to_account_id}`,
            },
            {
              account_id: to_account_id,
              type: 'credit',
              amount,
              reference_id,
              transfer_id,
              description: description || `Transfer from ${from_account_id}`,
            },
          ],
          { session, ordered: true }
        );
      } catch (err) {
        if (err.code === 11000) {
          const existingTx = await Transaction.findOne({
            reference_id,
            account_id: { $in: [from_account_id, to_account_id] },
          }, null, { session });
          throw new AppError(409, 'DUPLICATE_TRANSACTION', 'Transaction already exists', [], existingTx);
        }
        throw err;
      }

      result = {
        transfer_id,
        amount,
        from: { account_id: debitedAccount.id, balance: debitedAccount.balance },
        to: { account_id: creditedAccount.id, balance: creditedAccount.balance },
        transactions,
      };
    });
    return result;
  } finally {
    await session.endSession();
  }
}
