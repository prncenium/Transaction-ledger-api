import Button from './Button.jsx';

export default function Pagination({ page, totalPages, totalRecords, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Prev
      </Button>
      <span className="text-sm text-gray-400">
        Page {page} of {totalPages}
        {typeof totalRecords === 'number' ? ` · ${totalRecords} records` : ''}
      </span>
      <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Next
      </Button>
    </div>
  );
}
