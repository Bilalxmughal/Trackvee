interface Props {
  title: string;
  count?: number;
  action?: React.ReactNode;
}

export default function PageHeader({ title, count, action }: Props) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '20px 24px 16px',
      borderBottom: '1px solid #ececec',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h1 style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: 0 }}>{title}</h1>
        {count !== undefined && (
          <span style={{ fontSize: 12, color: '#bbb' }}>{count}</span>
        )}
      </div>
      {action}
    </div>
  );
}
