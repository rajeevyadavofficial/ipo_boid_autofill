import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, TextInput, Modal,
  Platform
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { getApiBaseUrl } from '../../utils/config';

const STORAGE_KEY = 'meroshareAccounts';

// Base64 Polyfill for React Native (Hermes/JSC don't have btoa/atob globally in release)
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const btoa = (input = '') => {
  let str = input;
  let output = '';
  for (let block = 0, charCode, i = 0, map = chars;
    str.charAt(i | 0) || (map = '=', i % 1);
    output += map.charAt(63 & block >> 8 - i % 1 * 8)) {
    charCode = str.charCodeAt(i += 3 / 4);
    if (charCode > 0xFF) throw new Error("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
    block = block << 8 | charCode;
  }
  return output;
};

const atob = (input = '') => {
  let str = input.replace(/=+$/, '');
  let output = '';
  if (str.length % 4 === 1) throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
  for (let bc = 0, bs, buffer, i = 0;
    buffer = str.charAt(i++);
    ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
      bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
    buffer = chars.indexOf(buffer);
  }
  return output;
};

const decrypt = (encoded) => {
  try { return atob(encoded); } catch { return ''; }
};

const loadAccounts = async () => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

const STATUS_CONFIG = {
  pending:        { icon: 'ellipse-outline',           color: '#9E9E9E', label: 'Pending' },
  applying:       { icon: 'sync-outline',               color: '#2196F3', label: 'Applying...' },
  applied:        { icon: 'checkmark-circle',           color: '#4CAF50', label: 'Applied ✓' },
  'already-applied': { icon: 'alert-circle',           color: '#FF9800', label: 'Already Applied' },
  error:          { icon: 'close-circle',               color: '#F44336', label: 'Failed' },
};

export default function BulkApplyPanel({ onClose }) {
  const insets = useSafeAreaInsets();
  const [accounts, setAccounts] = useState([]);
  const [enabledAccounts, setEnabledAccounts] = useState(new Map());
  const [issues, setIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [kitta, setKitta] = useState('10');
  const [viewMode, setViewMode] = useState('setup'); // 'setup' | 'running' | 'done'
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  const [showIssuePicker, setShowIssuePicker] = useState(false);

  useEffect(() => {
    loadAccounts().then(accs => {
      setAccounts(accs);
      const map = new Map(accs.map((a, i) => [i, true]));
      setEnabledAccounts(map);
    });
    fetchIssues();
  }, []);

  const fetchIssues = async () => {
    setIssuesLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/meroshare/issues`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setIssues(data.data);
      }
    } catch (e) {
      console.warn('Failed to fetch issues:', e.message);
    } finally {
      setIssuesLoading(false);
    }
  };

  const toggleAccount = (index) => {
    setEnabledAccounts(prev => {
      const next = new Map(prev);
      next.set(index, !next.get(index));
      return next;
    });
  };

  const handleApply = async () => {
    if (!selectedIssue) {
      Toast.show({ type: 'error', text1: 'Select an IPO first' });
      return;
    }
    const kitcount = parseInt(kitta);
    if (!kitcount || kitcount < 10) {
      Toast.show({ type: 'error', text1: 'Enter valid kitta (min 10)' });
      return;
    }

    const enabledList = accounts.filter((_, i) => enabledAccounts.get(i));
    if (enabledList.length === 0) {
      Toast.show({ type: 'error', text1: 'Select at least one account' });
      return;
    }

    setViewMode('running');
    setIsApplying(true);

    // Initialize results UI
    const initialResults = enabledList.map(a => ({
      nickname: a.nickname || a.username,
      username: a.username,
      status: 'pending',
    }));
    setResults(initialResults);

    // Prepare payload — decrypt on client, send over HTTPS
    const accountPayload = enabledList.map(a => ({
      clientId: parseInt(a.dpId),
      username: a.username,
      password: decrypt(a.encryptedPassword),
      pin: decrypt(a.encryptedPin),
      crnNumber: a.crnNumber, // Pass CRN to backend
      nickname: a.nickname || a.username,
    }));

    try {
      // Start live progress — mark first as applying
      setResults(prev => {
        const updated = [...prev];
        if (updated[0]) updated[0] = { ...updated[0], status: 'applying' };
        return updated;
      });

      const res = await fetch(`${getApiBaseUrl()}/meroshare/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyShareId: selectedIssue.companyShareId || selectedIssue.id,
          appliedKitta: kitcount,
          accounts: accountPayload,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setResults(data.results);
        setSummary(data.summary);
        setViewMode('done');
      } else {
        Toast.show({ type: 'error', text1: 'Apply failed', text2: data.error });
        setViewMode('setup');
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Network error', text2: e.message });
      setViewMode('setup');
    } finally {
      setIsApplying(false);
    }
  };

  const ResultRow = ({ item }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    return (
      <View style={styles.resultRow}>
        <View style={[styles.resultAvatar, { backgroundColor: cfg.color + '22' }]}>
          <Text style={[styles.avatarText, { color: cfg.color }]}>
            {(item.nickname || '?')[0].toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.resultName}>{item.nickname}</Text>
          <Text style={styles.resultUser}>{item.username}</Text>
          {item.error ? <Text style={styles.resultError}>{item.error}</Text> : null}
        </View>
        <View style={{ alignItems: 'center' }}>
          {item.status === 'applying'
            ? <ActivityIndicator size="small" color="#2196F3" />
            : <Ionicons name={cfg.icon} size={22} color={cfg.color} />
          }
          <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="send-circle" size={22} color="#4CAF50" />
          <Text style={styles.headerTitle}>Bulk IPO Apply</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ===== SETUP VIEW ===== */}
      {viewMode === 'setup' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>

          {/* Issue Selector */}
          <Text style={styles.sectionLabel}>SELECT OPEN IPO</Text>
          <TouchableOpacity style={styles.issueSelector} onPress={() => setShowIssuePicker(true)}>
            {issuesLoading
              ? <ActivityIndicator size="small" color="#6200EE" />
              : selectedIssue
              ? (
                <View style={{ flex: 1 }}>
                  <Text style={styles.issueSelected}>{selectedIssue.companyName || selectedIssue.name}</Text>
                  <Text style={styles.issueSubtext}>
                    Closes: {selectedIssue.closeDate || selectedIssue.closeShareDate || 'N/A'}
                  </Text>
                </View>
              )
              : <Text style={styles.issuePlaceholder}>
                  {issues.length === 0 ? 'No open IPOs found' : 'Tap to select IPO'}
                </Text>
            }
            <Ionicons name="chevron-down" size={20} color="#6200EE" />
          </TouchableOpacity>

          {/* Kitta */}
          <Text style={styles.sectionLabel}>KITTA (SHARES TO APPLY)</Text>
          <View style={styles.kittaRow}>
            {['10', '20', '50', '100'].map(k => (
              <TouchableOpacity key={k}
                style={[styles.kittaChip, kitta === k && styles.kittaChipActive]}
                onPress={() => setKitta(k)}>
                <Text style={[styles.kittaChipText, kitta === k && styles.kittaChipTextActive]}>{k}</Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={[styles.kittaInput, !['10','20','50','100'].includes(kitta) && styles.kittaInputActive]}
              value={kitta}
              onChangeText={setKitta}
              keyboardType="number-pad"
              placeholder="Custom"
              placeholderTextColor="#aaa"
            />
          </View>

          {/* Account List */}
          <Text style={styles.sectionLabel}>ACCOUNTS ({accounts.filter((_, i) => enabledAccounts.get(i)).length}/{accounts.length} selected)</Text>
          {accounts.length === 0
            ? (
              <View style={styles.emptyAccounts}>
                <Ionicons name="person-add-outline" size={40} color="#ccc" />
                <Text style={{ color: '#999', marginTop: 8, textAlign: 'center' }}>
                  No MeroShare accounts found.{'\n'}Add them in BOID Manager → MeroShare Accounts.
                </Text>
              </View>
            )
            : (
              <View style={{ paddingBottom: 20 }}>
                {accounts.map((acc, index) => {
                  const enabled = enabledAccounts.get(index);
                  return (
                    <TouchableOpacity key={index} style={[styles.accountCard, !enabled && { opacity: 0.5 }]}
                      onPress={() => toggleAccount(index)}>
                      <View style={[styles.accountAvatar, { backgroundColor: enabled ? '#6200EE' : '#ccc' }]}>
                        <Text style={styles.avatarText}>{(acc.nickname || '?')[0].toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.accountName}>{acc.nickname || acc.username}</Text>
                        <Text style={styles.accountDp} numberOfLines={1}>{acc.dpName}</Text>
                      </View>
                      <Ionicons name={enabled ? 'checkbox' : 'square-outline'} size={22}
                        color={enabled ? '#4CAF50' : '#ccc'} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )
          }

          {/* Apply Button */}
          <View style={{ paddingBottom: 100 }}>
            <TouchableOpacity
              style={[styles.applyBtn, (!selectedIssue || accounts.length === 0) && { opacity: 0.4 }]}
              onPress={handleApply}
              disabled={!selectedIssue || accounts.length === 0}
            >
              <MaterialCommunityIcons name="send" size={20} color="#fff" />
              <Text style={styles.applyBtnText}>Apply for All Selected</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ===== RUNNING / DONE VIEW ===== */}
      {(viewMode === 'running' || viewMode === 'done') && (
        <View style={{ flex: 1 }}>
          {/* Summary bar */}
          {summary && (
            <View style={styles.summaryBar}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNum, { color: '#4CAF50' }]}>{summary.applied}</Text>
                <Text style={styles.summaryLabel}>Applied</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNum, { color: '#FF9800' }]}>{summary.alreadyApplied}</Text>
                <Text style={styles.summaryLabel}>Already Done</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNum, { color: '#F44336' }]}>{summary.errors}</Text>
                <Text style={styles.summaryLabel}>Failed</Text>
              </View>
            </View>
          )}

          {viewMode === 'running' && (
            <View style={styles.progressBanner}>
              <ActivityIndicator color="#fff" />
              <Text style={{ color: '#fff', marginLeft: 10, fontWeight: '600' }}>
                Applying... please wait
              </Text>
            </View>
          )}

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {results.map((item, i) => (
              <View key={i.toString()} style={styles.resultRow}>
                <View style={[styles.resultAvatar, { backgroundColor: (STATUS_CONFIG[item.status] || STATUS_CONFIG.pending).color + '22' }]}>
                  <Text style={[styles.avatarText, { color: (STATUS_CONFIG[item.status] || STATUS_CONFIG.pending).color }]}>
                    {(item.nickname || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{item.nickname}</Text>
                  <Text style={styles.resultUser}>{item.username}</Text>
                  {item.error ? <Text style={styles.resultError}>{item.error}</Text> : null}
                </View>
                <View style={{ alignItems: 'center' }}>
                  {item.status === 'applying'
                    ? <ActivityIndicator size="small" color="#2196F3" />
                    : <Ionicons name={(STATUS_CONFIG[item.status] || STATUS_CONFIG.pending).icon} size={22} color={(STATUS_CONFIG[item.status] || STATUS_CONFIG.pending).color} />
                  }
                  <Text style={[styles.statusLabel, { color: (STATUS_CONFIG[item.status] || STATUS_CONFIG.pending).color }]}>{(STATUS_CONFIG[item.status] || STATUS_CONFIG.pending).label}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {viewMode === 'done' && (
            <TouchableOpacity style={styles.doneBtn} onPress={() => setViewMode('setup')}>
              <Text style={styles.doneBtnText}>Apply Again</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Issue Picker Modal */}
      <Modal visible={showIssuePicker} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Text style={styles.pickerTitle}>Select Open IPO</Text>
            {issuesLoading
              ? <ActivityIndicator style={{ marginTop: 30 }} color="#6200EE" size="large" />
              : issues.length === 0
              ? <Text style={{ textAlign: 'center', color: '#999', marginTop: 30, padding: 20 }}>No open IPOs at the moment.</Text>
              : (
                <ScrollView style={{ maxHeight: 400 }}>
                  {issues.map((item, i) => (
                    <TouchableOpacity key={(item.companyShareId || i).toString()} style={styles.issueItem} onPress={() => {
                      setSelectedIssue(item);
                      setShowIssuePicker(false);
                    }}>
                      <Text style={styles.issueItemName}>{item.companyName || item.name}</Text>
                      <Text style={styles.issueItemSub}>
                        {item.shareTypeName || item.shareType} • Closes: {item.closeDate || item.closeShareDate || 'N/A'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )
            }
            <TouchableOpacity style={styles.pickerClose} onPress={() => setShowIssuePicker(false)}>
              <Text style={{ color: '#666', fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#333a56', paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { color: '#fff', fontWeight: 'bold', fontSize: 18, marginLeft: 8 },
  closeBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: '#999', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  issueSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: '#6200EE22', elevation: 1 },
  issueSelected: { fontWeight: '700', fontSize: 15, color: '#222' },
  issueSubtext: { fontSize: 12, color: '#888', marginTop: 2 },
  issuePlaceholder: { flex: 1, color: '#aaa', fontSize: 14 },
  kittaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  kittaChip: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' },
  kittaChipActive: { backgroundColor: '#6200EE', borderColor: '#6200EE' },
  kittaChipText: { fontSize: 14, color: '#555', fontWeight: '600' },
  kittaChipTextActive: { color: '#fff' },
  kittaInput: { flex: 1, minWidth: 100, borderWidth: 1.5, borderColor: '#6200EE44', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#fff', color: '#6200EE', fontWeight: 'bold', textAlign: 'center' },
  kittaInputActive: { borderColor: '#6200EE', backgroundColor: '#F3F0FF' },
  emptyAccounts: { alignItems: 'center', paddingVertical: 40, opacity: 0.6 },
  accountCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, elevation: 1 },
  accountAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  accountName: { fontWeight: '700', fontSize: 14, color: '#222' },
  accountDp: { fontSize: 11, color: '#888', marginTop: 1 },
  applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4CAF50', borderRadius: 14, paddingVertical: 16, marginTop: 24, gap: 8 },
  applyBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  // Results
  summaryBar: { flexDirection: 'row', backgroundColor: '#333a56', paddingVertical: 12 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: 24, fontWeight: 'bold' },
  summaryLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  progressBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2196F3', paddingHorizontal: 16, paddingVertical: 10 },
  resultRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, elevation: 1 },
  resultAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  resultName: { fontWeight: '700', fontSize: 14, color: '#222' },
  resultUser: { fontSize: 12, color: '#666' },
  resultError: { fontSize: 11, color: '#F44336', marginTop: 2 },
  statusLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  doneBtn: { margin: 16, backgroundColor: '#6200EE', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Issue picker
  pickerOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingTop: 16 },
  pickerTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 12, color: '#222' },
  issueItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  issueItemName: { fontWeight: '700', fontSize: 15, color: '#222' },
  issueItemSub: { fontSize: 12, color: '#888', marginTop: 3 },
  pickerClose: { margin: 12, padding: 14, backgroundColor: '#eee', borderRadius: 10, alignItems: 'center' },
});
