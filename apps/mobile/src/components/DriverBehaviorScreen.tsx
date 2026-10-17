import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import api from '../lib/api';
import { TablerIcon } from './TablerIcon';
import { usePortalPermissions } from '../auth/PortalPermissionsProvider';
import { useTheme } from '../hooks/useTheme';
import type { AppTheme } from '../theme';

type Tab = 'scores' | 'settings';
interface LeaderboardRow {
  scoreId: string; vehicleId: string; vehicleLicensePlate: string | null; vehicleName: string | null;
  vehicleMake: string | null; vehicleModel: string | null; score: number; date: string;
  harshBrakeCount: number; rapidAccelCount: number; sharpTurnCount: number; overspeedCount: number;
}
interface ScoreHistory {
  id: string; vehicleId: string; date: string; score: number; harshBrakeCount: number;
  rapidAccelCount: number; sharpTurnCount: number; overspeedCount: number;
}
interface FleetScoreTrendPoint { date: string; score: number | null; vehicleCount: number; }
interface DriverEvent {
  id: string; vehicleId: string; type: 'harsh_brake' | 'rapid_accel' | 'sharp_turn' | 'overspeed';
  severity: 'low' | 'medium' | 'high'; speedKmh: number; latitude: number | null; longitude: number | null; timestamp: string;
}
interface Settings {
  overspeedThreshold: number; harshBrakeDeceleration: number; rapidAccelThreshold: number;
  sharpTurnAngle: number; sharpTurnMinSpeed: number; deductionHarshBrake: number;
  deductionRapidAccel: number; deductionSharpTurn: number; deductionOverspeed: number;
}

const DEFAULT_SETTINGS: Settings = {
  overspeedThreshold: 100, harshBrakeDeceleration: 8, rapidAccelThreshold: 6,
  sharpTurnAngle: 45, sharpTurnMinSpeed: 20, deductionHarshBrake: 5,
  deductionRapidAccel: 3, deductionSharpTurn: 3, deductionOverspeed: 5,
};
const EVENT_META: Record<DriverEvent['type'], { label: string; icon: string }> = {
  harsh_brake: { label: 'Harsh Brake', icon: 'alert-triangle' },
  rapid_accel: { label: 'Rapid Acceleration', icon: 'gauge' },
  sharp_turn: { label: 'Sharp Turn', icon: 'rotate' },
  overspeed: { label: 'Overspeed', icon: 'arrow-right' },
};
const SCORE_FIELDS = [
  { key: 'harshBrakeCount', label: 'Harsh Brake', icon: 'alert-triangle' },
  { key: 'rapidAccelCount', label: 'Rapid Accel', icon: 'gauge' },
  { key: 'sharpTurnCount', label: 'Sharp Turn', icon: 'rotate' },
  { key: 'overspeedCount', label: 'Overspeed', icon: 'arrow-right' },
] as const;
const DETECTION_FIELDS = [
  { key: 'overspeedThreshold', label: 'Overspeed Threshold', unit: 'km/h' },
  { key: 'harshBrakeDeceleration', label: 'Harsh Brake Deceleration', unit: 'km/h/s' },
  { key: 'rapidAccelThreshold', label: 'Rapid Acceleration', unit: 'km/h/s' },
  { key: 'sharpTurnAngle', label: 'Sharp Turn Angle', unit: 'degrees' },
  { key: 'sharpTurnMinSpeed', label: 'Sharp Turn Min Speed', unit: 'km/h' },
] as const;
const DEDUCTION_FIELDS = [
  { key: 'deductionHarshBrake', label: 'Harsh Brake Deduction' },
  { key: 'deductionRapidAccel', label: 'Rapid Accel Deduction' },
  { key: 'deductionSharpTurn', label: 'Sharp Turn Deduction' },
  { key: 'deductionOverspeed', label: 'Overspeed Deduction' },
] as const;
const PKT_DATETIME = new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

function scoreColor(score: number) { return score >= 80 ? '#16a34a' : score >= 60 ? '#f59e0b' : '#dc2626'; }
function vehicleTitle(row: LeaderboardRow) { return row.vehicleLicensePlate || row.vehicleName || row.vehicleId.slice(0, 8); }
function vehicleSubtitle(row: LeaderboardRow) { return [row.vehicleMake, row.vehicleModel].filter(Boolean).join(' ') || 'Vehicle'; }

