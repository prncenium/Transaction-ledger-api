# Transaction Ledger API

Backend-only REST API for managing account balances, transactions and account-to-account transfers, built with Express 5, Mongoose and Zod.

## Stack

Node.js (ESM) · Express 5 · Mongoose · Zod · cors · swagger-ui-express · swagger-jsdoc

## Prerequisites

- Node.js LTS
- MongoDB with a replica set (required for Mongoose/MongoDB multi-document transactions) — either a **MongoDB Atlas M0** free cluster (replica set by default) or a local replica-set deployment. A standalone `mongod` will not work.

## Setup

```bash
git clone <repo-url>
cd "confluncr Assesment"
npm install
cp .env.example .env   # fill in MONGO_URI
npm run dev
```

## Links

- API docs (Swagger UI): `http://localhost:5000/api-docs`
- Health check: `http://localhost:5000/health`

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Service health check |
| POST | `/api/accounts` | Create an account |
| GET | `/api/accounts` | Paginated account list |
| GET | `/api/accounts/:id/balance` | Get an account's balance |
| POST | `/api/accounts/:id/transactions` | Create a credit/debit transaction |
| GET | `/api/accounts/:id/transactions` | Paginated transaction history |
| POST | `/api/transfers` | Transfer funds between two accounts |

## Example curl

```bash
# Health
curl http://localhost:5000/health

# Create account
curl -X POST http://localhost:5000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice"}'

# Get balance
curl http://localhost:5000/api/accounts/<id>/balance

# Create a credit transaction
curl -X POST http://localhost:5000/api/accounts/<id>/transactions \
  -H "Content-Type: application/json" \
  -d '{"type":"credit","amount":500,"reference_id":"ref-001"}'

# Transaction history
curl "http://localhost:5000/api/accounts/<id>/transactions?type=credit&page=1&limit=10"

# Transfer between accounts
curl -X POST http://localhost:5000/api/transfers \
  -H "Content-Type: application/json" \
  -d '{"from_account_id":"<id1>","to_account_id":"<id2>","amount":200,"reference_id":"tr-001"}'
```

## Error Format

```json
{
  "success": false,
  "error": { "code": "ACCOUNT_NOT_FOUND", "message": "ACCOUNT_NOT_FOUND", "details": [] }
}
```

`DUPLICATE_TRANSACTION` responses additionally include a top-level `data` field with the existing transaction.

| Code | Status | When |
|---|---|---|
| VALIDATION_ERROR | 400 | Zod schema failure, including extra/unknown fields and same-account transfer |
| INVALID_ID | 400 | Malformed id reaching the DB layer |
| INVALID_JSON | 400 | Malformed JSON request body |
| ROUTE_NOT_FOUND | 404 | No matching route |
| ACCOUNT_NOT_FOUND | 404 | Account id doesn't exist |
| TRANSACTION_IMMUTABLE | 403 | Attempt to update/delete a transaction |
| DUPLICATE_TRANSACTION | 409 | `reference_id` already used on that account (data holds existing tx) |
| DUPLICATE | 409 | Other Mongo duplicate-key error |
| INSUFFICIENT_BALANCE | 422 | Debit/transfer would take balance below 0 |
| INTERNAL_ERROR | 500 | Unhandled server error |

## Data Integrity

- **Atomicity**: transaction creation and transfers run inside a MongoDB session (`withTransaction`) — balance updates and ledger inserts commit or roll back together.
- **Conditional debit**: debits use `findOneAndUpdate` with `balance: { $gte: amount }` in the same atomic operation as the decrement, so balances can never go negative under concurrent requests.
- **Unique index**: `{ account_id: 1, reference_id: 1 }` on `Transaction` enforces idempotency per account; a pre-check plus a catch on Mongo error 11000 both resolve to `409 DUPLICATE_TRANSACTION`.
- **Immutability**: the `Transaction` model blocks all update/delete/replace operations and any non-initial save, making the ledger append-only.

## Assumptions

