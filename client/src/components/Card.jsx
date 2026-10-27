export default function Card({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-gray-800 bg-gray-900/60 p-4 sm:p-6 ${className}`}>
      {children}
    </div>
  );
}
