export class AppError extends Error {
  constructor(statusCode, code, message = code, details = [], data = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.data = data;
  }
}
