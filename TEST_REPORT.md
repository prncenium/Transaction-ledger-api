# Test Report

**Date:** 2026-10-28
**Suite:** `tests/api.test.js` (`npm run test:api`)
**Total:** 34 | **Passed:** 34 | **Failed:** 0

## Results

| Area | Test | Expected | Result |
|---|---|---|---|
| Accounts | create account returns 201 with balance 0, id, created_at | 201, balance 0, id + created_at present | Pass |
| Accounts | create account without name | 400 | Pass |
| Accounts | create account with empty/whitespace name | 400 | Pass |
| Accounts | create account with balance in body | 400 (strict schema) | Pass |
| Accounts | get balance for existing account | 200 | Pass |
| Accounts | get balance with invalid id | 400 | Pass |
| Accounts | get balance for non-existent account | 404 | Pass |
| Accounts | list accounts | 200, items + pagination | Pass |
| Accounts | list accounts with invalid page | 400 | Pass |
| Transactions | credit 100, credit 50, debit 30, debit 20 | balance 100 | Pass |
| Transactions | debit more than balance | 422, balance unchanged | Pass |
| Transactions | duplicate reference_id same account | 409, balance unchanged | Pass |
| Transactions | same reference_id different account | 201 both | Pass |
| Transactions | amount 0, -5, 10.5, "10" | 400 each | Pass |
| Transactions | type "abc" | 400 | Pass |
| Transactions | missing reference_id | 400 | Pass |
| Transactions | non-existent account | 404 | Pass |
| Transactions | invalid JSON body | 400 | Pass |
| History | all 4 latest-first by created_at | descending order | Pass |
| History | type=debit | only debits | Pass |
| History | type=credit | only credits | Pass |
| History | page=1&limit=2 | correct page/limit/total_records/total_pages | Pass |
| History | page=2 | remaining records | Pass |
| History | page=0, limit=0, limit=500, type=xyz | 400 each | Pass |
| History | non-existent account | 404 | Pass |
| Immutability | PUT/PATCH/DELETE on transaction path | 404 | Pass |
| Transfer | A→B 30 | both balances correct, 2 tx sharing transfer_id | Pass |
| Transfer | insufficient balance | 422, both unchanged | Pass |
| Transfer | same account | 400 | Pass |
| Transfer | non-existent destination | 404, source unchanged | Pass |
| Transfer | duplicate reference_id | 409 | Pass |
| Concurrency | 5 parallel debits of 30 on balance 100 | exactly 3 succeed, final balance 10 | Pass |
| Concurrency | 5 parallel requests, same reference_id | exactly 1 success, rest 409 | Pass |
| Error shape | every error has success:false + error.code + error.message | all cases | Pass |

## Findings

Bugs found and fixed during manual end-to-end verification, before this automated suite existed (no failures surfaced by the automated suite itself — it passes clean against the already-patched code):

1. **`src/models/Transaction.js`** — immutability `pre` hooks used the legacy callback signature (`function (next) { next(err) }`). The installed Mongoose version (9.x) invokes hooks without a `next` argument, so `next` was `undefined` and every `save`/update/delete threw `TypeError: next is not a function` instead of the intended `403 TRANSACTION_IMMUTABLE`. Fixed by throwing the `AppError` directly from a `next`-less hook.
2. **`src/services/transfer.service.js`** — the source and destination account lookups ran concurrently via `Promise.all` using the same MongoDB session. A single session can only have one operation in flight, causing `MongoServerError: Only servers in a sharded cluster can start a new transaction at the active transaction number`. Fixed by awaiting the two lookups sequentially.
3. Replaced the deprecated `{ new: true }` option on `findOneAndUpdate` calls with `{ returnDocument: 'after' }` in `transaction.service.js` and `transfer.service.js` (deprecation warning only, not a correctness bug).

No new bugs were found as a result of this automated test run — all 34 cases passed on the first run against the already-patched code.