export default function DriverBehaviorScreen() {
  const t = useTheme();
  const s = useMemo(() => createStyles(t), [t]);
  const { canDo, loading: permissionsLoading } = usePortalPermissions();
  const canView = canDo('driver-behavior');
  const canEdit = canDo('driver-behavior', 'edit');
  const [tab, setTab] = useState<Tab>('scores');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [fleetTrend, setFleetTrend] = useState<FleetScoreTrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<LeaderboardRow | null>(null);
  const [scores, setScores] = useState<ScoreHistory[]>([]);
  const [events, setEvents] = useState<DriverEvent[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadLeaderboard = useCallback(async (showSpinner = true) => {
    if (showSpinner) setListLoading(true);
    setError('');
    setTrendLoading(true);
    const [leaderboardResult, trendResult] = await Promise.allSettled([
      api.get<LeaderboardRow[]>('/driver-behavior/leaderboard'),
      api.get<FleetScoreTrendPoint[]>('/driver-behavior/score-trend?days=30'),
    ]);
    if (leaderboardResult.status === 'fulfilled') {
      setRows(Array.isArray(leaderboardResult.value.data) ? leaderboardResult.value.data : []);
    } else {
      setError('Driver Behavior scores could not be loaded. Check your connection and try again.');
    }
    if (trendResult.status === 'fulfilled') setFleetTrend(Array.isArray(trendResult.value.data) ? trendResult.value.data : []);
    else setFleetTrend([]);
    setListLoading(false);
    setTrendLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => {
    if (!permissionsLoading && canView) void loadLeaderboard();
  }, [canView, loadLeaderboard, permissionsLoading]));

  useEffect(() => {
    if (!permissionsLoading && !canView) router.replace('/map');
  }, [canView, permissionsLoading]);

  useEffect(() => {
    if (tab !== 'settings' || !canEdit || settingsLoaded) return;
    let active = true;
    setSettingsLoading(true);
    setSettingsError('');
    api.get<Settings | null>('/driver-behavior/settings')
      .then(response => { if (active && response.data) setSettings({ ...DEFAULT_SETTINGS, ...response.data }); })
      .catch(() => { if (active) setSettingsError('Settings could not be loaded. Check your connection and try again.'); })
      .finally(() => { if (active) { setSettingsLoaded(true); setSettingsLoading(false); } });
    return () => { active = false; };
  }, [canEdit, settingsLoaded, tab]);

  const openVehicle = async (row: LeaderboardRow) => {
    setSelected(row);
    setDetailLoading(true);
    setDetailError('');
    setScores([]);
    setEvents([]);
    try {
      const [scoreResponse, eventResponse] = await Promise.all([
        api.get<ScoreHistory[]>(`/driver-behavior/vehicle/${row.vehicleId}/scores?days=30`),
        api.get<DriverEvent[]>(`/driver-behavior/vehicle/${row.vehicleId}/events`),
      ]);
      setScores(Array.isArray(scoreResponse.data) ? scoreResponse.data : []);
      setEvents(Array.isArray(eventResponse.data) ? eventResponse.data : []);
    } catch {
      setDetailError('Vehicle behavior details could not be loaded. Try again.');
    } finally {
      setDetailLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setSaved(false);
    setSettingsError('');
    try {
      await api.put('/driver-behavior/settings', settings);
      setSaved(true);
    } catch {
      setSettingsError('Settings could not be saved. Check your access and try again.');
    } finally {
      setSaving(false);
    }
  };

  if (permissionsLoading || (!canView && !permissionsLoading)) return <SafeAreaView style={s.center}><ActivityIndicator color={t.red}/></SafeAreaView>;

  if (selected) return <SafeAreaView style={s.screen} edges={['top']}>
    <View style={s.header}>
      <Pressable onPress={() => setSelected(null)} style={s.backButton} accessibilityLabel="Back to driver scores"><TablerIcon name="back" size={19} color={t.ink}/></Pressable>
      <View style={s.headerMain}><Text numberOfLines={1} style={s.title}>{vehicleTitle(selected)}</Text><Text numberOfLines={1} style={s.subtitle}>{vehicleSubtitle(selected)}</Text></View>
      <View style={s.scoreHeader}><Text style={[s.scoreValue, { color: scoreColor(Number(selected.score) || 0) }]}>{Math.round(Number(selected.score) || 0)}</Text><Text style={s.scoreCaption}>/ 100</Text></View>
    </View>
    {detailLoading ? <View style={s.center}><ActivityIndicator color={t.red}/><Text style={s.secondary}>Loading vehicle details…</Text></View> : <ScrollView contentContainerStyle={s.detailContent} refreshControl={<RefreshControl refreshing={false} onRefresh={() => void openVehicle(selected)} tintColor={t.red}/> }>
      {detailError ? <Pressable onPress={() => void openVehicle(selected)} style={s.errorBox}><Text style={s.errorText}>{detailError} Tap to retry.</Text></Pressable> : <>
        <Text style={s.sectionTitle}>EVENT SUMMARY</Text>
        <View style={s.summaryGrid}>{SCORE_FIELDS.map(field => {
          const value = Number(selected[field.key]) || 0;
          return <View key={field.key} style={s.summaryCell}><View style={s.summaryHeading}><TablerIcon name={field.icon} size={16} color={value ? t.red : t.muted}/><Text style={s.summaryLabel}>{field.label}</Text></View><Text style={[s.summaryValue, value > 0 && { color: t.red }]}>{value}</Text></View>;
        })}</View>
        <Text style={[s.sectionTitle, s.trendHeading]}>30-DAY SCORE TREND</Text>
        <ScoreTrend scores={scores}/>
        <View style={s.eventsHeading}><Text style={s.sectionTitle}>RECENT EVENTS</Text><Text style={s.secondary}>{events.length}</Text></View>
        {!events.length ? <View style={s.emptyEvents}><Text style={s.secondary}>No recent events recorded.</Text></View> : events.map(event => <EventRow key={event.id} event={event}/>) }
      </>}
    </ScrollView>}
  </SafeAreaView>;

  return <SafeAreaView style={s.screen} edges={['top']}>
    <View style={s.header}>
      <View style={s.headerMain}><Text style={s.title}>Driver Behavior</Text><Text style={s.subtitle}>Fleet safety scores and settings</Text></View>
      <Pressable onPress={() => { setRefreshing(true); void loadLeaderboard(false); }} accessibilityLabel="Refresh driver scores" style={s.refreshButton}><TablerIcon name="refresh" size={19} color={t.ink}/></Pressable>
    </View>
    {canEdit ? <View style={s.tabs}>{(['scores', 'settings'] as const).map(item => <Pressable key={item} onPress={() => setTab(item)} style={[s.tab, tab === item && s.tabSelected]}><Text style={[s.tabText, tab === item && s.tabTextSelected]}>{item === 'scores' ? 'Driver Scores' : 'Settings'}</Text></Pressable>)}</View> : null}
    {!canEdit || tab === 'scores' ? <>
      {listLoading ? <View style={s.center}><ActivityIndicator color={t.red}/><Text style={s.secondary}>Loading driver scores…</Text></View> : error ? <Pressable onPress={() => void loadLeaderboard()} style={s.errorBox}><Text style={s.errorText}>{error} Tap to retry.</Text></Pressable> : <ScrollView contentContainerStyle={s.listContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadLeaderboard(false); }} tintColor={t.red}/> }>
        <FleetScoreTrend points={fleetTrend} loading={trendLoading}/>
        <View style={s.listIntro}><Text style={s.sectionTitle}>LAST 7 DAYS</Text><Text style={s.secondary}>{rows.length} {rows.length === 1 ? 'vehicle' : 'vehicles'}</Text></View>
        {!rows.length ? <View style={s.emptyScores}><TablerIcon name="activity" size={26} color={t.muted}/><Text style={s.emptyTitle}>No driver scores yet</Text><Text style={s.secondary}>Scores appear after driving events are recorded.</Text></View> : rows.map((row, index) => <Pressable key={row.vehicleId} onPress={() => void openVehicle(row)} style={s.vehicleRow} accessibilityRole="button" accessibilityLabel={`View driver behavior for ${vehicleTitle(row)}`}>
          <Text style={s.rank}>{String(index + 1).padStart(2, '0')}</Text>
          <View style={s.vehicleCopy}><Text numberOfLines={1} style={s.vehicleTitle}>{vehicleTitle(row)}</Text><Text numberOfLines={1} style={s.vehicleSub}>{vehicleSubtitle(row)}</Text><Text style={s.eventCounts}>{Number(row.harshBrakeCount)||0} brake · {Number(row.rapidAccelCount)||0} accel · {Number(row.sharpTurnCount)||0} turn · {Number(row.overspeedCount)||0} speed</Text></View>
          <View style={s.scoreCol}><Text style={[s.rowScore, { color: scoreColor(Number(row.score)||0) }]}>{Math.round(Number(row.score)||0)}</Text><Text style={s.scoreCaption}>SCORE</Text></View>
          <TablerIcon name="forward" size={16} color={t.muted}/>
        </Pressable>)}
      </ScrollView>}
    </> : <ScrollView contentContainerStyle={s.settingsContent}>
      {settingsLoading ? <View style={s.center}><ActivityIndicator color={t.red}/><Text style={s.secondary}>Loading settings…</Text></View> : <>
        <SettingsSection title="DETECTION THRESHOLDS" fields={DETECTION_FIELDS} settings={settings} onChange={(key, value) => { setSettings(current => ({ ...current, [key]: value })); setSaved(false); }}/>
        <SettingsSection title="SCORE DEDUCTIONS · POINTS PER EVENT" fields={DEDUCTION_FIELDS} settings={settings} onChange={(key, value) => { setSettings(current => ({ ...current, [key]: value })); setSaved(false); }}/>
        {settingsError ? <Text style={s.errorText}>{settingsError}</Text> : null}
        <View style={s.saveRow}><Pressable onPress={() => void saveSettings()} disabled={saving} style={[s.saveButton, saving && s.disabled]}><Text style={s.saveText}>{saving ? 'Saving…' : saved ? 'Saved' : 'Save Settings'}</Text></Pressable></View>
      </>}
    </ScrollView>}
  </SafeAreaView>;
}

