# Transaction Ledger API — Spec

## 1. Overview & Stack

Backend-only REST API for account balances, transactions and account-to-account transfers, with strict validation, consistent error shapes, and MongoDB session-based atomicity.

| Package | Version |
|---|---|
| Node.js (ESM, `"type": "module"`) | — |
| express | ^5.3.0 |
| mongoose | ^9.11.4 |
| zod | ^4.6.7 |
| swagger-ui-express | ^5.0.1 |
| swagger-jsdoc | ^6.3.0 |

Scripts: `dev` (`node --watch --env-file=.env src/server.js`), `start` (`node --env-file=.env src/server.js`).

Money is stored as integers in the smallest currency unit (paise).

## 2. Folder Structure

```
src/
├── app.js                         Express app: middleware, route mounting, 404 + error handler
├── server.js                      Connects DB then starts HTTP listener
├── config/
│   └── db.js                      Mongoose connection + syncIndexes() for Account/Transaction
├── models/
│   ├── Account.js                 Account schema (name, balance)
│   └── Transaction.js             Transaction schema, indexes, immutability hooks
├── validators/
│   ├── account.validator.js       createAccountSchema, accountIdParamSchema
│   ├── transaction.validator.js   createTransactionSchema, historyQuerySchema
│   └── transfer.validator.js      transferSchema (strict + cross-field refine)
├── middlewares/
│   ├── validate.js                Zod-driven request validator factory
│   └── errorHandler.js            Centralized error → HTTP response mapper
├── controllers/
│   ├── account.controller.js      create, balance
│   ├── transaction.controller.js  create, history
│   └── transfer.controller.js     create
├── services/
│   ├── account.service.js         createAccount, getBalance
│   ├── transaction.service.js     createTransaction, getHistory
│   └── transfer.service.js        transfer
├── routes/
│   ├── account.routes.js          /api/accounts, mounts transaction.routes under /:id/transactions
│   ├── transaction.routes.js      /:id/transactions (mergeParams)
│   └── transfer.routes.js         /api/transfers
├── utils/
│   ├── AppError.js                Custom error class (statusCode, code, message, details, data)
│   └── objectId.js                Zod schema validating a Mongo ObjectId string
└── docs/
    └── openapi.js                 OpenAPI 3.0 spec object served via Swagger UI at /api-docs

tests/
└── api.test.js                    Automated API test suite (node:test + fetch), run via `npm run test:api`
```

## 3. Request Flow

```
Route → validate(schema) middleware → controller → service (business logic + DB) → res.json({success, data})
                                                         │
                                                         └─ throws AppError / Mongoose error → next(err) → errorHandler
```

