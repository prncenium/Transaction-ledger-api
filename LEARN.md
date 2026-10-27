# LEARN.md — What Every File Does

A plain-English guide to every file in `src/` (backend). No jargon, no diagrams.

---

## Backend (`src/`)

### `src/server.js`
**What it's for:** The starting point. Connects to the database, then starts the web server.

- **start()** — Connects to MongoDB, then makes the server listen for requests.
  - Gets: nothing.
  - Gives back: nothing (just gets things running).
  - If it goes wrong: the database connection step handles its own failure (see `db.js`) and stops the program.

### `src/app.js`
**What it's for:** Builds the whole Express app — turns on CORS, JSON parsing, all the routes, the docs page, and the error handler, in the right order.

- **health handler** (`GET /health`) — Replies "ok" to prove the server is alive.
  - Gets: a request. Gives back: `{status: "ok"}`.
  - If it goes wrong: can't really fail.
- **404 handler** — Runs for any URL that didn't match a real route.
  - Gets: a request. Gives back: nothing directly — hands a "404 ROUTE_NOT_FOUND" error to the error handler.

### `src/config/db.js`
**What it's for:** Connects to MongoDB and makes sure the database's indexes match what the code expects, before the app starts.

- **connectDB()** — Connects using `MONGO_URI`, then syncs Account and Transaction indexes.
  - Gets: nothing (reads `MONGO_URI` from the environment).
  - Gives back: nothing — just finishes when ready.
  - If it goes wrong: logs the error and shuts the whole program down, so it never runs without a database.

### `src/utils/AppError.js`
**What it's for:** A custom "something went wrong" error shape used everywhere in the backend.

- **AppError(statusCode, code, message, details, data)** — Builds an error carrying an HTTP status, a short code (like `"ACCOUNT_NOT_FOUND"`), a message, optional per-field details, and optional extra data.
  - Gets: status number, code string, message (optional), details list (optional), data (optional).
  - Gives back: an error object with those fields attached.
  - If it goes wrong: this itself can't fail — it's used to describe failures that happen elsewhere.

### `src/utils/objectId.js`
**What it's for:** A reusable rule that checks a string looks like a real MongoDB id.

- **objectId** (a rule, not something you call) — Checks a string is a valid Mongo id.
  - Gets: a string. Gives back: the same string if it's valid.
  - If it goes wrong: fails with "Invalid ObjectId", which turns into a 400 VALIDATION_ERROR.

### `src/middlewares/validate.js`
**What it's for:** Checks incoming requests against rules before letting them reach real logic.

- **validate({body, params, query})** — Builds a checkpoint that validates the named parts of a request.
  - Gets: which parts to check and what rules to use for each.
  - Gives back: a function Express runs on every matching request.
  - If it goes wrong: stops the request and raises a 400 VALIDATION_ERROR listing every bad field.
- **parse(schema, data)** (internal helper) — Runs one rule-check on one piece of data.
  - Gets: a rule and the data. Gives back: the cleaned data if valid.
  - If it goes wrong: throws the VALIDATION_ERROR described above.

### `src/middlewares/errorHandler.js`
**What it's for:** The one place that turns any error, from anywhere, into a consistent JSON reply.

