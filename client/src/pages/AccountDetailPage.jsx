import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api.js';
import { toPaise, formatINR } from '../lib/money.js';
import Button from '../components/Button.jsx';
import Input from '../components/Input.jsx';
import Card from '../components/Card.jsx';
import Alert from '../components/Alert.jsx';
import Pagination from '../components/Pagination.jsx';

const LIMIT_OPTIONS = [5, 10, 20];
const TYPE_TABS = [
  { value: '', label: 'All' },
  { value: 'credit', label: 'Credit' },
  { value: 'debit', label: 'Debit' },
];

function toApiError(err) {
  return err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Could not reach server' });
}

export default function AccountDetailPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const type = searchParams.get('type') || '';
  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 10;

  const [account, setAccount] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [txType, setTxType] = useState('credit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [referenceId, setReferenceId] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  const [history, setHistory] = useState({ transactions: [], pagination: { page: 1, limit, total_records: 0, total_pages: 1 } });
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(null);
  const [copied, setCopied] = useState(false);

  const loadAccount = useCallback(async () => {
    setLoadingAccount(true);
    setLoadError(null);
    try {
      const data = await api.get(`/accounts/${id}/balance`);
      setAccount(data);
    } catch (err) {
      setLoadError(toApiError(err));
    } finally {
      setLoadingAccount(false);
    }
  }, [id]);

  const loadHistory = useCallback(
    async (targetPage = page, targetType = type, targetLimit = limit) => {
      setLoadingHistory(true);
      setHistoryError(null);
      try {
        const qs = new URLSearchParams({ page: String(targetPage), limit: String(targetLimit) });
        if (targetType) qs.set('type', targetType);
        const data = await api.get(`/accounts/${id}/transactions?${qs.toString()}`);
        setHistory(data);
      } catch (err) {
        setHistoryError(toApiError(err));
      } finally {
        setLoadingHistory(false);
      }
    },
    [id, page, type, limit]
  );

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    loadHistory(page, type, limit);
  }, [loadHistory, page, type, limit]);

  function updateParams(next) {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });
    setSearchParams(params);
  }

  function handleFilterChange(nextType) {
    updateParams({ type: nextType, page: 1 });
  }

  function handleLimitChange(nextLimit) {
    updateParams({ limit: nextLimit, page: 1 });
  }

  function handlePageChange(nextPage) {
    updateParams({ page: nextPage });
  }

  async function copyFullId() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable, ignore
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const data = await api.post(`/accounts/${id}/transactions`, {
        type: txType,
        amount: toPaise(amount),
        description: description || undefined,
        reference_id: referenceId,
      });
      setSubmitSuccess(`${txType === 'credit' ? 'Credited' : 'Debited'} ${formatINR(toPaise(amount))}`);
      setAccount((prev) => (prev ? { ...prev, balance: data.balance } : prev));
      setReferenceId(crypto.randomUUID());
      setAmount('');
      setDescription('');
      updateParams({ page: 1 });
      loadHistory(1, type, limit);
    } catch (err) {
      setSubmitError(toApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
        <Alert type="error" code={loadError.code}>
          {loadError.message}
        </Alert>
        <Link to="/" className="text-sm text-indigo-400 hover:text-indigo-300">
          ← Back to accounts
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <Link to="/" className="text-sm text-indigo-400 hover:text-indigo-300">
          ← Back to accounts
        </Link>
        {loadingAccount && <p className="mt-3 text-sm text-gray-500">Loading…</p>}
        {!loadingAccount && account && (
          <div className="mt-3 flex flex-col gap-2">
            <h1 className="text-xl font-semibold text-gray-100">{account.name}</h1>
            <button
              onClick={copyFullId}
              className="w-fit font-mono text-xs text-gray-400 hover:text-gray-200"
              title="Copy account id"
            >
              {account.account_id} {copied ? '✓ copied' : '⧉'}
            </button>
            <div className="mt-2 text-4xl font-bold text-gray-50">{formatINR(account.balance)}</div>
            {account.created_at && (
              <p className="text-xs text-gray-500">Created {new Date(account.created_at).toLocaleString()}</p>
            )}
            <Link to={`/transfer?from=${id}`} className="mt-2 w-fit">
              <Button type="button" variant="secondary">
                Transfer from this account
              </Button>
            </Link>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-100">New transaction</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTxType('credit')}
              className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                txType === 'credit'
                  ? 'border-emerald-700 bg-emerald-900/40 text-emerald-300'
                  : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-gray-200'
              }`}
            >
              Credit
            </button>
            <button
              type="button"
              onClick={() => setTxType('debit')}
              className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                txType === 'debit'
                  ? 'border-red-700 bg-red-900/40 text-red-300'
                  : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-gray-200'
              }`}
            >
              Debit
            </button>
          </div>

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
            placeholder="e.g. Salary"
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

          <Button type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : `Submit ${txType === 'credit' ? 'credit' : 'debit'}`}
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
          {submitSuccess && <Alert type="success">{submitSuccess}</Alert>}
        </form>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-100">Transaction history</h2>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleFilterChange(tab.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  type === tab.value ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-400">
            Per page
            <select
              value={limit}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
              className="rounded-lg border border-gray-700 bg-gray-900 px-2 py-1 text-gray-100 outline-none focus:border-indigo-500"
            >
              {LIMIT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        </div>

        {historyError && (
          <Alert type="error" code={historyError.code}>
            {historyError.message}
          </Alert>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Description</th>
                <th className="py-2 pr-4">Reference</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistory && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!loadingHistory && history.transactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">
                    No transactions yet.
                  </td>
                </tr>
              )}
              {!loadingHistory &&
                history.transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-gray-900 align-top text-gray-200">
                    <td className="py-2 pr-4 text-gray-400">{new Date(tx.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          tx.type === 'credit' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'
                        }`}
                      >
                        {tx.type}
                      </span>
                      {tx.transfer_id && (
                        <span className="ml-1 rounded-full bg-indigo-900/50 px-2 py-0.5 text-xs font-medium text-indigo-300">
                          transfer
                        </span>
                      )}
                    </td>
                    <td className={`py-2 pr-4 font-medium ${tx.type === 'credit' ? 'text-emerald-300' : 'text-red-300'}`}>
                      {tx.type === 'credit' ? '+' : '-'}
                      {formatINR(tx.amount)}
                    </td>
                    <td className="py-2 pr-4 text-gray-300">{tx.description || '—'}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-500">{tx.reference_id}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <Pagination
            page={history.pagination.page}
            totalPages={history.pagination.total_pages}
            totalRecords={history.pagination.total_records}
            onPageChange={handlePageChange}
          />
        </div>
      </Card>
    </div>
  );
}