- `validate({body, params, query})` (`src/middlewares/validate.js`) parses each present part with Zod via `safeParse`. On success it overwrites `req.body`/`req.params` with the parsed data, and stores parsed query on `req.validatedQuery` (Express 5's `req.query` is read-only). On failure it throws `AppError(400, 'VALIDATION_ERROR', 'Validation failed', details)`.
- Controllers are thin: call the matching service function, wrap in try/catch, forward errors to `next(err)`.
- All errors converge on `errorHandler` (`src/middlewares/errorHandler.js`), mounted last in `app.js`, after a catch-all 404 middleware.

## 4. Data Models

### Account (`src/models/Account.js`)

| Field | Type | Constraints | Default |
|---|---|---|---|
| name | String | required, trim, min 1, max 100 | — |
| balance | Number | min 0, must be integer (custom validator) | 0 |
| created_at | Date | via `timestamps: { createdAt: 'created_at', updatedAt: false }` | now |

`toJSON` transform: adds `id` (string of `_id`), removes `_id` and `__v`.

### Transaction (`src/models/Transaction.js`)

| Field | Type | Constraints | Default |
|---|---|---|---|
| account_id | ObjectId (ref `Account`) | required | — |
| type | String | enum `credit`/`debit`, required | — |
| amount | Number | required, min 1, must be integer | — |
| description | String | trim, max 255 | `""` |
| reference_id | String | required, trim | — |
| transfer_id | String | — | `null` |
| created_at | Date | via `timestamps: { createdAt: 'created_at', updatedAt: false }` | now |

Indexes:
- Unique compound: `{ account_id: 1, reference_id: 1 }` — prevents duplicate transactions per account.
- `{ account_id: 1, created_at: -1 }` — supports history queries.

Immutability: `pre` hooks on `updateOne`, `updateMany`, `findOneAndUpdate`, `replaceOne`, `deleteOne`, `deleteMany`, `findOneAndDelete` all `throw new AppError(403, 'TRANSACTION_IMMUTABLE')` (no-callback hook style, required by the installed Mongoose 9.x — see bug fix #1 below). A `pre('save')` hook rejects any save where `!this.isNew` with the same error. Transactions can only ever be created, never modified or deleted.

`toJSON` transform mirrors Account's (`id`, drop `_id`/`__v`).

## 5. Endpoints

### `GET /health`
No input. Response: `{ "status": "ok" }`.

### `POST /api/accounts`
Body: `{ "name": string (1-100 chars) }` — strict (no extra fields).

Success (201):
```json
{ "success": true, "data": { "id": "...", "name": "Alice", "balance": 0, "created_at": "..." } }
```
Errors: `400 VALIDATION_ERROR`.

### `GET /api/accounts`
Query: `page` (default 1), `limit` (default 10, max 100). Sorted `created_at` desc.

Success (200):
```json
{ "success": true, "data": { "items": [ { "id": "...", "name": "Alice", "balance": 500, "created_at": "..." } ], "pagination": { "page": 1, "limit": 10, "total_records": 23, "total_pages": 3 } } }
```
Errors: `400 VALIDATION_ERROR`.

### `GET /api/accounts/:id/balance`
Params: `id` (ObjectId).

Success (200):
```json
{ "success": true, "data": { "account_id": "...", "name": "Alice", "balance": 500, "created_at": "..." } }
```
Errors: `400 VALIDATION_ERROR` (bad id), `404 ACCOUNT_NOT_FOUND`.

### `POST /api/accounts/:id/transactions`
Params: `id` (ObjectId). Body (strict): `{ type: "credit"|"debit", amount: positive int, reference_id: string(1-100), description?: string(≤255) }`.

Success (201):
```json
{ "success": true, "data": { "transaction": { "id": "...", "account_id": "...", "type": "credit", "amount": 500, "description": "", "reference_id": "ref1", "transfer_id": null, "created_at": "..." }, "balance": 500 } }
```
Errors: `400 VALIDATION_ERROR`, `404 ACCOUNT_NOT_FOUND`, `409 DUPLICATE_TRANSACTION` (includes `data`: the existing transaction), `422 INSUFFICIENT_BALANCE`.

### `GET /api/accounts/:id/transactions`
Params: `id` (ObjectId). Query: `type?`, `page` (default 1), `limit` (default 10, max 100).

Success (200):
```json
{ "success": true, "data": { "transactions": [ ... ], "pagination": { "page": 1, "limit": 10, "total_records": 23, "total_pages": 3 } } }
```
Errors: `400 VALIDATION_ERROR`, `404 ACCOUNT_NOT_FOUND`.

### `POST /api/transfers`
Body (strict): `{ from_account_id, to_account_id (both ObjectId, must differ), amount: positive int, reference_id: string(1-100), description?: string(≤255) }`.

Success (201):
```json
{ "success": true, "data": { "transfer_id": "uuid", "amount": 500, "from": { "account_id": "...", "balance": 0 }, "to": { "account_id": "...", "balance": 1000 }, "transactions": [ debitDoc, creditDoc ] } }
```
Errors: `400 VALIDATION_ERROR` (incl. same-account transfer), `404 ACCOUNT_NOT_FOUND`, `409 DUPLICATE_TRANSACTION` (with `data`), `422 INSUFFICIENT_BALANCE`.

No `PUT`/`PATCH`/`DELETE` routes exist for transactions (immutability is enforced at both the route and schema level).

## 6. Core Logic

### Create transaction (`transaction.service.js: createTransaction`)
1. Open a Mongoose session and run `session.withTransaction(...)` so every step is atomic.
2. Load the account by id (with session); missing → `404 ACCOUNT_NOT_FOUND`.
3. Look up an existing transaction with the same `account_id` + `reference_id`; found → `409 DUPLICATE_TRANSACTION` with the existing doc as `data` (idempotency guard).
4. Apply the balance change atomically in the same update that checks sufficiency:
   - `credit`: `$inc: { balance: amount }`, unconditional.
   - `debit`: `$inc: { balance: -amount }` guarded by `balance: { $gte: amount }` in the filter — if no document matches (insufficient funds), the update returns `null` → `422 INSUFFICIENT_BALANCE`.
5. Create the `Transaction` document (array form, required for session use).
6. If the insert races past the duplicate check and hits the unique index (`11000`), re-fetch the now-existing transaction and throw the same `409 DUPLICATE_TRANSACTION`.
7. Any thrown error aborts `withTransaction`, rolling back the balance update and any partial writes. `session.endSession()` always runs in `finally`.
8. Returns `{ transaction, balance: updatedAccount.balance }`.

### History (`transaction.service.js: getHistory`)
1. Verify the account exists (404 otherwise).
2. Build `filter = { account_id }`, adding `type` if supplied.
3. Run `find(filter).sort({ created_at: -1, _id: -1 }).skip((page-1)*limit).limit(limit)` and `countDocuments(filter)` in parallel.
4. Pagination math: `total_pages = Math.ceil(total_records / limit)`.

### Transfer (`transfer.service.js: transfer`)
1. Session + `withTransaction` wraps the whole operation.
2. Both `from` and `to` accounts are fetched sequentially (a single Mongo session allows only one in-flight operation — see bug fix #2 below); either missing → `404 ACCOUNT_NOT_FOUND` (message names source or destination).
3. Duplicate check: any transaction with this `reference_id` on *either* account (`account_id: { $in: [from, to] }`) → `409 DUPLICATE_TRANSACTION` with existing doc.
4. Debit source atomically with the same balance-guarded `findOneAndUpdate` pattern as above; no match → `422 INSUFFICIENT_BALANCE`.
5. Credit destination unconditionally.
6. Insert both ledger rows (`debit` on source, `credit` on destination) in one `Transaction.create([...], { session, ordered: true })` call, sharing the same `reference_id` and a freshly generated `transfer_id` (`crypto.randomUUID()`). Default descriptions: `"Transfer to <to>"` / `"Transfer from <from>"` when none given.
7. A `11000` on the insert re-fetches the existing transaction and throws the same `409 DUPLICATE_TRANSACTION`.
8. Any error rolls back both balance changes via `withTransaction`. Returns `{ transfer_id, amount, from: {account_id, balance}, to: {account_id, balance}, transactions }`.

## 7. Error Codes

| Code | Status | When |
|---|---|---|
| VALIDATION_ERROR | 400 | Zod schema failure (body/params/query), including strict-mode extra fields and same-account transfer |
| INVALID_ID | 400 | Mongoose `CastError` (malformed id reaching the DB layer) |
| INVALID_JSON | 400 | Malformed JSON request body (`SyntaxError`, `entity.parse.failed`) |
| ROUTE_NOT_FOUND | 404 | No route matches the request |
| ACCOUNT_NOT_FOUND | 404 | Account id doesn't exist (balance, transaction create/history, transfer source/destination) |
| TRANSACTION_IMMUTABLE | 403 | Any update/delete/replace attempted on a `Transaction` document |
| DUPLICATE_TRANSACTION | 409 | A transaction with the same `account_id` + `reference_id` already exists (pre-check or unique-index race) |
| DUPLICATE | 409 | Generic Mongo `11000` not otherwise handled |
| INSUFFICIENT_BALANCE | 422 | Debit/transfer would take balance below 0 |
| INTERNAL_ERROR | 500 | Unhandled exception (logged via `console.error`) |

## 8. Data Integrity Guarantees

- **Atomicity**: every multi-document write (`createTransaction`, `transfer`) runs inside `mongoose.startSession()` + `session.withTransaction(...)`, so the account balance update(s) and the transaction insert(s) commit or roll back together (`src/services/transaction.service.js`, `src/services/transfer.service.js`).
- **Balance consistency**: debits never go negative because the decrement and the `balance: { $gte: amount }` check happen in the same atomic `findOneAndUpdate` call — no separate read-then-write race is possible (`transaction.service.js: createTransaction`, `transfer.service.js: transfer`).
- **Uniqueness / idempotency**: the compound unique index `{ account_id: 1, reference_id: 1 }` on `Transaction` (`src/models/Transaction.js`) is backed by an explicit pre-check plus a catch on Mongo error `11000` in both services, so concurrent duplicate requests still resolve to one `409 DUPLICATE_TRANSACTION`.
- **Immutability**: `Transaction`'s `pre` hooks on every update/delete/replace operation and on non-new `save` (`src/models/Transaction.js`) make the ledger append-only at the schema level, independent of which route or service calls it.
- **Money as integers**: `amount`/`balance` custom validators (`Number.isInteger`) plus Zod's `.int()` on all amount inputs prevent fractional-paise values from entering the system.

### Bugs found & fixed

1. **`src/models/Transaction.js`** — immutability `pre` hooks originally used the legacy callback signature (`function (next) { next(err) }`). The installed Mongoose version (9.x) invokes hooks without a `next` argument, so `next` was `undefined` and every blocked write threw `TypeError: next is not a function` instead of the intended `403 TRANSACTION_IMMUTABLE`. Fixed by throwing the `AppError` directly from a `next`-less hook.
2. **`src/services/transfer.service.js`** — the source and destination account lookups originally ran concurrently via `Promise.all` using the same MongoDB session. A single session can only have one operation in flight, causing `MongoServerError: Only servers in a sharded cluster can start a new transaction at the active transaction number`. Fixed by awaiting the two lookups sequentially.
3. Replaced the deprecated `{ new: true }` option on `findOneAndUpdate` calls with `{ returnDocument: 'after' }` in `transaction.service.js` and `transfer.service.js`.

## 9. Frontend (`client/`)

A Vite + React (JS) SPA, separate from the backend, consuming the API over a dev-server proxy (`/api` → `http://localhost:5000`, no CORS changes needed). Styled with Tailwind v4 (`@tailwindcss/vite`), dark theme only, routed with `react-router-dom`.

### Pages
| Route | Purpose |
|---|---|
| `/` | Create account form + paginated accounts table (`GET /api/accounts`) |
| `/accounts/:id` | Account header (balance, created_at, copy id), credit/debit transaction form, filterable/paginated transaction history (state kept in URL search params `type`/`page`/`limit`) |
| `/transfer` | Transfer form between two accounts (From/To selects, swap, amount/description/reference_id), result card with both new balances + `transfer_id`; accepts `?from=<id>` to pre-select the source account |

### Components (`client/src/components/`)
`Button`, `Input`, `Card`, `Alert` (error/success, shows backend `code` + `message` + field `details`), `Pagination` (Prev/Next + "Page X of Y · Z records"), `Navbar`.

### Data flow
- `client/src/lib/api.js` — fetch wrapper hitting `/api/*`; on a non-OK response, throws `ApiError { status, code, message, details }` parsed from the backend's `{ success:false, error }` shape.
- `client/src/lib/money.js` — `toPaise(rupees)` (`Math.round(Number(rupees) * 100)`) and `formatINR(paise)`. The UI always inputs/displays rupees and sends paise to the API.
- Every page keeps backend errors in an `Alert`, shows loading/disabled states on submit, and re-fetches the relevant list after a successful mutation.

## 10. Testing

`tests/api.test.js` is an automated test suite (Node built-ins only: `node:test`, `node:assert`, global `fetch`) covering accounts, transactions, history, immutability, transfers, concurrent requests, and error shape — 32 tests. Run with `npm run test:api` (requires the server already running and reachable at `BASE_URL`, default `http://localhost:5000`). Each run creates its own accounts/reference IDs so it's safely re-runnable. See [TEST_REPORT.md](./TEST_REPORT.md) for the latest results.

## 11. Phase Status

| Phase | Scope | Status |
|---|---|---|
| P1 | Project scaffold, Express app, health check, DB connection | Done |
| P2 | AppError, validate middleware, errorHandler, 404 handler | Done |
| P3 | Account & Transaction models, indexes, immutability | Done |
| P4 | Account create + balance endpoints | Done |
| P5 | Transaction create + history endpoints | Done |
| P6 | Account-to-account transfer endpoint | Done |
| P7 | API documentation: `src/docs/openapi.js` (full OpenAPI 3.0 spec object), Swagger UI mounted at `/api-docs`, README.md | Done |
| — | Automated API test suite (`tests/api.test.js`, `npm run test:api`) + bug fixes found during testing | Done |
| U1 | `GET /api/accounts` list endpoint; frontend scaffold (Vite + React + Tailwind v4 + react-router), proxy, lib/api.js, lib/money.js, reusable components, placeholder pages | Done |
| U2 | Account detail page: header, credit/debit transaction form, filterable/paginated history | Done |
| U3 | Transfer page, "Transfer from this account" link, docs updated | Done |
