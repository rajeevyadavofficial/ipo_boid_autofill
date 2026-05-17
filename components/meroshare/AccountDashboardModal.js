import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MeroShareApi } from '../../services/meroShareApi';
import { getApiBaseUrl } from '../../utils/config';

// Simple base64 decode
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const atob = (input = '') => {
  let str = input.replace(/=+$/, ''), output = '';
  if (str.length % 4 === 1) return input;
  for (let bc = 0, bs, buffer, i = 0;
    buffer = str.charAt(i++);
    ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4)
      ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
    buffer = chars.indexOf(buffer);
  }
  return output;
};
const decrypt = (encoded) => { try { const d = atob(encoded); return d || encoded; } catch { return encoded; } };

const TABS = ['Profile', 'Portfolio', 'Stats & History', 'Banking', 'Raw JSON'];
const TAB_ICONS = ['person', 'bar-chart', 'stats-chart', 'card', 'code-slash'];

export default function AccountDashboardModal({ account, onClose }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const password = decrypt(account.encryptedPassword);
      const token = await MeroShareApi.login(parseInt(account.dpId), account.username, password);
      if (!token) throw new Error('Login failed. Check credentials.');
      const allData = await MeroShareApi.fetchAllAccountData(token);
      await MeroShareApi.logout(token);

      setData(allData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.root}>
        <StatusBar style="light" backgroundColor="#333a56" />
        <View style={{ height: insets.top, backgroundColor: '#333a56' }} />
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>
              {(account.nickname || account.username)[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerName}>{account.nickname || account.username}</Text>
            <Text style={styles.headerSub}>{account.dpName}</Text>
          </View>
          <TouchableOpacity onPress={loadData} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={20} color="#7ee787" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#c9d1d9" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabBarWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
            {TABS.map((tab, i) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === i && styles.tabActive]}
                onPress={() => setActiveTab(i)}
              >
                <Ionicons name={TAB_ICONS[i]} size={16} color={activeTab === i ? '#58a6ff' : '#8b949e'} />
                <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#58a6ff" />
            <Text style={styles.loadingText}>Fetching account data...</Text>
            <Text style={styles.loadingSubText}>This may take a few seconds</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle" size={48} color="#ff7b72" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {activeTab === 0 && <ProfileTab data={data} />}
            {activeTab === 1 && <PortfolioTab data={data} />}
            {activeTab === 2 && <ApplicationsTab data={data} />}
            {activeTab === 3 && <BankingTab data={data} />}
            {activeTab === 4 && <RawDataTab data={data} />}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Tab Components ───────────────────────────────────────────────────────────

function ProfileTab({ data }) {
  const own = data?.ownDetail || {};
  const detail = data?.myDetail || {};
  return (
    <View>
      <SectionHeader icon="person-circle" title="Account Profile" />
      <InfoCard rows={[
        ['Full Name', own.name || detail.name || '—'],
        ['DMAT / BOID', own.demat || '—'],
        ['Username', own.username || '—'],
        ['Contact', own.contact || own.email || '—'],
        ['Address', detail.address || '—'],
        ['DP Name', own.dpName || '—'],
        ['CRN', detail.crn || own.crn || '—'],
        ['Account Status', own.accountStatus || '—'],
      ]} />
    </View>
  );
}

function PortfolioTab({ data }) {
  const shares = data?.myShares?.object || [];
  const portfolio = data?.portfolio || {};
  const txns = data?.transactionHistory?.object || [];

  const totalValue = shares.reduce((sum, s) => sum + (s.currentValue || 0), 0);
  const totalCost = shares.reduce((sum, s) => sum + (s.purchaseAmount || 0), 0);
  const pnl = totalValue - totalCost;

  return (
    <View>
      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <StatCard label="Holdings" value={shares.length} color="#58a6ff" />
        <StatCard label="Gain/Loss" value={pnl >= 0 ? `+${fmt(pnl)}` : fmt(pnl)} color={pnl >= 0 ? '#7ee787' : '#ff7b72'} />
        <StatCard label="Current Value" value={`रू${fmt(totalValue)}`} color="#e3b341" />
      </View>

      {shares.length === 0 ? (
        <EmptyState icon="bar-chart-outline" text="No shares in portfolio" />
      ) : (
        <>
          <SectionHeader icon="trending-up" title={`Holdings (${shares.length})`} />
          {shares.map((s, i) => (
            <View key={i} style={styles.shareCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.shareScrip}>{s.script || s.companyName}</Text>
                <Text style={styles.shareCompany}>{s.companyName}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.shareQty}>{s.currentBalance || s.totalQty} units</Text>
                {s.currentValue ? (
                  <Text style={styles.shareValue}>रू{fmt(s.currentValue)}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </>
      )}

      {txns.length > 0 && (
        <>
          <SectionHeader icon="swap-horizontal" title={`Recent Transactions (${txns.length})`} />
          {txns.slice(0, 20).map((t, i) => (
            <View key={i} style={styles.txnRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.txnScript}>{t.script || t.companyName}</Text>
                <Text style={styles.txnDate}>{t.transactionDate || t.date}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.txnType, { color: t.transactionType === 'DR' ? '#ff7b72' : '#7ee787' }]}>
                  {t.transactionType} {t.quantity}
                </Text>
                <Text style={styles.txnRate}>@ रू{t.rate}</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function SuccessBar({ rate }) {
  const color = rate >= 70 ? '#7ee787' : rate >= 40 ? '#e3b341' : '#ff7b72';
  return (
    <View style={{ marginVertical: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: '#8b949e', fontSize: 12, fontWeight: '600' }}>Allotment Success Rate</Text>
        <Text style={{ color, fontSize: 14, fontWeight: '800' }}>{rate}%</Text>
      </View>
      <View style={{ height: 8, backgroundColor: '#21262d', borderRadius: 4, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${rate}%`, backgroundColor: color, borderRadius: 4 }} />
      </View>
    </View>
  );
}

function ApplicationsTab({ data }) {
  const stats = data?.verifiedStats || {
    total: 0, allotted: 0, notAllotted: 0, pending: 0, bankFailed: 0, successRate: 0
  };

  const applications = data?.verifiedApplications || [];

  const getCatStyle = (cat) => {
    switch(cat) {
      case 'allotted':    return { color: '#7ee787', label: 'Allotted', icon: 'checkmark-circle' };
      case 'not_allotted': return { color: '#ff7b72', label: 'Not Allotted', icon: 'close-circle' };
      case 'bank_failed':  return { color: '#ff7b72', label: 'Bank Failed', icon: 'alert-circle' };
      case 'pending':     return { color: '#e3b341', label: 'Pending', icon: 'time' };
      default:            return { color: '#8b949e', label: cat, icon: 'help-circle' };
    }
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionHeader icon="stats-chart" title={data?.verifiedStats ? "Accurate IPO Stats" : "IPO History"} />
      </View>

      {!data?.verifiedStats && (
        <View style={{ backgroundColor: '#f39c1211', padding: 10, borderRadius: 8, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#f39c12' }}>
          <Text style={{ color: '#f39c12', fontSize: 11, fontWeight: '600' }}>⚠️ Fetching unverified data. Refresh to load deep stats.</Text>
        </View>
      )}

      <View style={styles.summaryRow}>
        <StatCard label="Total Applied" value={stats.total} color="#58a6ff" />
        <StatCard label="Allotted" value={stats.allotted} color="#7ee787" />
        <StatCard label="Not Allotted" value={stats.notAllotted} color="#ff7b72" />
      </View>

      <View style={[styles.infoCard, { padding: 12 }]}>
        <SuccessBar rate={stats.successRate} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 5 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: '#e3b341', fontWeight: '800', fontSize: 16 }}>{stats.pending}</Text>
            <Text style={{ color: '#8b949e', fontSize: 10 }}>Pending</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: '#ff7b72', fontWeight: '800', fontSize: 16 }}>{stats.bankFailed}</Text>
            <Text style={{ color: '#8b949e', fontSize: 10 }}>Bank Failed</Text>
          </View>
        </View>
      </View>

      {applications.length === 0 ? (
        <EmptyState icon="document-text-outline" text="No IPO history found" />
      ) : (
        <>
          <SectionHeader icon="document-text" title={`${data?.verifiedStats ? 'Verified' : 'Raw'} History (${applications.length})`} />
          {applications.map((a, i) => {
            const cs = getCatStyle(a.category);
            return (
              <View key={i} style={styles.appCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appScript}>{a.scrip}</Text>
                  <Text style={styles.appCompany} numberOfLines={1}>{a.companyName}</Text>
                  <Text style={{ color: '#8b949e', fontSize: 11, marginTop: 2 }}>
                    Status: {a.statusName} {a.remark ? ` • ${a.remark}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.appKitta}>{a.appliedKitta} kitta</Text>
                  <View style={[styles.statusBadge, { backgroundColor: cs.color + '22', borderColor: cs.color + '44', borderWidth: 1 }]}>
                    <Ionicons name={cs.icon} size={10} color={cs.color} style={{ marginRight: 4 }} />
                    <Text style={[styles.statusText, { color: cs.color }]}>
                      {cs.label}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

function BankingTab({ data }) {
  const bankReq = data?.bankRequest || {};
  const bankSpec = Array.isArray(data?.bankDetails) ? data.bankDetails[0] : data?.bankDetails || {};
  const bankList = Array.isArray(data?.bankList) ? data.bankList[0] : data?.bankList || {};

  return (
    <View>
      <SectionHeader icon="card" title="Linked Bank Account" />
      <InfoCard rows={[
        ['Bank', bankList.name || '—'],
        ['Account Number', bankReq.accountNumber || '—'],
        ['Account Type', bankSpec.accountTypeName || '—'],
        ['Branch', bankSpec.branchName || '—'],
        ['Bank Code', bankList.code || '—'],
        ['Status', bankReq.status || '—'],
      ]} />
    </View>
  );
}

// Raw JSON viewer tab
function RawDataTab({ data }) {
  const [expanded, setExpanded] = React.useState({});
  const toggle = (key) => setExpanded(p => ({ ...p, [key]: !p[key] }));

  const endpoints = Object.entries(data || {});
  const sizes = endpoints.map(([k, v]) => {
    const bytes = JSON.stringify(v || '').length;
    return bytes > 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
  });

  return (
    <View>
      <SectionHeader icon="code-slash" title={`All API Responses (${endpoints.length} endpoints)`} />
      {endpoints.map(([key, val], i) => {
        const isOpen = expanded[key];
        const isNull = val === null;
        const isError = val?.error;
        return (
          <View key={key} style={styles.rawSection}>
            <TouchableOpacity
              style={styles.rawHeader}
              onPress={() => toggle(key)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rawKey}>{key}</Text>
                <Text style={styles.rawSize}>{isNull ? 'null / failed' : isError ? 'error' : sizes[i]}</Text>
              </View>
              <View style={[styles.rawBadge, { backgroundColor: isNull || isError ? '#ff7b7222' : '#7ee78722' }]}>
                <Text style={{ color: isNull || isError ? '#ff7b72' : '#7ee787', fontSize: 10, fontWeight: '700' }}>
                  {isNull || isError ? '✗' : '✓'}
                </Text>
              </View>
              <Ionicons
                name={isOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#8b949e"
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
            {isOpen && (
              <ScrollView
                style={styles.rawBody}
                nestedScrollEnabled
              >
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <Text style={styles.rawJson}>
                    {JSON.stringify(val, null, 2)}
                  </Text>
                </ScrollView>
              </ScrollView>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function SectionHeader({ icon, title }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={16} color="#58a6ff" style={{ marginRight: 8 }} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function InfoCard({ rows }) {
  return (
    <View style={styles.infoCard}>
      {rows.map(([label, value], i) => (
        <View key={i} style={[styles.infoRow, i < rows.length - 1 && styles.infoRowBorder]}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function StatCard({ label, value, color }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ icon, text }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={48} color="#30363d" />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const fmt = (n) => {
  if (!n && n !== 0) return '—';
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1117' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#21262d', backgroundColor: '#161b22' },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#388bfd26', borderWidth: 1, borderColor: '#58a6ff66', justifyContent: 'center', alignItems: 'center' },
  headerAvatarText: { color: '#58a6ff', fontWeight: 'bold', fontSize: 18 },
  headerName: { color: '#e6edf3', fontWeight: '700', fontSize: 16 },
  headerSub: { color: '#8b949e', fontSize: 12, marginTop: 2 },
  refreshBtn: { padding: 8, backgroundColor: '#7ee78726', borderRadius: 20, marginRight: 8 },
  closeBtn: { padding: 8, backgroundColor: '#21262d', borderRadius: 20 },
  tabBarWrapper: { backgroundColor: '#161b22', borderBottomWidth: 1, borderBottomColor: '#21262d' },
  tabBar: { flexDirection: 'row', paddingHorizontal: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 16 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#58a6ff' },
  tabText: { fontSize: 11, color: '#8b949e', fontWeight: '600' },
  tabTextActive: { color: '#58a6ff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { color: '#e6edf3', marginTop: 16, fontSize: 15, fontWeight: '600' },
  loadingSubText: { color: '#8b949e', marginTop: 4, fontSize: 12 },
  errorText: { color: '#ff7b72', marginTop: 12, textAlign: 'center', fontSize: 14 },
  retryBtn: { marginTop: 16, backgroundColor: '#388bfd26', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10, borderWidth: 1, borderColor: '#58a6ff66' },
  retryText: { color: '#58a6ff', fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#161b22', borderRadius: 10, padding: 14, borderTopWidth: 2, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#8b949e', fontSize: 11, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  sectionTitle: { color: '#58a6ff', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },
  infoCard: { backgroundColor: '#161b22', borderRadius: 10, borderWidth: 1, borderColor: '#21262d', overflow: 'hidden', marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: '#21262d' },
  infoLabel: { color: '#8b949e', fontSize: 13 },
  infoValue: { color: '#e6edf3', fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  shareCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161b22', borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#21262d' },
  shareScrip: { color: '#7ee787', fontWeight: '800', fontSize: 14 },
  shareCompany: { color: '#8b949e', fontSize: 11, marginTop: 2 },
  shareQty: { color: '#e6edf3', fontWeight: '700', fontSize: 13 },
  shareValue: { color: '#e3b341', fontSize: 12, marginTop: 2 },
  txnRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#21262d' },
  txnScript: { color: '#e6edf3', fontWeight: '600', fontSize: 13 },
  txnDate: { color: '#8b949e', fontSize: 11, marginTop: 2 },
  txnType: { fontWeight: '700', fontSize: 13 },
  txnRate: { color: '#8b949e', fontSize: 11, marginTop: 2 },
  appCard: { flexDirection: 'row', backgroundColor: '#161b22', borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#21262d' },
  appScript: { color: '#58a6ff', fontWeight: '800', fontSize: 14 },
  appCompany: { color: '#8b949e', fontSize: 11, marginTop: 1 },
  appDate: { color: '#8b949e', fontSize: 11, marginTop: 2 },
  appKitta: { color: '#e6edf3', fontWeight: '700', fontSize: 13, marginBottom: 4 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#8b949e', marginTop: 12, fontSize: 14 },
  // Raw JSON tab
  rawSection: { borderWidth: 1, borderColor: '#21262d', borderRadius: 10, marginBottom: 10, overflow: 'hidden' },
  rawHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161b22', paddingHorizontal: 14, paddingVertical: 12 },
  rawKey: { color: '#79c0ff', fontWeight: '700', fontSize: 14, fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier' },
  rawSize: { color: '#8b949e', fontSize: 11, marginTop: 2 },
  rawBadge: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  rawBody: { maxHeight: 300, backgroundColor: '#0d1117' },
  rawJson: { color: '#c9d1d9', fontSize: 11, padding: 12, fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier', lineHeight: 18 },
});
