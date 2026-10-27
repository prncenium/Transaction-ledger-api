# LEARN.md — What Every File Does

A plain-English guide to every file in `src/` (backend) and `client/src/` (frontend). No jargon, no diagrams.

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
**What it's for:** A big description of every endpoint (requests, responses, errors) used to build the Swagger page at `/api-docs`. No functions — just data.

---

## Frontend (`client/src/`)

### `client/src/main.jsx`
**What it's for:** The very first file that runs — puts the app on the page and wraps it with the router.
No named functions, just a startup call. If something goes wrong: would only fail if the page's `#root` element were missing, which it isn't.

### `client/src/App.jsx`
**What it's for:** The app's overall layout — always shows the navbar, then shows one of the three pages depending on the URL.

- **App()** — Picks which page to show.
  - Gets: nothing (reads the URL). Gives back: the page layout.
  - If it goes wrong: a URL that matches none of the three routes shows an empty main area.

### `client/src/index.css`
**What it's for:** Base styling — turns on Tailwind and sets the dark background/text colors for the whole app. No functions.

### `client/src/lib/api.js`
**What it's for:** One helper for talking to the backend, and a standard error shape for its failures.

- **ApiError** (error type) — Represents a failed API call.
  - Gets: `{status, code, message, details}`. Gives back: an error object with those fields.
- **request(method, path, body)** (internal) — Sends one HTTP request to the backend and reads the JSON back.
  - Gets: HTTP method, URL path, optional body.
  - Gives back: the `data` part of a successful reply.
  - If it goes wrong: throws an `ApiError` built from the backend's error info.
- **api.get(path) / api.post(path, body)** — Shortcuts for GET/POST requests.
  - Gets/Gives back: same as `request`.

### `client/src/lib/money.js`
**What it's for:** Converts between rupees (what people type/see) and paise (what the API uses).

- **toPaise(rupees)** — Turns a rupee amount into whole paise.
  - Gets: a number or numeric string. Gives back: a whole number of paise.
  - If it goes wrong: a non-numeric input becomes `NaN` — the form is set up to stop that before it happens.
- **formatINR(paise)** — Turns paise into a readable ₹ amount.
  - Gets: whole number of paise. Gives back: a string like `"₹12.50"`.

### `client/src/components/Button.jsx`
**What it's for:** A reusable styled button.

- **Button({children, variant, className, ...props})** — Renders a button styled as primary/secondary/ghost.
  - Gets: the button's content, a style choice, extra classes, normal button props.
  - Gives back: the styled button.

### `client/src/components/Input.jsx`
**What it's for:** A reusable styled input box with an optional label.

- **Input({label, className, ...props})** — Renders a labeled input.
  - Gets: optional label, extra classes, normal input props.
  - Gives back: the labeled input.

### `client/src/components/Card.jsx`
**What it's for:** A reusable rounded box used to group content.

- **Card({children, className})** — Wraps content in a styled box.
  - Gets: content and extra classes. Gives back: the wrapped box.

### `client/src/components/Alert.jsx`
**What it's for:** A colored message box for errors or success messages.

- **Alert({type, code, children})** — Shows a red (error) or green (success) box; shows nothing if there's no message.
  - Gets: type, optional error code, the message.
  - Gives back: the message box, or nothing if there's no message to show.

### `client/src/components/Navbar.jsx`
**What it's for:** The top bar with links to Accounts and Transfer.

- **Navbar()** — Shows the title and the two nav links, highlighting the active one.
  - Gets: nothing (reads the current URL). Gives back: the nav bar.

### `client/src/components/Pagination.jsx`
**What it's for:** Reusable Prev/Next page controls.

- **Pagination({page, totalPages, totalRecords, onPageChange})** — Shows Prev/Next buttons and the current page info.
  - Gets: current page, total pages, optional record count, a function to call with the new page.
  - Gives back: the controls, or nothing if there's only one page.

### `client/src/pages/AccountsPage.jsx`
**What it's for:** The home page — create an account, see a paginated list of all accounts.

- **loadAccounts(targetPage)** — Fetches one page of accounts.
  - Gets: which page (defaults to current). Gives back: nothing — updates the page directly.
  - If it goes wrong: stores the error so an Alert shows it.
- **handleCreate(e)** — Submits the "create account" form, then reloads page 1.
  - Gets: the form submit event. Gives back: nothing.
  - If it goes wrong: shows the backend's error and keeps the typed name.
- **copyId(id)** — Copies an account id to the clipboard, shows a checkmark briefly.
  - Gets: the account id. Gives back: nothing.
  - If it goes wrong: silently does nothing if the clipboard isn't available.

### `client/src/pages/AccountDetailPage.jsx`
**What it's for:** One account's balance, a credit/debit form, and its filterable, paginated history.

- **loadAccount()** — Fetches this account's balance/details.
  - Gets: nothing (uses the id from the URL). Gives back: nothing — updates state.
  - If it goes wrong: if the account doesn't exist or the id is invalid, shows just the error and a back link.
- **loadHistory(targetPage, targetType, targetLimit)** — Fetches one page of this account's history.
  - Gets: page, type filter, page size. Gives back: nothing — updates state.
  - If it goes wrong: stores the error so an Alert shows it.
- **updateParams(next)** — Updates the page's URL so filters/page/limit survive a refresh.
  - Gets: which URL values to change. Gives back: nothing.
- **handleFilterChange / handleLimitChange / handlePageChange** — Shortcuts that call `updateParams` for the type filter, page size, or page number (filter/limit changes also jump back to page 1).
- **copyFullId()** — Copies the full account id, shows a checkmark briefly.
  - If it goes wrong: silently does nothing if the clipboard fails.
- **handleSubmit(e)** — Submits the credit/debit form: sends it to the API, updates the shown balance, clears the form, reloads history.
  - Gets: the form submit event. Gives back: nothing.
  - If it goes wrong: shows the backend's error (code, message, and field details) and keeps the typed values.

### `client/src/pages/TransferPage.jsx`
**What it's for:** Pick two accounts and move money between them; shows the result afterward.

- **loadAccounts()** — Fetches the account list for the From/To dropdowns.
  - Gets: nothing. Gives back: nothing — updates state.
  - If it goes wrong: stores the error so an Alert shows it.
- **handleSwap()** — Swaps the From and To selections.
  - Gets: nothing. Gives back: nothing.
- **handleSubmit(e)** — Submits the transfer: sends it to the API, shows the result (new balances + transfer id), clears the form, refreshes the account list.
  - Gets: the form submit event. Gives back: nothing.
  - If it goes wrong: shows the backend's error (code, message, field details) and keeps the typed values. The button is also disabled upfront if From/To are empty or the same.
