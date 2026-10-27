import { NavLink } from 'react-router-dom';

const linkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'}`;

export default function Navbar() {
  return (
    <header className="border-b border-gray-800">
      <nav className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3">
        <span className="mr-4 text-sm font-semibold text-gray-100">Transaction Ledger</span>
        <NavLink to="/" end className={linkClass}>
          Accounts
        </NavLink>
        <NavLink to="/transfer" className={linkClass}>
          Transfer
        </NavLink>
      </nav>
    </header>
  );
}
