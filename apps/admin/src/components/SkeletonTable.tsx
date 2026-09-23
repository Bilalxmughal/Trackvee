const WIDTHS = ['28px', '72%', '58%', '64%', '48%', '60%', '44%', '68%', '52%', '44px'];

export default function SkeletonTable({ cols = 5, rows = 6 }: { cols?: number; rows?: number }) {
  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} style={{ padding: '10px 14px' }}>
                <span className="skeleton" style={{ height: 9, width: i === cols - 1 ? 36 : WIDTHS[i % WIDTHS.length] }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid var(--border2)', borderLeft: '3px solid #e5e7eb' }}>
              {Array.from({ length: cols }).map((_, ci) => (
                <td key={ci} style={{ padding: '10px 14px' }}>
                  <span className="skeleton" style={{ height: 12, width: ci === cols - 1 ? 44 : WIDTHS[(ri * 3 + ci) % WIDTHS.length] }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