function FleetScoreTrend({ points, loading }: { points: FleetScoreTrendPoint[]; loading: boolean }) {
  const t = useTheme();
  const s = useMemo(() => createStyles(t), [t]);
  const [width, setWidth] = useState(320);
  const chartWidth = Math.max(width, 260), chartHeight = 72, padX = 4, padY = 8;
  const scores = points.map(point => point.score == null ? null : Number(point.score));
  const validScores = scores.filter((value): value is number => value != null && Number.isFinite(value));
  const latest = validScores.at(-1);
  const x = (index: number) => padX + index / Math.max(points.length - 1, 1) * (chartWidth - padX * 2);
  const y = (value: number) => padY + (100 - Math.max(0, Math.min(100, value))) / 100 * (chartHeight - padY * 2);
  let path = '';
  let segmentOpen = false;
  points.forEach((point, index) => {
    const value = point.score == null ? null : Number(point.score);
    if (value == null || !Number.isFinite(value)) { segmentOpen = false; return; }
    path += `${segmentOpen ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)} `;
    segmentOpen = true;
  });
  return <View style={s.fleetTrend} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <View style={s.fleetTrendHeader}><View><Text style={s.sectionTitle}>30-DAY FLEET SCORE</Text><Text style={s.fleetTrendCaption}>Average daily score across your vehicles</Text></View><Text style={[s.fleetTrendScore, latest == null && s.secondary, latest != null && { color: scoreColor(latest) }]}>{loading ? '—' : latest == null ? '—' : Math.round(latest)}</Text></View>
    {loading ? <View style={s.fleetTrendEmpty}><ActivityIndicator size="small" color={t.red}/></View> : latest == null ? <View style={s.fleetTrendEmpty}><Text style={s.secondary}>No score history available yet.</Text></View> : <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
      <Line x1={padX} x2={chartWidth-padX} y1={chartHeight-padY} y2={chartHeight-padY} stroke={t.border} strokeWidth={1}/>
      <Path d={path.trim()} fill="none" stroke={t.red} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
      {points.map((point, index) => point.score == null ? null : <Circle key={point.date} cx={x(index)} cy={y(Number(point.score))} r={index === points.length - 1 ? 3 : 1.8} fill={index === points.length - 1 ? scoreColor(Number(point.score)) : t.red}/>)}
      <SvgText x={padX} y={chartHeight-1} fill={t.muted} fontSize={8}>{points[0]?.date.slice(5)}</SvgText>
      <SvgText x={chartWidth-padX} y={chartHeight-1} fill={t.muted} fontSize={8} textAnchor="end">{points.at(-1)?.date.slice(5)}</SvgText>
    </Svg>}
  </View>;
}

