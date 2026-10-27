import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const FAKE_ID = '651f0c2e8a1b2c3d4e5f6789';

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, opts);
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

const createAccount = (name) => api('POST', '/api/accounts', { name });
const listAccounts = (qs = '') => api('GET', `/api/accounts${qs}`);
const getBalance = (id) => api('GET', `/api/accounts/${id}/balance`);
const createTx = (id, body) => api('POST', `/api/accounts/${id}/transactions`, body);
const getHistory = (id, qs = '') => api('GET', `/api/accounts/${id}/transactions${qs}`);
const transfer = (body) => api('POST', '/api/transfers', body);

function assertErrorShape(json) {
  assert.equal(json.success, false);
  assert.ok(json.error);
  assert.equal(typeof json.error.code, 'string');
  assert.equal(typeof json.error.message, 'string');
}

describe('Accounts', () => {
  test('create account returns 201 with balance 0, id, created_at', async () => {
    const { status, json } = await createAccount(uid('Alice'));
    assert.equal(status, 201);
    assert.equal(json.data.balance, 0);
    assert.ok(json.data.id);
    assert.ok(json.data.created_at);
  });

  test('create account without name returns 400', async () => {
    const { status, json } = await api('POST', '/api/accounts', {});
    assert.equal(status, 400);
    assertErrorShape(json);
  });

  test('create account with empty/whitespace name returns 400', async () => {
    assert.equal((await createAccount('')).status, 400);
    assert.equal((await createAccount('   ')).status, 400);
  });

  test('create account with balance in body returns 400', async () => {
    const { status } = await api('POST', '/api/accounts', { name: uid('Bal'), balance: 500 });
    assert.equal(status, 400);
  });

  test('get balance for existing account returns 200', async () => {
    const { json: created } = await createAccount(uid('Bob'));
    const { status, json } = await getBalance(created.data.id);
    assert.equal(status, 200);
    assert.equal(json.data.balance, 0);
  });

  test('get balance with invalid id returns 400', async () => {
    assert.equal((await getBalance('not-an-objectid')).status, 400);
  });

  test('get balance for non-existent account returns 404', async () => {
    const { status, json } = await getBalance(FAKE_ID);
    assert.equal(status, 404);
    assertErrorShape(json);
  });

  test('list accounts returns 200 with items and pagination', async () => {
    await createAccount(uid('ListMe'));
    const { status, json } = await listAccounts('?page=1&limit=5');
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.data.items));
    assert.equal(json.data.pagination.page, 1);
    assert.equal(json.data.pagination.limit, 5);
    assert.ok(json.data.pagination.total_records >= 1);
  });

  test('list accounts with invalid page returns 400', async () => {
    const { status } = await listAccounts('?page=0');
    assert.equal(status, 400);
  });
});

