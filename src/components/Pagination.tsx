type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
};

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <div className="pagination-bar">
      <div className="muted pagination-summary">
        {total === 0 ? "0 data" : `${start}-${end} dari ${total}`}
      </div>

      <div className="pagination-actions">
        {onPageSizeChange && (
          <select
            className="select pagination-size"
            value={pageSize}
            onChange={(event) =>
              onPageSizeChange(Number(event.target.value))
            }
            aria-label="Jumlah data per halaman"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / halaman
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          className="btn btn-secondary pagination-button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          Previous
        </button>
        <span className="pagination-page">
          {safePage} / {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-secondary pagination-button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