function ScoreTrend({ scores }: { scores: ScoreHistory[] }) {
  const t = useTheme();
  const s = useMemo(() => createStyles(t), [t]);
  const [width, setWidth] = useState(320);
  const points = useMemo(() => [...scores].sort((a,b) => a.date.localeCompare(b.date)).slice(-30), [scores]);
  const chartHeight = 160, padX = 28, padTop = 12, padBottom = 24;
  const chartWidth = Math.max(width, 260), innerWidth = chartWidth - padX * 2, innerHeight = chartHeight - padTop - padBottom;
  const x = (index: number) => padX + index / Math.max(points.length - 1, 1) * innerWidth;
  const y = (score: number) => padTop + (100 - Math.max(0, Math.min(100, Number(score) || 0))) / 100 * innerHeight;
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.score).toFixed(1)}`).join(' ');
  return <View style={s.chartWrap} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {!points.length ? <View style={s.chartEmpty}><Text style={s.secondary}>No score history available.</Text></View> : <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
      {[0,25,50,75,100].map(value => <ReactFragment key={value} value={value} y={y(value)} width={chartWidth} padX={padX}/>)}
      <Path d={path} fill="none" stroke={t.red} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
      {points.map((point, index) => <Circle key={point.id} cx={x(index)} cy={y(point.score)} r={3} fill={scoreColor(Number(point.score)||0)}/>)}
      <SvgText x={padX} y={chartHeight - 5} fill={t.secondary} fontSize={9}>{points[0]?.date.slice(5)}</SvgText>
      <SvgText x={chartWidth-padX} y={chartHeight-5} fill={t.secondary} fontSize={9} textAnchor="end">{points.at(-1)?.date.slice(5)}</SvgText>
    </Svg>}
  </View>;
}

function ReactFragment({ value, y, width, padX }: { value: number; y: number; width: number; padX: number }) {
  const t = useTheme();
  return <><Line x1={padX} x2={width-padX} y1={y} y2={y} stroke={t.border} strokeWidth={1}/><SvgText x={padX-5} y={y+3} fill={t.muted} fontSize={8} textAnchor="end">{value}</SvgText></>;
}

function EventRow({ event }: { event: DriverEvent }) {
  const t = useTheme();
  const s = useMemo(() => createStyles(t), [t]);
  const meta = EVENT_META[event.type] ?? { label: event.type, icon: 'activity' };
  const color = event.severity === 'high' ? t.red : event.severity === 'medium' ? '#f59e0b' : t.secondary;
  const openMap = () => {
    if (event.latitude == null || event.longitude == null) return;
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`);
  };
  return <View style={s.eventRow}>
    <View style={s.eventIcon}><TablerIcon name={meta.icon} size={17} color={t.red}/></View>
    <View style={s.eventCopy}><Text style={s.eventTitle}>{meta.label}</Text><Text style={s.eventTime}>{PKT_DATETIME.format(new Date(event.timestamp))} PKT · {Math.round(Number(event.speedKmh)||0)} km/h</Text></View>
    <Text style={[s.severity, { color }]}>{event.severity[0]?.toUpperCase()}{event.severity.slice(1)}</Text>
    <Pressable onPress={openMap} disabled={event.latitude == null || event.longitude == null} style={s.mapAction} accessibilityLabel="Open event location in maps"><TablerIcon name="map-pin" size={17} color={event.latitude == null || event.longitude == null ? t.muted : t.red}/></Pressable>
  </View>;
}

