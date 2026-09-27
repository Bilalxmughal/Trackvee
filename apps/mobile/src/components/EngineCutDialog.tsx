import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import api from '../lib/api';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  imei: string;
  plate: string;
  immobilized: boolean;
  onClose: () => void;
  onSuccess: (immobilized: boolean) => void;
}

export function EngineCutDialog({ visible, imei, plate, immobilized, onClose, onSuccess }: Props) {
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setDigits(''); setError(''); }, [visible, imei]);
  const submit = async () => {
    if (busy) return;
    if (digits !== imei.slice(-4)) { setError('Incorrect digits — please try again'); return; }
    setBusy(true); setError('');
    try {
      const response = await api.post<{ sent: boolean }>(`/devices/${imei}/command`, { action: immobilized ? 'activate' : 'immobilize' });
      if (!response.data?.sent) throw new Error('Command not sent');
      onSuccess(!immobilized);
      onClose();
    } catch { setError('The command could not be sent. Please try again.'); }
    finally { setBusy(false); }
  };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.shade}><View style={styles.card}>
      <Text style={styles.title}>{immobilized ? 'Engine Restore Confirm' : 'Engine Cut Confirm'}</Text>
      <Text style={styles.body}>Vehicle: <Text style={styles.plate}>{plate}</Text>{'\n'}Enter the last 4 digits of the device IMEI to confirm:</Text>
      <TextInput autoFocus value={digits} onChangeText={value => { setDigits(value.replace(/\D/g, '').slice(0, 4)); setError(''); }} keyboardType="number-pad" maxLength={4} placeholder="_ _ _ _" placeholderTextColor={theme.muted} style={[styles.input, error ? styles.inputError : null]} accessibilityLabel="Last four IMEI digits" onSubmitEditing={() => void submit()} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Pressable onPress={onClose} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        <Pressable disabled={digits.length !== 4 || busy} onPress={() => void submit()} style={[styles.confirm, (digits.length !== 4 || busy) && styles.disabled]}>{busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmText}>Confirm</Text>}</Pressable>
      </View>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  shade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 320, backgroundColor: '#fff', borderRadius: 14, padding: 24 },
  title: { fontSize: 15, fontWeight: '700', color: theme.red },
  body: { marginTop: 6, marginBottom: 16, fontSize: 12.5, color: theme.secondary, lineHeight: 19 },
  plate: { fontWeight: '700', color: theme.ink },
  input: { height: 49, borderWidth: 1.5, borderColor: theme.border, borderRadius: 8, backgroundColor: '#f9fafb', color: theme.ink, textAlign: 'center', fontSize: 20, letterSpacing: 8 },
  inputError: { borderColor: theme.red }, error: { color: theme.red, fontSize: 11.5, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  cancel: { flex: 1, height: 39, borderWidth: 1, borderColor: theme.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: theme.secondary, fontSize: 13 },
  confirm: { flex: 1, height: 39, backgroundColor: theme.red, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  confirmText: { color: '#fff', fontSize: 13, fontWeight: '600' }, disabled: { opacity: 0.6 },
});
