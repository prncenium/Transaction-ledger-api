export default function Input({ label, className = '', ...props }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-gray-300">
      {label && <span>{label}</span>}
      <input
        className={`rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100 outline-none focus:border-indigo-500 ${className}`}
        {...props}
      />
    </label>
  );
}
