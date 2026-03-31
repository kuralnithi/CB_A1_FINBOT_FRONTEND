'use client';

interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onChange: (page: number) => void;
}

/**
 * Reusable pagination control.
 */
export function Pagination({ total, page, pageSize, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1 py-3">
      <button
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        className="px-3 py-1 text-xs rounded-lg bg-dark-800 text-dark-400 hover:bg-dark-700 disabled:opacity-30"
      >
        ←
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1 text-xs rounded-lg ${
            p === page ? 'bg-blue-600 text-white' : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
          }`}
        >
          {p}
        </button>
      ))}
      <button
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        className="px-3 py-1 text-xs rounded-lg bg-dark-800 text-dark-400 hover:bg-dark-700 disabled:opacity-30"
      >
        →
      </button>
    </div>
  );
}