describe('Transactions', () => {
  let accountId;

  before(async () => {
    const { json } = await createAccount(uid('TxAcct'));
    accountId = json.data.id;
  });

  test('credit 100, credit 50, debit 30, debit 20 results in balance 100', async () => {
    await createTx(accountId, { type: 'credit', amount: 100, reference_id: uid('r') });
    await createTx(accountId, { type: 'credit', amount: 50, reference_id: uid('r') });
    await createTx(accountId, { type: 'debit', amount: 30, reference_id: uid('r') });
    const { json } = await createTx(accountId, { type: 'debit', amount: 20, reference_id: uid('r') });
    assert.equal(json.data.balance, 100);
  });

  test('debit more than balance returns 422 and balance unchanged', async () => {
    const before1 = await getBalance(accountId);
    const { status } = await createTx(accountId, { type: 'debit', amount: 999999, reference_id: uid('r') });
    assert.equal(status, 422);
    const after = await getBalance(accountId);
    assert.equal(after.json.data.balance, before1.json.data.balance);
  });

  test('duplicate reference_id on same account returns 409 and balance unchanged', async () => {
    const ref = uid('dup');
    await createTx(accountId, { type: 'credit', amount: 10, reference_id: ref });
    const before1 = await getBalance(accountId);
    const { status, json } = await createTx(accountId, { type: 'credit', amount: 10, reference_id: ref });
    assert.equal(status, 409);
    assert.equal(json.data.reference_id, ref);
    const after = await getBalance(accountId);
    assert.equal(after.json.data.balance, before1.json.data.balance);
  });

  test('same reference_id on different account succeeds', async () => {
    const ref = uid('shared');
    const { json: acct2 } = await createAccount(uid('TxAcct2'));
    const r1 = await createTx(accountId, { type: 'credit', amount: 10, reference_id: ref });
    const r2 = await createTx(acct2.data.id, { type: 'credit', amount: 10, reference_id: ref });
    assert.equal(r1.status, 201);
    assert.equal(r2.status, 201);
  });

  test('invalid amounts (0, -5, 10.5, "10") return 400', async () => {
    for (const amount of [0, -5, 10.5, '10']) {
      const { status } = await createTx(accountId, { type: 'credit', amount, reference_id: uid('r') });
      assert.equal(status, 400, `amount ${amount} should be 400`);
    }
  });

  test('invalid type returns 400', async () => {
    const { status } = await createTx(accountId, { type: 'abc', amount: 10, reference_id: uid('r') });
    assert.equal(status, 400);
  });

  test('missing reference_id returns 400', async () => {
    const { status } = await createTx(accountId, { type: 'credit', amount: 10 });
    assert.equal(status, 400);
  });

  test('transaction on non-existent account returns 404', async () => {
    const { status } = await createTx(FAKE_ID, { type: 'credit', amount: 10, reference_id: uid('r') });
    assert.equal(status, 404);
  });

  test('invalid JSON body returns 400', async () => {
    const res = await fetch(`${BASE_URL}/api/accounts/${accountId}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assertErrorShape(json);
  });
});

describe('History', () => {
  let accountId;

  before(async () => {
    const { json } = await createAccount(uid('HistAcct'));
    accountId = json.data.id;
    await createTx(accountId, { type: 'credit', amount: 100, reference_id: uid('h') });
    await createTx(accountId, { type: 'credit', amount: 50, reference_id: uid('h') });
    await createTx(accountId, { type: 'debit', amount: 10, reference_id: uid('h') });
    await createTx(accountId, { type: 'debit', amount: 5, reference_id: uid('h') });
  });

  test('all 4 returned latest-first by created_at', async () => {
    const { json } = await getHistory(accountId);
    assert.equal(json.data.transactions.length, 4);
    const dates = json.data.transactions.map((t) => new Date(t.created_at).getTime());
    for (let i = 1; i < dates.length; i++) {
      assert.ok(dates[i - 1] >= dates[i]);
    }
  });

  test('type=debit returns only debits', async () => {
    const { json } = await getHistory(accountId, '?type=debit');
    assert.ok(json.data.transactions.length > 0);
    assert.ok(json.data.transactions.every((t) => t.type === 'debit'));
  });

  test('type=credit returns only credits', async () => {
    const { json } = await getHistory(accountId, '?type=credit');
    assert.ok(json.data.transactions.length > 0);
    assert.ok(json.data.transactions.every((t) => t.type === 'credit'));
  });

  test('page=1&limit=2 returns correct pagination', async () => {
    const { json } = await getHistory(accountId, '?page=1&limit=2');
    assert.equal(json.data.transactions.length, 2);
    assert.equal(json.data.pagination.page, 1);
    assert.equal(json.data.pagination.limit, 2);
    assert.equal(json.data.pagination.total_records, 4);
    assert.equal(json.data.pagination.total_pages, 2);
  });

  test('page=2 returns remaining records', async () => {
    const { json } = await getHistory(accountId, '?page=2&limit=2');
    assert.equal(json.data.transactions.length, 2);
    assert.equal(json.data.pagination.page, 2);
  });

  test('page=0, limit=0, limit=500, type=xyz return 400', async () => {
    for (const qs of ['?page=0', '?limit=0', '?limit=500', '?type=xyz']) {
      const { status } = await getHistory(accountId, qs);
      assert.equal(status, 400, `qs ${qs} should be 400`);
    }
  });

  test('history for non-existent account returns 404', async () => {
    const { status } = await getHistory(FAKE_ID);
    assert.equal(status, 404);
  });
});

describe('Immutability', () => {
  test('PUT, PATCH, DELETE on a transaction path return 404', async () => {
    const path = `/api/accounts/${FAKE_ID}/transactions/${FAKE_ID}`;
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      const { status } = await api(method, path);
      assert.equal(status, 404, `${method} should be 404`);
    }
  });
});

describe('Transfer', () => {
  test('A to B 30 results in correct balances and 2 transactions sharing transfer_id', async () => {
    const { json: a } = await createAccount(uid('TA'));
    const { json: b } = await createAccount(uid('TB'));
    await createTx(a.data.id, { type: 'credit', amount: 100, reference_id: uid('seed') });
    const { status, json } = await transfer({
      from_account_id: a.data.id,
      to_account_id: b.data.id,
      amount: 30,
      reference_id: uid('tr'),
    });
    assert.equal(status, 201);
    assert.equal(json.data.from.balance, 70);
    assert.equal(json.data.to.balance, 30);
    assert.equal(json.data.transactions.length, 2);
    assert.equal(json.data.transactions[0].transfer_id, json.data.transactions[1].transfer_id);
  });

  test('insufficient balance returns 422, both accounts unchanged', async () => {
    const { json: a } = await createAccount(uid('TA2'));
    const { json: b } = await createAccount(uid('TB2'));
    const beforeA = await getBalance(a.data.id);
    const beforeB = await getBalance(b.data.id);
    const { status } = await transfer({
      from_account_id: a.data.id,
      to_account_id: b.data.id,
      amount: 100,
      reference_id: uid('tr'),
    });
    assert.equal(status, 422);
    const afterA = await getBalance(a.data.id);
    const afterB = await getBalance(b.data.id);
    assert.equal(afterA.json.data.balance, beforeA.json.data.balance);
    assert.equal(afterB.json.data.balance, beforeB.json.data.balance);
  });

  test('transfer to same account returns 400', async () => {
    const { json: a } = await createAccount(uid('TA3'));
    const { status } = await transfer({
      from_account_id: a.data.id,
      to_account_id: a.data.id,
      amount: 10,
      reference_id: uid('tr'),
    });
    assert.equal(status, 400);
  });

  test('non-existent destination returns 404, source unchanged', async () => {
    const { json: a } = await createAccount(uid('TA4'));
    await createTx(a.data.id, { type: 'credit', amount: 50, reference_id: uid('seed') });
    const before1 = await getBalance(a.data.id);
    const { status } = await transfer({
      from_account_id: a.data.id,
      to_account_id: FAKE_ID,
      amount: 10,
      reference_id: uid('tr'),
    });
    assert.equal(status, 404);
    const after = await getBalance(a.data.id);
    assert.equal(after.json.data.balance, before1.json.data.balance);
  });

  test('duplicate reference_id on transfer returns 409', async () => {
    const { json: a } = await createAccount(uid('TA5'));
    const { json: b } = await createAccount(uid('TB5'));
    await createTx(a.data.id, { type: 'credit', amount: 50, reference_id: uid('seed') });
    const ref = uid('trdup');
    const r1 = await transfer({ from_account_id: a.data.id, to_account_id: b.data.id, amount: 10, reference_id: ref });
    assert.equal(r1.status, 201);
    const r2 = await transfer({ from_account_id: a.data.id, to_account_id: b.data.id, amount: 10, reference_id: ref });
    assert.equal(r2.status, 409);
  });
});

describe('Concurrency', () => {
  test('5 parallel debits of 30 on balance 100 result in exactly 3 successes, final balance 10', async () => {
    const { json: a } = await createAccount(uid('Conc'));
    await createTx(a.data.id, { type: 'credit', amount: 100, reference_id: uid('seed') });
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        createTx(a.data.id, { type: 'debit', amount: 30, reference_id: uid(`cd${i}`) })
      )
    );
    const succeeded = results.filter((r) => r.status === 201).length;
    assert.equal(succeeded, 3);
    const { json } = await getBalance(a.data.id);
    assert.equal(json.data.balance, 10);
  });

  test('5 parallel requests with same reference_id result in exactly 1 success, rest 409', async () => {
    const { json: a } = await createAccount(uid('Conc2'));
    const ref = uid('samerefconc');
    const results = await Promise.all(
      Array.from({ length: 5 }, () => createTx(a.data.id, { type: 'credit', amount: 10, reference_id: ref }))
    );
    const succeeded = results.filter((r) => r.status === 201).length;
    const conflicted = results.filter((r) => r.status === 409).length;
    assert.equal(succeeded, 1);
    assert.equal(conflicted, 4);
  });
});

describe('Error shape', () => {
  test('every error response has success:false, error.code, error.message', async () => {
    const cases = [
      () => api('POST', '/api/accounts', {}),
      () => getBalance('bad-id'),
      () => getBalance(FAKE_ID),
      () => transfer({ from_account_id: FAKE_ID, to_account_id: FAKE_ID, amount: 1, reference_id: uid('x') }),
    ];
    for (const fn of cases) {
      const { json } = await fn();
      assertErrorShape(json);
    }
  });
});
