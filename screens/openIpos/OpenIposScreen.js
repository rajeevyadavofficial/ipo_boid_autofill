// screens/openIpos/OpenIposScreen.js
// Live IPOs from MeroShare API — tab-filtered dark UI

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, ScrollView, StyleSheet, RefreshControl,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiBaseUrl } from '../../utils/config';
import { COLORS } from '../../utils/theme';
import { adToBs, nepaliMonths } from '../../utils/dateConverter';

// ── Helpers ───────────────────────────────────────────────────────────────────
const parseDateSafe = (d) => {
  if (!d) return new Date();

  // Custom parser for "May 12, 2026 5:00:00 PM" format
  try {
    const parts = String(d).match(/(\w+)\s+(\d+),\s+(\d+)\s+(\d+):(\d+):(\d+)\s+(AM|PM)/i);
    if (parts) {
      const [_, monthStr, day, year, h, m, s, ampm] = parts;
      const monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
      const month = monthNames.findIndex(mn => monthStr.toLowerCase().startsWith(mn));
      let hours = parseInt(h);
      if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
      if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
      return new Date(parseInt(year), month, parseInt(day), hours, parseInt(m), parseInt(s));
    }
  } catch (e) {}

  // Fallback to standard parsing, undoing any previous 'replace' hacks just in case
  const str = String(d).replace(' ', 'T');
  return new Date(str);
};

const fmtBS = (d) => {
  if (!d) return '—';
  const bs = adToBs(parseDateSafe(d));
  if (!bs) return '—';
  return `${bs.year} ${nepaliMonths[bs.month - 1].substring(0, 3)} ${bs.day.toString().padStart(2, '0')}`;
};

