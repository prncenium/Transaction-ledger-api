import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';

const transactionSchema = new mongoose.Schema(
  {
    account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'amount must be an integer',
      },
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 255,
    },
    reference_id: {
      type: String,
      required: true,
      trim: true,
    },
    transfer_id: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

transactionSchema.index({ account_id: 1, reference_id: 1 }, { unique: true });
transactionSchema.index({ account_id: 1, created_at: -1 });

transactionSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

function blockImmutableWrite() {
  throw new AppError(403, 'TRANSACTION_IMMUTABLE');
}

transactionSchema.pre('updateOne', blockImmutableWrite);
transactionSchema.pre('updateMany', blockImmutableWrite);
transactionSchema.pre('findOneAndUpdate', blockImmutableWrite);
transactionSchema.pre('replaceOne', blockImmutableWrite);
transactionSchema.pre('deleteOne', blockImmutableWrite);
transactionSchema.pre('deleteMany', blockImmutableWrite);
transactionSchema.pre('findOneAndDelete', blockImmutableWrite);

transactionSchema.pre('save', function () {
  if (!this.isNew) {
    throw new AppError(403, 'TRANSACTION_IMMUTABLE');
  }
});

export default mongoose.model('Transaction', transactionSchema);
