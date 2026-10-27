export default function Alert({ type = 'error', code, children }) {
  if (!children) return null;
  const styles = {
    error: 'border-red-800 bg-red-950/50 text-red-300',
    success: 'border-emerald-800 bg-emerald-950/50 text-emerald-300',
  };
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${styles[type]}`}>
      {code && <span className="font-mono font-semibold">{code}: </span>}
      {children}
    </div>
  );
}
