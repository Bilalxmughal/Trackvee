import { useEffect, useState, type CSSProperties } from 'react';

export const TABLE_PAGE_SIZES = [25, 50, 75, 100] as const;

export function useTablePagination<T>(items: T[], resetKey: string) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState<number>(TABLE_PAGE_SIZES[0]);
  useEffect(() => { setPage(1); }, [resetKey]);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedItems = items.slice((safePage - 1) * pageSize, safePage * pageSize);
  const setPageSize = (size: number) => { setPageSizeState(size); setPage(1); };
  return { page: safePage, pageSize, setPage, setPageSize, pageCount, pagedItems };
}

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const buttonBase: CSSProperties = {
  minWidth: 30, height: 28, padding: '0 8px', border: '1px solid var(--input-border)',
  borderRadius: 4, background: 'var(--input-bg)', color: 'var(--input-color)',
  fontSize: 12, cursor: 'pointer',
};

export default function TablePagination({ page, pageSize, total, onPageChange, onPageSizeChange }: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.max(1, Math.min(page, pageCount));
  const firstPage = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
  const pages = Array.from({ length: Math.min(5, pageCount) }, (_, index) => firstPage + index);
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);

  const button = (label: string, targetPage: number, disabled = false, active = false) => (
    <button key={label} type="button" aria-label={label} aria-current={active ? 'page' : undefined}
      disabled={disabled} onClick={() => onPageChange(targetPage)}
      style={{ ...buttonBase, background: active ? '#dc2626' : 'var(--input-bg)', borderColor: active ? '#dc2626' : 'var(--input-border)', color: active ? '#fff' : 'var(--input-color)', opacity: disabled ? 0.45 : 1, cursor: disabled ? 'default' : 'pointer', fontWeight: active ? 600 : 400 }}>
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 20px', borderTop: '1px solid var(--border2)', color: 'var(--text-muted)', fontSize: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span>Showing {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}</span>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Rows
          <select value={pageSize} onChange={event => onPageSizeChange(Number(event.target.value))}
            style={{ height: 27, padding: '0 7px', border: '1px solid var(--input-border)', borderRadius: 4, background: 'var(--input-bg)', color: 'var(--input-color)', fontSize: 11 }}>
            {TABLE_PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {button('Prev', Math.max(1, currentPage - 1), currentPage <= 1)}
        {pages.map(number => button(String(number), number, false, number === currentPage))}
        {button('Next', Math.min(pageCount, currentPage + 1), currentPage >= pageCount)}
      </div>
    </div>
  );
}
