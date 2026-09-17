import Modal from './Modal';

interface Props {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}

export default function ConfirmDialog({ open, title, message, onConfirm, onClose, loading }: Props) {
  return (
    <Modal open={open} title={title} onClose={onClose} width={380}>
      <p style={{ fontSize: 13, color: '#555', margin: '0 0 20px', lineHeight: 1.6 }}>{message}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onClose} style={{ padding: '7px 16px', border: '1px solid #e8e8e8', borderRadius: 8, fontSize: 12, color: '#555', background: '#fff', cursor: 'pointer' }}>
          Cancel
        </button>
        <button onClick={onConfirm} disabled={loading} style={{ padding: '7px 16px', border: 'none', borderRadius: 8, fontSize: 12, color: '#fff', background: loading ? '#fca5a5' : '#dc2626', cursor: loading ? 'default' : 'pointer', fontWeight: 500 }}>
          {loading ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </Modal>
  );
}