- **errorHandler(err, req, res, next)** — Looks at what kind of error happened and sends the matching status code and `{success:false, error:{...}}` body.
  - Gets: the error plus the usual request/response objects.
  - Gives back: nothing to code — it writes the HTTP response directly.
  - If it goes wrong (an error type it doesn't recognize): replies 500 INTERNAL_ERROR and logs the real error so a developer can see it.

### `src/models/Account.js`
**What it's for:** Describes what an "Account" record looks like and its rules (name, balance).

- **toJSON transform** — Cleans up an account before it's sent out: turns Mongo's `_id` into `id`, removes `_id`/`__v`.
  - Gets: the raw database record. Gives back: the cleaned-up version the API returns.
  - If it goes wrong: nothing to fail — it's a simple rename.

### `src/models/Transaction.js`
**What it's for:** Describes a "Transaction" (ledger entry) and makes sure it can never be changed or deleted once created.

- **toJSON transform** — Same idea as Account's: `_id` → `id`, drops `_id`/`__v`.
- **blockImmutableWrite()** — Runs automatically before any update/replace/delete attempt on a transaction.
  - Gets: nothing. Gives back: nothing — it throws instead.
  - If it goes wrong (this is its whole job): always throws a 403 TRANSACTION_IMMUTABLE error, so the change never happens.
- **pre-save guard** — Runs automatically before saving.
  - Gets: nothing. Gives back: nothing if this is a brand-new transaction (lets it save).
  - If it goes wrong: if someone tries to re-save an existing transaction, throws 403 TRANSACTION_IMMUTABLE.

### `src/validators/account.validator.js`
**What it's for:** Rules for account requests (create, look up by id, list).

- **createAccountSchema** — `name` must be 1–100 characters; no other fields allowed.
- **accountIdParamSchema** — `id` must be a valid Mongo id.
- **listAccountsQuerySchema** — `page` (whole number, ≥1, default 1), `limit` (whole number, 1–100, default 10).
- If any rule is broken: 400 VALIDATION_ERROR.

### `src/validators/transaction.validator.js`
**What it's for:** Rules for creating a transaction and reading transaction history.

- **createTransactionSchema** — `type` must be `"credit"` or `"debit"`, `amount` must be a whole positive number, `reference_id` 1–100 characters, `description` optional up to 255 characters; no extra fields.
- **historyQuerySchema** — `type` optional, `page` default 1, `limit` default 10 (max 100).
- If any rule is broken: 400 VALIDATION_ERROR.

### `src/validators/transfer.validator.js`
**What it's for:** Rules for transferring money between two accounts.

- **transferSchema** — `from_account_id` and `to_account_id` must be valid Mongo ids and must be different, `amount` a whole positive number, `reference_id` 1–100 characters, `description` optional.
- If any rule is broken: 400 VALIDATION_ERROR (same-account transfer says "Cannot transfer to same account").

### `src/services/account.service.js`
**What it's for:** The real logic for accounts — create, list, read balance.

- **createAccount(name)** — Makes a new account starting at balance 0.
  - Gets: name. Gives back: the new account.
  - If it goes wrong: a database problem bubbles up as an error.
- **listAccounts({page, limit})** — Fetches one page of accounts, newest first, plus the total count.
  - Gets: page, limit. Gives back: `{items, pagination}`.
  - If it goes wrong: a database problem bubbles up as an error.
- **getBalance(id)** — Looks up one account's balance.
  - Gets: account id. Gives back: `{account_id, name, balance, created_at}`.
  - If it goes wrong: no account with that id → 404 ACCOUNT_NOT_FOUND.

### `src/services/transaction.service.js`
**What it's for:** The core money logic for one account — safely credit/debit it, and read its history.

- **createTransaction(accountId, {type, amount, reference_id, description})** — Adds or removes money from one account and records it, all as one all-or-nothing step.
  - Gets: account id, type, amount, reference_id, description.
  - Gives back: `{transaction, balance}` — the new record and the new balance.
  - If it goes wrong: account missing → 404 ACCOUNT_NOT_FOUND; this `reference_id` already used on this account → 409 DUPLICATE_TRANSACTION (includes the existing one); debit bigger than balance → 422 INSUFFICIENT_BALANCE; a rare timing clash → still ends as 409 DUPLICATE_TRANSACTION.
- **getHistory(accountId, {type, page, limit})** — Fetches one page of past transactions, newest first, optionally filtered by type.
  - Gets: account id, optional type, page, limit.
  - Gives back: `{transactions, pagination}`.
  - If it goes wrong: account missing → 404 ACCOUNT_NOT_FOUND.

### `src/services/transfer.service.js`
**What it's for:** Moves money from one account to another safely, recording both sides.

- **transfer({from_account_id, to_account_id, amount, reference_id, description})** — Checks both accounts exist and this transfer isn't a repeat, takes money from the source (only if there's enough), gives it to the destination, and records one debit + one credit linked by a shared transfer id — all as one all-or-nothing step.
  - Gets: source id, destination id, amount, reference_id, optional description.
  - Gives back: `{transfer_id, amount, from:{...}, to:{...}, transactions}`.
  - If it goes wrong: either account missing → 404 ACCOUNT_NOT_FOUND (says which one); `reference_id` already used on either account → 409 DUPLICATE_TRANSACTION; not enough money in the source → 422 INSUFFICIENT_BALANCE; a rare timing clash → still ends as 409 DUPLICATE_TRANSACTION.

### `src/controllers/account.controller.js`
**What it's for:** Connects account web requests to the account logic, and sends the reply.

- **create(req, res, next)** — Reads `name` from the request, creates the account, replies 201.
- **list(req, res, next)** — Reads page/limit, fetches the list, replies 200.
- **balance(req, res, next)** — Reads the account id, fetches the balance, replies 200.
- All three: if the logic throws, the error is passed on to the error handler instead of crashing.

### `src/controllers/transaction.controller.js`
**What it's for:** Connects transaction web requests to the transaction logic.

- **create(req, res, next)** — Reads account id + body, creates the transaction, replies 201.
- **history(req, res, next)** — Reads account id + filters, fetches history, replies 200.
- Both: errors are passed on, not crashed on.

### `src/controllers/transfer.controller.js`
**What it's for:** Connects transfer web requests to the transfer logic.

- **create(req, res, next)** — Reads the transfer details from the body, performs the transfer, replies 201.
- If it goes wrong: the error is passed on.

### `src/routes/account.routes.js`
**What it's for:** Maps account URLs to their checks and controller functions; also plugs in the per-account transaction routes.
No functions of its own — just wiring (`POST /`, `GET /`, `GET /:id/balance`, and `/:id/transactions` handed off to `transaction.routes.js`).

### `src/routes/transaction.routes.js`
**What it's for:** Maps "transactions for one account" URLs to their checks and controller functions.
No functions of its own — just wiring (`POST /`, `GET /`).

### `src/routes/transfer.routes.js`
**What it's for:** Maps the transfer URL to its check and controller function.
No functions of its own — just wiring (`POST /`).

### `src/docs/openapi.js`
**What it's for:** A write-up of every endpoint this API has — what to send it and what it replies with — used to build the interactive docs page.

Swagger is just a web page that reads this write-up and turns it into a form you can fill in and click to actually call the API, right from the browser — no separate tool needed. `app.js` serves that page at `/api-docs`.

- **openapiSpec** (data, not a function) — One big object listing every endpoint (`/health`, `/api/accounts`, `/api/accounts/:id/balance`, `/api/accounts/:id/transactions`, `/api/transfers`), what each one needs as input, what a success reply looks like, and which error codes it can return.
  - Gets: nothing — it's just written out by hand.
  - Gives back: nothing — Swagger UI reads it and draws the page.
  - If it goes wrong: nothing to fail — if an endpoint were missing from here, it just wouldn't show up on the docs page (the real endpoint would still work).

---

## How to test with Swagger

1. Start the server, then open `http://localhost:5000/api-docs` in a browser.
2. Find the endpoint you want (e.g. `POST /api/accounts`) and click it to expand it.
3. Click **Try it out**.
4. Edit the example request body (or fill in the fields) with your own values.
5. Click **Execute**.
6. Read the response: the status code (e.g. `201`, `404`) tells you if it worked, and the response body underneath shows the actual data or error returned.
