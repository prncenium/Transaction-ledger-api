import { AppError } from '../utils/AppError.js';

export function validate({ body, params, query }) {
  return (req, res, next) => {
    try {
      if (body) req.body = parse(body, req.body);
      if (params) req.params = parse(params, req.params);
      if (query) req.validatedQuery = parse(query, req.query);
      next();
    } catch (err) {
      next(err);
    }
  };
}

function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', details);
  }
  return result.data;
}
