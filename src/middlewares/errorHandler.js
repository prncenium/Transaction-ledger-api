import { AppError } from '../utils/AppError.js';

export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    const body = {
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    };
    if (err.data !== undefined) body.data = err.data;
    return res.status(err.statusCode).json(body);
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ID', message: 'Invalid identifier', details: [] },
    });
  }

  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details },
    });
  }

  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue || {});
    return res.status(409).json({
      success: false,
      error: { code: 'DUPLICATE', message: 'Duplicate key', details: fields.map((field) => ({ field, message: 'already exists' })) },
    });
  }

  if (err instanceof SyntaxError && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'Invalid JSON body', details: [] },
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error', details: [] },
  });
}