- Amounts and balances are integers in the smallest currency unit (paise) — no decimals.
- No authentication/authorization.
- All IDs are MongoDB ObjectIds.
- A duplicate `reference_id` on the same account returns `409 DUPLICATE_TRANSACTION` with the existing transaction in `data`.
- Request bodies are strict — unknown/extra fields are rejected with `400 VALIDATION_ERROR`.
- Transaction history pagination defaults to `limit=10`, capped at `limit=100`.
- A transfer creates exactly two transactions (one debit, one credit) sharing the same `reference_id` and a generated `transfer_id`.
- The same `reference_id` is allowed across different accounts (uniqueness is scoped per account), except that a transfer itself rejects reuse of its `reference_id` on either of its two accounts.

## Testing

Run the automated API test suite (Node built-ins only — no extra packages):

```bash
npm run dev        # in one terminal, leave running
npm run test:api   # in another terminal
```

The suite hits the running server at `BASE_URL` (default `http://localhost:5000`; override with `BASE_URL=... npm run test:api`). Each run creates its own fresh accounts and reference IDs, so it's safe to re-run repeatedly. See [TEST_REPORT.md](./TEST_REPORT.md) for the latest results.

## Frontend (bonus)

A Vite + React SPA in `client/` that consumes this API — not required by the assignment, included as a bonus.

**Stack**: Vite · React (JS) · Tailwind v4 (`@tailwindcss/vite`) · react-router-dom.

**Run:**

```bash
cd client
npm install
cd ..
npm run dev      # backend, in one terminal
npm run client   # frontend, in another terminal
```

Open `http://localhost:5173`. Vite's dev server proxies `/api/*` requests to `http://localhost:5000` in development, so `client/.env` can stay empty locally (the frontend's `lib/api.js` falls back to the relative `/api` path when `VITE_API_URL` is unset).

**Pages:**

| Route | Purpose |
|---|---|
| `/` | Create account + paginated accounts table |
| `/accounts/:id` | Account balance/details, credit/debit form, filterable/paginated transaction history |
| `/transfer` | Transfer funds between two accounts, with result showing both new balances |

**Money handling**: all forms accept and display amounts in rupees; `client/src/lib/money.js` converts to paise (`toPaise`) before sending to the API and formats paise back to `₹` for display (`formatINR`) — the API itself only ever deals in paise.

## Deployment (free tier)

The backend and frontend deploy separately; two env vars tie them together.

**Backend env vars** (set wherever you host it, e.g. Render):
| Var | Value |
|---|---|
| `MONGO_URI` | Your MongoDB Atlas connection string (Atlas Network Access must allow `0.0.0.0/0`, since the host's IP isn't fixed) |
| `PORT` | `5000` (most hosts override this with their own `$PORT` automatically) |
| `FRONTEND_URL` | The deployed frontend's URL, e.g. `https://your-app.vercel.app` — used for CORS |

**Frontend env vars** (set wherever you host it, e.g. Vercel, with **Root Directory** = `client`):
| Var | Value |
|---|---|
| `VITE_API_URL` | The deployed backend's URL + `/api`, e.g. `https://your-api.onrender.com/api` |

Steps:
1. Deploy `src/` (repo root, build `npm install`, start `npm start`) to a Node host — Render, Railway, or Fly.io all have free tiers. Set `MONGO_URI` and `PORT` there first; set `FRONTEND_URL` after step 2.
2. Deploy `client/` (root directory `client`, build `npm run build`, output `dist`) to a static host — Vercel or Netlify. Set `VITE_API_URL` to the backend URL from step 1.
3. Go back to the backend host and set `FRONTEND_URL` to the frontend URL from step 2, then redeploy the backend so CORS allows it.
4. In MongoDB Atlas → Network Access, add `0.0.0.0/0` so the hosted backend can connect.

## Folder Structure

```
src/        Backend source (see SPEC.md for details)
tests/      Automated API test suite (npm run test:api)
client/     Frontend SPA (Vite + React), see "Frontend (bonus)" above
```

## Submission Contents

- `src/` — backend source (Express, Mongoose, Zod, OpenAPI spec)
- `client/` — frontend SPA (Vite + React, bonus)
- `tests/` — automated API test suite
- `README.md` — this file (setup, usage, assumptions)
- `SPEC.md` — full internal spec (data models, request flow, service logic, frontend data flow)
- `TEST_REPORT.md` — latest test run results
- `/api-docs` — interactive Swagger UI (once the backend is running)

## Further details

See [SPEC.md](./SPEC.md) for the full internal spec: data models, request flow, step-by-step service logic, error code reference, and frontend data flow.