function SettingsSection<T extends keyof Settings>({ title, fields, settings, onChange }: {
  title: string; fields: readonly { key: T; label: string; unit?: string }[]; settings: Settings; onChange: (key: T, value: number) => void;
}) {
  const t = useTheme();
  const s = useMemo(() => createStyles(t), [t]);
  return <View style={s.settingsSection}><Text style={s.sectionTitle}>{title}</Text>{fields.map(field => <View key={field.key} style={s.settingRow}>
    <View style={s.settingLabelWrap}><Text style={s.settingLabel}>{field.label}</Text>{field.unit ? <Text style={s.settingUnit}>{field.unit}</Text> : null}</View>
    <TextInput value={String(settings[field.key])} onChangeText={text => onChange(field.key, Number(text.replace(',', '.')) || 0)} keyboardType="decimal-pad" selectTextOnFocus style={s.settingInput} accessibilityLabel={`${field.label}${field.unit ? ` in ${field.unit}` : ''}`}/>
  </View>)}</View>;
}

function createStyles(t: AppTheme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: t.bg },
    header: { minHeight: 66, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: t.border },
    headerMain: { flex: 1, minWidth: 0 }, title: { color: t.ink, fontSize: 18, fontWeight: '700' }, subtitle: { color: t.secondary, fontSize: 11, marginTop: 3 },
    backButton: { width: 32, height: 42, justifyContent: 'center' }, refreshButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    scoreHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 2 }, scoreValue: { fontSize: 21, fontWeight: '700' }, scoreCaption: { color: t.muted, fontSize: 9 },
    tabs: { flexDirection: 'row', height: 43, borderBottomWidth: 1, borderColor: t.border }, tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderColor: 'transparent' }, tabSelected: { borderColor: t.red }, tabText: { color: t.secondary, fontSize: 12 }, tabTextSelected: { color: t.red, fontWeight: '700' },
    listContent: { paddingHorizontal: 14, paddingBottom: 30, flexGrow: 1 }, fleetTrend: { paddingTop: 13, paddingBottom: 7, borderBottomWidth: 1, borderColor: t.border }, fleetTrendHeader: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, fleetTrendCaption: { color: t.muted, fontSize: 9, marginTop: 3 }, fleetTrendScore: { fontSize: 21, fontWeight: '700' }, fleetTrendEmpty: { height: 72, alignItems: 'center', justifyContent: 'center' }, listIntro: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { color: t.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.55 },
    vehicleRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderColor: t.border }, rank: { width: 26, color: t.muted, fontSize: 11, fontVariant: ['tabular-nums'] }, vehicleCopy: { flex: 1, minWidth: 0 }, vehicleTitle: { color: t.ink, fontSize: 13, fontWeight: '700' }, vehicleSub: { color: t.secondary, fontSize: 10, marginTop: 2 }, eventCounts: { color: t.secondary, fontSize: 9, marginTop: 5 }, scoreCol: { minWidth: 42, alignItems: 'center' }, rowScore: { fontSize: 18, fontWeight: '700' },
    emptyScores: { flex: 1, minHeight: 230, alignItems: 'center', justifyContent: 'center', gap: 8 }, emptyTitle: { color: t.ink, fontSize: 14, fontWeight: '600' }, secondary: { color: t.secondary, fontSize: 11 }, errorBox: { margin: 15, paddingVertical: 16, borderBottomWidth: 1, borderColor: t.border }, errorText: { color: t.red, fontSize: 12 },
    detailContent: { paddingHorizontal: 14, paddingTop: 15, paddingBottom: 32 }, summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 9 }, summaryCell: { width: '50%', minHeight: 82, padding: 11, borderWidth: 0.5, borderColor: t.border }, summaryHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 }, summaryLabel: { color: t.secondary, fontSize: 10 }, summaryValue: { color: t.ink, fontSize: 22, fontWeight: '700', marginTop: 7 }, trendHeading: { marginTop: 23 }, chartWrap: { marginTop: 10, height: 164, borderBottomWidth: 1, borderColor: t.border }, chartEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' }, eventsHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 21, marginBottom: 7 }, emptyEvents: { minHeight: 64, justifyContent: 'center', borderBottomWidth: 1, borderColor: t.border }, eventRow: { minHeight: 63, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderColor: t.border }, eventIcon: { width: 24, alignItems: 'center' }, eventCopy: { flex: 1, minWidth: 0 }, eventTitle: { color: t.ink, fontSize: 11, fontWeight: '600' }, eventTime: { color: t.secondary, fontSize: 9, marginTop: 4 }, severity: { fontSize: 9, fontWeight: '600' }, mapAction: { width: 34, height: 42, alignItems: 'center', justifyContent: 'center' },
    settingsContent: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 30 }, settingsSection: { marginBottom: 23 }, settingRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderColor: t.border }, settingLabelWrap: { flex: 1 }, settingLabel: { color: t.ink, fontSize: 11 }, settingUnit: { color: t.secondary, fontSize: 9, marginTop: 3 }, settingInput: { width: 86, height: 38, borderBottomWidth: 1, borderColor: t.border, paddingHorizontal: 7, color: t.ink, fontSize: 12, textAlign: 'right' }, saveRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 5 }, saveButton: { minWidth: 130, minHeight: 43, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, backgroundColor: t.red, borderRadius: 7 }, saveText: { color: '#fff', fontSize: 12, fontWeight: '700' }, disabled: { opacity: 0.6 },
  });
}