const fmtAD = (d) => {
  if (!d) return '—';
  return parseDateSafe(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const rupees = (n) => {
  if (!n) return '—';
  return `Rs. ${Number(n).toLocaleString('en-IN')}`;
};

// ── Group color map ───────────────────────────────────────────────────────────
const GROUP_COLORS = {
  'ordinary shares':         COLORS.accent,
  'right shares':            COLORS.accent,
  'further public offering': COLORS.accent,
  'close ended mutual fund': COLORS.accent,
  'open ended mutual fund':  COLORS.accent,
  'debenture':               COLORS.accent,
};
const DEFAULT_COLOR = COLORS.accent;

const groupColor = (title) => {
  const lower = (title || '').toLowerCase();
  for (const [key, color] of Object.entries(GROUP_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return DEFAULT_COLOR;
};

// ── Countdown ─────────────────────────────────────────────────────────────────
function Countdown({ closeDate }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const tick = () => {
      const parsedDate = parseDateSafe(closeDate);
      const diff = parsedDate - new Date();
      if (isNaN(diff) || diff <= 0) { setLabel('Closed'); return; }
      const d = Math.floor(diff / 864e5);
      const h = Math.floor((diff % 864e5) / 36e5);
      const m = Math.floor((diff % 36e5) / 6e4);
      const s = Math.floor((diff % 6e4) / 1e3);
      setLabel(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [closeDate]);
  return <Text style={ss.cdText}>{label} left</Text>;
}

// ── IPO Card ──────────────────────────────────────────────────────────────────
function IpoCard({ item, onApply }) {
  const [expanded, setExpanded] = useState(false);
  const groupName = item.shareGroupName || item.shareTypeName || 'IPO';
  const accent = groupColor(groupName);

  return (
    <TouchableOpacity
      style={[ss.card, { borderLeftColor: accent }]}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.85}
    >
      {/* Top row */}
      <View style={ss.cardTop}>
        <View style={ss.badgeRow}>
          {item.scrip && (
            <View style={ss.scripBadge}>
              <Text style={ss.scripText}>{item.scrip}</Text>
            </View>
          )}
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.mutedText} />
      </View>

      {/* Company name */}
      <Text style={ss.company} numberOfLines={2}>{item.companyName}</Text>

      {/* Countdown */}
      <View style={ss.timerRow}>
        <Ionicons name="time-outline" size={13} color={COLORS.accent} />
        <View style={ss.timerPill}>
          {item.issueCloseDate
            ? <Countdown closeDate={item.issueCloseDate} />
            : <Text style={ss.cdText}>—</Text>}
        </View>
        <Text style={ss.closeTxt}>Closes {fmtAD(item.issueCloseDate)}</Text>
      </View>

      {/* Expanded */}
      {expanded && (
        <View style={ss.expandBox}>
          <View style={ss.divider} />
          <Row label="Opens"   value={`${fmtAD(item.issueOpenDate)} (${fmtBS(item.issueOpenDate)} BS)`} />
          <Row label="Closes"  value={`${fmtAD(item.issueCloseDate)} (${fmtBS(item.issueCloseDate)} BS)`} />
          {item.listingDate  && <Row label="Listing"      value={`${fmtAD(item.listingDate)} (${fmtBS(item.listingDate)} BS)`} />}
          {item.totalUnits   && <Row label="Total Units"  value={Number(item.totalUnits).toLocaleString('en-IN')} />}
          {item.issueManager && <Row label="Issue Manager" value={item.issueManager} />}
          {item.issuePricePer && <Row label="Min Amount"  value={rupees(item.issuePricePer * item.minKitta)} />}
        </View>
      )}

      {/* Apply button */}
      <TouchableOpacity
        style={[ss.applyBtn, { backgroundColor: accent }]}
        onPress={() => onApply?.(item)}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="send-circle" size={16} color="#fff" />
        <Text style={ss.applyText}>Bulk Apply</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function Row({ label, value }) {
  return (
    <View style={ss.expandRow}>
      <Text style={ss.expandLabel}>{label}</Text>
      <Text style={ss.expandValue}>{value}</Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function OpenIposScreen({ onApply }) {
  const insets = useSafeAreaInsets();
  const [ipos, setIpos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTab, setActiveTab] = useState(null); // null = first group

  const fetchIpos = async () => {
    try {
      setError(null);
      const res = await fetch(`${getApiBaseUrl()}/meroshare/issues`);
      const json = await res.json();
      if (json.success && json.data) {
        setIpos(json.data);
        setLastUpdated(new Date());
      } else {
        setError(json.error || 'Failed to load IPOs');
        setIpos([]);
      }
    } catch (e) {
      setError('Network error — is the backend running?');
      setIpos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchIpos(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchIpos();
  }, []);

  // Build category tabs (no 'All')
  const tabs = useMemo(() => {
    const groups = [...new Set(ipos.map(i => i.shareGroupName || i.shareTypeName || 'Other'))];
    groups.sort((a, b) => {
      if (a.toLowerCase().includes('ordinary')) return -1;
      if (b.toLowerCase().includes('ordinary')) return 1;
      return a.localeCompare(b);
    });
    return groups;
  }, [ipos]);

  // Auto-select first tab when data loads
  useEffect(() => {
    if (tabs.length > 0 && (activeTab === null || !tabs.includes(activeTab))) {
      setActiveTab(tabs[0]);
    }
  }, [tabs]);

  const filteredIpos = useMemo(() => {
    if (!activeTab) return ipos;
    return ipos.filter(i => (i.shareGroupName || i.shareTypeName || 'Other') === activeTab);
  }, [ipos, activeTab]);

  const countFor = (tab) =>
    ipos.filter(i => (i.shareGroupName || i.shareTypeName || 'Other') === tab).length;

  return (
    <View style={ss.container}>
      <StatusBar style="light" backgroundColor={COLORS.primary} />
      <View style={[ss.systemTopInset, { height: insets.top }]} />

      {/* ── Header ── */}
      <View style={ss.header}>
        <View>
          <Text style={ss.headerTitle}>Live Open IPOs</Text>
          <Text style={ss.headerSub}>
            {lastUpdated
              ? `via MeroShare · ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Fetching from MeroShare…'}
          </Text>
        </View>
        <View style={ss.livePill}>
          <View style={ss.dotPulse} />
          <Text style={ss.liveText}>LIVE</Text>
        </View>
      </View>

      {/* ── Tab bar ── */}
      {!loading && !error && tabs.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={ss.tabBar}
          contentContainerStyle={ss.tabBarContent}
        >
          {tabs.map(tab => {
            const active = tab === activeTab;
            const color  = groupColor(tab);
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[ss.tab, active && { borderBottomColor: color, borderBottomWidth: 2.5 }]}
                activeOpacity={0.7}
              >
                <Text style={[ss.tabText, { color: active ? color : COLORS.mutedText }]}>{tab}</Text>
                <View style={[ss.tabBadge, { backgroundColor: active ? COLORS.primary : COLORS.surface }]}>
                  <Text style={[ss.tabBadgeText, { color: active ? color : COLORS.mutedText }]}>
                    {countFor(tab)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ── Content ── */}
      {loading && !refreshing ? (
        <View style={ss.center}>
          <ActivityIndicator size="large" color={DEFAULT_COLOR} />
          <Text style={ss.loadingText}>Connecting to MeroShare…</Text>
        </View>
      ) : error ? (
        <View style={ss.center}>
          <Ionicons name="cloud-offline-outline" size={64} color={COLORS.accent} />
          <Text style={ss.errorText}>{error}</Text>
          <TouchableOpacity style={ss.retryBtn} onPress={fetchIpos}>
            <Text style={ss.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredIpos}
          keyExtractor={item => String(item.companyShareId)}
          renderItem={({ item }) => <IpoCard item={item} onApply={onApply} />}
          contentContainerStyle={ss.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[DEFAULT_COLOR]} tintColor={DEFAULT_COLOR} />
          }
          ListEmptyComponent={
            <View style={ss.center}>
              <Ionicons name="documents-outline" size={64} color={COLORS.accent} />
              <Text style={ss.emptyText}>No open IPOs right now</Text>
              <Text style={ss.emptySubText}>Pull down to refresh</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.primary },
  systemTopInset: { height: 0, backgroundColor: COLORS.primary },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surface, paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  headerSub:   { fontSize: 11, color: COLORS.mutedText, marginTop: 2 },
  livePill:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  dotPulse:    { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent },
  liveText:    { fontSize: 11, fontWeight: '800', color: COLORS.text, letterSpacing: 1 },

  listContent: { padding: 14, paddingBottom: 100 },

  tabBar:        { backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexGrow: 0, maxHeight: 52 },
  tabBarContent: { paddingHorizontal: 10, paddingVertical: 6, gap: 2, alignItems: 'center' },
  tab:           { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabText:       { fontSize: 13, fontWeight: '700' },
  tabBadge:      { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  tabBadgeText:  { fontSize: 11, fontWeight: '700' },

  card: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 14,
    borderLeftWidth: 4, borderWidth: 1, borderColor: COLORS.border,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6,
  },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badgeRow:   { flexDirection: 'row', gap: 8 },
  scripBadge: { backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border },
  scripText:  { color: COLORS.mutedText, fontSize: 11, fontWeight: '700' },
  company:    { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: 10, lineHeight: 22 },

  timerRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  timerPill: { backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  cdText:    { color: COLORS.text, fontSize: 11, fontWeight: '700' },
  closeTxt:  { fontSize: 12, color: COLORS.mutedText },

  divider:     { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  expandBox:   { marginBottom: 10 },
  expandRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  expandLabel: { fontSize: 12, color: COLORS.mutedText, fontWeight: '600' },
  expandValue: { fontSize: 12, color: COLORS.text, fontWeight: '600', flex: 1, textAlign: 'right' },

  applyBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  applyText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  loadingText:  { color: COLORS.mutedText, marginTop: 12, fontSize: 14 },
  errorText:    { color: COLORS.text, fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 12 },
  retryBtn:     { marginTop: 16, backgroundColor: COLORS.accent, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText:    { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  emptyText:    { fontSize: 18, color: COLORS.mutedText, fontWeight: '600', marginTop: 16 },
  emptySubText: { fontSize: 13, color: COLORS.mutedText, marginTop: 6 },
});
