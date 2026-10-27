import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api.js';
import { formatINR } from '../lib/money.js';
import Button from '../components/Button.jsx';
import Input from '../components/Input.jsx';
import Card from '../components/Card.jsx';
import Alert from '../components/Alert.jsx';
import Pagination from '../components/Pagination.jsx';

function shortId(id) {
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export default function AccountsPage() {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createSuccess, setCreateSuccess] = useState(null);

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  async function loadAccounts(targetPage = page) {
    setLoading(true);
    setListError(null);
    try {
      const data = await api.get(`/accounts?page=${targetPage}&limit=10`);
      setItems(data.items);
      setPage(data.pagination.page);
      setTotalPages(data.pagination.total_pages || 1);
    } catch (err) {
      setListError(err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Could not reach server' }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts(1);
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      const account = await api.post('/accounts', { name });
      setCreateSuccess(`Account "${account.name}" created.`);
      setName('');
      await loadAccounts(1);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Could not reach server' }));
    } finally {
      setCreating(false);
    }
  }

  async function copyId(id) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // clipboard unavailable, ignore
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h1 className="mb-4 text-lg font-semibold text-gray-100">Create account</h1>
        <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alice"
              maxLength={100}
              required
            />
          </div>
          <Button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create account'}
          </Button>
        </form>
        <div className="mt-3 flex flex-col gap-2">
          {createError && (
            <Alert type="error" code={createError.code}>
              {createError.message}
            </Alert>
          )}
          {createSuccess && <Alert type="success">{createSuccess}</Alert>}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-100">Accounts</h2>
        {listError && (
          <Alert type="error" code={listError.code}>
            {listError.message}
          </Alert>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Balance</th>
                <th className="py-2 pr-4">Created</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">
                    No accounts yet.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((acc) => (
                  <tr key={acc.id} className="border-b border-gray-900 text-gray-200">
                    <td className="py-2 pr-4">{acc.name}</td>
                    <td className="py-2 pr-4">
                      <button
                        onClick={() => copyId(acc.id)}
                        className="font-mono text-xs text-gray-400 hover:text-gray-200"
                        title={acc.id}
                      >
                        {shortId(acc.id)} {copiedId === acc.id ? '✓' : '⧉'}
                      </button>
                    </td>
                    <td className="py-2 pr-4">{formatINR(acc.balance)}</td>
                    <td className="py-2 pr-4 text-gray-400">{new Date(acc.created_at).toLocaleString()}</td>
                    <td className="py-2">
                      <Link to={`/accounts/${acc.id}`} className="text-indigo-400 hover:text-indigo-300">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <Pagination page={page} totalPages={totalPages} onPageChange={(p) => loadAccounts(p)} />
        </div>
      </Card>
    </div>
  );
}
