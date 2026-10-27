export class ApiError extends Error {
  constructor({ status, code, message, details }) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details || [];
  }
}

async function request(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`/api${path}`, opts);
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    const error = json?.error || {};
    throw new ApiError({
      status: res.status,
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'Something went wrong',
      details: error.details,
    });
  }

  return json?.data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
};
