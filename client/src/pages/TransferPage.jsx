import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api.js';
import { toPaise, formatINR } from '../lib/money.js';
import Button from '../components/Button.jsx';
import Input from '../components/Input.jsx';
import Card from '../components/Card.jsx';
import Alert from '../components/Alert.jsx';

function toApiError(err) {
  return err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Could not reach server' });
}

export default function TransferPage() {
  const [searchParams] = useSearchParams();

  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [accountsError, setAccountsError] = useState(null);

  const [fromId, setFromId] = useState(searchParams.get('from') || '');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [referenceId, setReferenceId] = useState(() => crypto.randomUUID());

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);

  async function loadAccounts() {
    setLoadingAccounts(true);
    setAccountsError(null);
    try {
      const data = await api.get('/accounts?limit=100');
      setAccounts(data.items);
    } catch (err) {
      setAccountsError(toApiError(err));
    } finally {
      setLoadingAccounts(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  const fromAccount = accounts.find((a) => a.id === fromId);
  const sameAccount = fromId && toId && fromId === toId;
  const missing = !fromId || !toId;
  const disabled = submitting || missing || sameAccount;

  function handleSwap() {
    setFromId(toId);
    setToId(fromId);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (disabled) return;
    setSubmitting(true);
    setSubmitError(null);
    setResult(null);
    try {
      const data = await api.post('/transfers', {
        from_account_id: fromId,
        to_account_id: toId,
        amount: toPaise(amount),
        description: description || undefined,
        reference_id: referenceId,
      });
      setResult({ ...data, amountText: formatINR(toPaise(amount)) });
      setReferenceId(crypto.randomUUID());
      setAmount('');
      setDescription('');
      await loadAccounts();
    } catch (err) {
      setSubmitError(toApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!loadingAccounts && !accountsError && accounts.length < 2) {
    return (
      <Card>
        <h1 className="text-lg font-semibold text-gray-100">Transfer</h1>
        <p className="mt-2 text-sm text-gray-400">You need at least 2 accounts to make a transfer.</p>
        <Link to="/" className="mt-3 inline-block text-sm text-indigo-400 hover:text-indigo-300">
          ← Create an account
        </Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h1 className="mb-4 text-lg font-semibold text-gray-100">Transfer funds</h1>

        {accountsError && (
          <Alert type="error" code={accountsError.code}>
            {accountsError.message}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="flex flex-col gap-1 text-sm text-gray-300">
                <span>From</span>
                <select
                  value={fromId}
                  onChange={(e) => setFromId(e.target.value)}
                  className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100 outline-none focus:border-indigo-500"
                  required
                >
                  <option value="">Select account…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {formatINR(a.balance)}
                    </option>
                  ))}
                </select>
              </label>
              {fromAccount && (
                <p className="mt-1 text-xs text-gray-500">Current balance: {formatINR(fromAccount.balance)}</p>
              )}
            </div>

            <Button type="button" variant="secondary" onClick={handleSwap} className="sm:mb-0">
              ⇄ Swap
            </Button>

            <div className="flex-1">
              <label className="flex flex-col gap-1 text-sm text-gray-300">
                <span>To</span>
                <select
                  value={toId}
                  onChange={(e) => setToId(e.target.value)}
                  className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100 outline-none focus:border-indigo-500"
                  required
                >
                  <option value="">Select account…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {formatINR(a.balance)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {sameAccount && <p className="text-sm text-amber-400">From and To must be different accounts.</p>}

          <Input
            label="Amount (₹)"
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />

          <Input
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={255}
            placeholder="e.g. Rent"
          />

          <div className="flex flex-col gap-1 text-sm text-gray-300">
            <span>Reference ID</span>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-xs text-gray-100 outline-none focus:border-indigo-500"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                required
              />
              <Button type="button" variant="secondary" onClick={() => setReferenceId(crypto.randomUUID())}>
                New
              </Button>
            </div>
          </div>

          <Button type="submit" disabled={disabled}>
            {submitting ? 'Transferring…' : 'Transfer'}
          </Button>

          {submitError && (
            <Alert type="error" code={submitError.code}>
              <div className="flex flex-col gap-1">
                <span>{submitError.message}</span>
                {submitError.details?.length > 0 && (
                  <ul className="list-disc pl-4">
                    {submitError.details.map((d, i) => (
                      <li key={i}>
                        {d.field}: {d.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Alert>
          )}
        </form>
      </Card>

      {result && (
        <Card>
          <Alert type="success">
            Transferred {result.amountText} from {fromAccount?.name || 'account'} to{' '}
            {accounts.find((a) => a.id === result.to.account_id)?.name || 'account'}
          </Alert>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-800 p-3">
              <p className="text-xs text-gray-500">From — new balance</p>
              <p className="text-lg font-semibold text-gray-100">{formatINR(result.from.balance)}</p>
              <Link to={`/accounts/${result.from.account_id}`} className="text-xs text-indigo-400 hover:text-indigo-300">
                View account →
              </Link>
            </div>
            <div className="rounded-lg border border-gray-800 p-3">
              <p className="text-xs text-gray-500">To — new balance</p>
              <p className="text-lg font-semibold text-gray-100">{formatINR(result.to.balance)}</p>
              <Link to={`/accounts/${result.to.account_id}`} className="text-xs text-indigo-400 hover:text-indigo-300">
                View account →
              </Link>
            </div>
          </div>
          <p className="mt-3 font-mono text-xs text-gray-500">transfer_id: {result.transfer_id}</p>
        </Card>
      )}
    </div>
  );
}
