import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { TablerIcon } from '../src/components/TablerIcon';
import { useTheme } from '../src/hooks/useTheme';
import api from '../src/lib/api';

interface ContactSettings {
  whatsapp?: string;
  phone?: string;
  emailSales?: string;
  emailSupport?: string;
  address?: string;
  hours?: string;
  hoursSub?: string;
}

function normalisePhone(raw: string) {
  return raw.replace(/[\s\-().]/g, '');
}

export default function SupportScreen() {
  const t = useTheme();
  const [contact, setContact] = useState<ContactSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ContactSettings>('/site-settings/contact')
      .then(r => { if (r.data) setContact(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openWhatsApp = () => {
    if (!contact?.whatsapp) return;
    const num = normalisePhone(contact.whatsapp);
    Linking.openURL(`https://wa.me/${num}`).catch(() => {});
  };
  const openPhone = () => {
    if (!contact?.phone) return;
    Linking.openURL(`tel:${normalisePhone(contact.phone)}`).catch(() => {});
  };
  const openEmail = () => {
    if (!contact?.emailSupport) return;
    Linking.openURL(`mailto:${contact.emailSupport}`).catch(() => {});
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: t.border }]}>
        <Pressable onPress={() => router.back()} style={[styles.back, { backgroundColor: t.bg2 }]} hitSlop={10}>
          <TablerIcon name="arrow-left" size={18} color={t.ink} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: t.ink }]}>Support</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero */}
        <View style={[styles.heroCard, { backgroundColor: t.card }]}>
          <View style={[styles.heroIcon, { backgroundColor: t.red }]}>
            <TablerIcon name="headset" size={26} color="#fff" strokeWidth={1.6} />
          </View>
          <Text style={[styles.heroTitle, { color: t.ink }]}>We're here to help</Text>
          <Text style={[styles.heroSub, { color: t.secondary }]}>Reach out via WhatsApp, phone or email and our team will get back to you shortly.</Text>
        </View>

        {/* WhatsApp — primary CTA */}
        {contact?.whatsapp ? (
          <Pressable onPress={openWhatsApp} style={({ pressed }) => [styles.waCard, { opacity: pressed ? 0.88 : 1 }]}>
            <View style={styles.waLeft}>
              <View style={styles.waIconWrap}>
                <TablerIcon name="message-circle" size={24} color="#fff" strokeWidth={1.8} />
              </View>
              <View>
                <View style={styles.waRow}>
                  <Text style={styles.waLabel}>WhatsApp</Text>
                  <View style={styles.badge247}><Text style={styles.badge247Text}>24/7</Text></View>
                </View>
                <Text style={styles.waNumber}>{contact.whatsapp}</Text>
              </View>
            </View>
            <TablerIcon name="arrow-right" size={18} color="#fff" />
          </Pressable>
        ) : null}

        <Text style={[styles.sectionLabel, { color: t.secondary }]}>OTHER CHANNELS</Text>

        {(contact?.phone || contact?.emailSupport || contact?.hours || contact?.address) ? (
          <View style={[styles.channelCard, { backgroundColor: t.card }]}>
            {/* Phone */}
            {contact?.phone ? (
              <Pressable onPress={openPhone} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.bg2 : 'transparent' }]}>
                <View style={[styles.rowIcon, { backgroundColor: t.bg2 }]}>
                  <TablerIcon name="phone" size={18} color={t.red} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: t.ink }]}>Phone</Text>
                  <Text style={[styles.rowValue, { color: t.secondary }]}>{contact.phone}</Text>
                </View>
                <TablerIcon name="chevron-right" size={16} color={t.secondary} />
              </Pressable>
            ) : null}

            {contact?.phone && contact?.emailSupport ? <View style={[styles.rowDivider, { backgroundColor: t.border }]} /> : null}

            {/* Email */}
            {contact?.emailSupport ? (
              <Pressable onPress={openEmail} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.bg2 : 'transparent' }]}>
                <View style={[styles.rowIcon, { backgroundColor: t.bg2 }]}>
                  <TablerIcon name="mail" size={18} color={t.red} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: t.ink }]}>Email Support</Text>
                  <Text style={[styles.rowValue, { color: t.secondary }]}>{contact.emailSupport}</Text>
                </View>
                <TablerIcon name="chevron-right" size={16} color={t.secondary} />
              </Pressable>
            ) : null}

            {(contact?.phone || contact?.emailSupport) && contact?.hours ? <View style={[styles.rowDivider, { backgroundColor: t.border }]} /> : null}

            {/* Hours */}
            {contact?.hours ? (
              <View style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: t.bg2 }]}>
                  <TablerIcon name="clock" size={18} color={t.red} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: t.ink }]}>Business Hours</Text>
                  <Text style={[styles.rowValue, { color: t.secondary }]}>{contact.hours}</Text>
                  {contact.hoursSub ? <Text style={[styles.rowSub, { color: t.muted }]}>{contact.hoursSub}</Text> : null}
                </View>
              </View>
            ) : null}

            {(contact?.phone || contact?.emailSupport || contact?.hours) && contact?.address ? <View style={[styles.rowDivider, { backgroundColor: t.border }]} /> : null}

            {/* Address */}
            {contact?.address ? (
              <View style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: t.bg2 }]}>
                  <TablerIcon name="map-pin" size={18} color={t.red} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: t.ink }]}>Address</Text>
                  <Text style={[styles.rowValue, { color: t.secondary }]}>{contact.address}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator color={t.red} />
          </View>
        )}

        {!loading && !contact && (
          <Text style={[styles.empty, { color: t.muted }]}>Contact information not available.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const WA_GREEN = '#25D366';

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40, gap: 10 },

  heroCard: { borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 6, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  heroIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heroTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  heroSub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  waCard: { backgroundColor: WA_GREEN, borderRadius: 14, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  waLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  waIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  waRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  waLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  waNumber: { color: 'rgba(255,255,255,0.88)', fontSize: 13 },
  badge247: { backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badge247Text: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.7, marginTop: 8, marginBottom: 8 },

  channelCard: { borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 68 },
  rowStatic: {},
  rowIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 13, fontWeight: '600' },
  rowValue: { fontSize: 12, marginTop: 2 },
  rowSub: { fontSize: 11, marginTop: 2 },

  loader: { paddingTop: 30, alignItems: 'center' },
  empty: { textAlign: 'center', fontSize: 13, paddingTop: 30 },
});
