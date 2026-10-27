import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import AccountsPage from './pages/AccountsPage.jsx';
import AccountDetailPage from './pages/AccountDetailPage.jsx';
import TransferPage from './pages/TransferPage.jsx';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Routes>
          <Route path="/" element={<AccountsPage />} />
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
          <Route path="/transfer" element={<TransferPage />} />
        </Routes>
      </main>
    </div>
  );
}
