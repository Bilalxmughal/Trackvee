import { ReactNode } from 'react';

interface Props {
  label: string;
  children: ReactNode;
  error?: string;
}

const fieldStyle: React.CSSProperties = { marginBottom: 14 };
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 5 };
const errStyle: React.CSSProperties = { fontSize: 11, color: '#dc2626', marginTop: 3 };

export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid #e8e8e8',
  borderRadius: 5, fontSize: 13, color: '#111', outline: 'none', background: '#fff',
  boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s',
};

export const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: 'pointer',
};

export default function FormField({ label, children, error }: Props) {
  return (
    <div style={fieldStyle}>
      <label style={labelStyle}>{label}</label>
      {children}
      {error && <div style={errStyle}>{error}</div>}
    </div>
  );
}

export function FormActions({ onClose, loading, submitLabel = 'Save' }: { onClose: () => void; loading?: boolean; submitLabel?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid #f5f5f5' }}>
      <button type="button" onClick={onClose} style={{ padding: '7px 16px', border: '1px solid #e8e8e8', borderRadius: 8, fontSize: 12, color: '#555', background: '#fff', cursor: 'pointer' }}>
        Cancel
      </button>
      <button type="submit" disabled={loading} style={{ padding: '7px 20px', border: 'none', borderRadius: 8, fontSize: 12, color: '#fff', background: loading ? '#fca5a5' : '#dc2626', cursor: loading ? 'default' : 'pointer', fontWeight: 500 }}>
        {loading ? 'Saving…' : submitLabel}
      </button>
    </div>
  );
}
