interface Props {
  title: string;
  subtitle?: string;
  count?: number;
  action?: React.ReactNode;
  children?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, count, action, children }: Props) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '20px 24px 16px',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h1 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{title}</h1>
          {count !== undefined && (
            <span style={{ fontSize: 12, color: '#bbb' }}>{count}</span>
          )}
        </div>
        {subtitle && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {action ?? children}
    </div>
  );
}
