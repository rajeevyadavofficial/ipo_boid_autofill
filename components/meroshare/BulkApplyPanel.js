import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, TextInput, Modal,
  Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { getApiBaseUrl } from '../../utils/config';
import { MeroShareApi } from '../../services/meroShareApi';
import AccountDashboardModal from './AccountDashboardModal';
import { COLORS } from '../../utils/theme';

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
  if (!encoded) return '';
  try {
    const decoded = atob(encoded);
    // Sanity check: if decoded looks like garbage (non-printable chars), return original
    if (decoded && decoded.length > 0) return decoded;
    return encoded;
  } catch {
    // atob failed — password was stored as plain text, return as-is
    return encoded;
  }
};

const loadAccounts = async () => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

const STATUS_CONFIG = {
  // Apply statuses
  pending:        { icon: 'ellipse-outline',    color: '#9E9E9E', label: 'Pending'           },
  applying:       { icon: 'sync-outline',        color: '#2196F3', label: 'Applying...'       },
  applied:        { icon: 'checkmark-circle',    color: '#4CAF50', label: 'Applied ✓'         },
  'already-applied': { icon: 'alert-circle',    color: '#FF9800', label: 'Already Applied'   },
  error:          { icon: 'close-circle',        color: '#F44336', label: 'Failed'            },
  // Check-status statuses
  checking:       { icon: 'sync-outline',        color: '#2196F3', label: 'Checking...'       },
  verified:       { icon: 'checkmark-circle',    color: '#4CAF50', label: 'Applied & Verified'},
  bank_failed:    { icon: 'refresh-circle',      color: '#F44336', label: 'Bank Failed'       },
  not_applied:    { icon: 'remove-circle-outline',color: '#9E9E9E', label: 'Not Applied'      },
  edit:           { icon: 'pencil',              color: '#FF9800', label: 'Edit Required'     },
  blocked:        { icon: 'ban',                 color: '#F44336', label: 'Blocked'           },
  unknown:        { icon: 'help-circle-outline', color: '#9E9E9E', label: 'Unknown'           },
};

export default function BulkApplyPanel({ initialIssue, onClose }) {
  const insets = useSafeAreaInsets();
  const [accounts, setAccounts] = useState([]);
  const [enabledAccounts, setEnabledAccounts] = useState(new Map());
  const [issues, setIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState(initialIssue || null);
  const [kitta, setKitta] = useState('10');
  const [viewMode, setViewMode] = useState('setup'); // 'setup' | 'running' | 'done' | 'status'
  const [activeTab, setActiveTab] = useState('apply'); // 'apply' | 'status'
  const [results, setResults] = useState([]);
  const [statusResults, setStatusResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [showIssuePicker, setShowIssuePicker] = useState(false);
  const [dashboardAccount, setDashboardAccount] = useState(null);

  useEffect(() => {
    loadAccounts().then(accs => {
      setAccounts(accs);
      const map = new Map(accs.map((a, i) => [i, true]));
      setEnabledAccounts(map);
      fetchIssues(accs); // Pass accounts directly
    });
  }, []);

  const fetchIssues = async (providedAccounts = null) => {
    setIssuesLoading(true);
    try {
      // 1. Try Backend First
      try {
        const res = await fetch(`${getApiBaseUrl()}/meroshare/issues`);
        const data = await res.json();

        // Check if data is real or just mock/demo data
        const isRealData = data.success && Array.isArray(data.data) &&
                           data.data.length > 0 &&
                           !data.data[0].companyName.includes('OFFLINE MODE') &&
                           !data.data[0].companyName.includes('TEST MODE');

        if (isRealData) {
          setIssues(data.data);
          setIssuesLoading(false);
          return;
        }
      } catch (backendErr) {
        console.warn('Backend issues fetch failed, falling back...', backendErr.message);
      }

      // 2. Fallback: Direct Fetch from MeroShare (Like Flutter App)
      console.log('🔄 Backend issues offline/mock, trying direct fetch...');
      const targetAccounts = providedAccounts || accounts;
      if (targetAccounts.length > 0) {
        const first = targetAccounts[0];
        const token = await MeroShareApi.login(first.dpId, first.username, decrypt(first.password));
        if (token) {
          const directIssues = await MeroShareApi.fetchOpenIpos(token);
          if (directIssues.length > 0) {
            setIssues(directIssues);
            await MeroShareApi.logout(token);
            setIssuesLoading(false);
            return;
          }
          await MeroShareApi.logout(token);
        }
      }

      // 3. Last Resort: Use whatever the backend gave us (even if mock)
      if (data.success && Array.isArray(data.data)) {
        setIssues(data.data);
      }
    } catch (e) {
      console.warn('Failed to fetch issues:', e.message);
    } finally {
      setIssuesLoading(false);
    }
  };

  const resetScreen = () => {
    setResults([]);
    setStatusResults([]);
    setSummary(null);
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

    setIsApplying(true);

    // Initialize results UI
    const initialResults = enabledList.map(a => ({
      nickname: a.nickname || a.username,
      username: a.username,
      status: 'pending',
      error: null,
    }));
    setResults(initialResults);

    const stats = { applied: 0, alreadyApplied: 0, errors: 0 };

    for (let i = 0; i < enabledList.length; i++) {
      const acc = enabledList[i];
      const label = acc.nickname || acc.username;

      // Update UI: Current account is "applying"
      setResults(prev => {
        const next = [...prev];
        next[i] = { ...next[i], status: 'applying' };
        return next;
      });

      try {
        // 1. Login
        const password = decrypt(acc.encryptedPassword);
        const token = await MeroShareApi.login(acc.dpId, acc.username, password);

        if (!token) throw new Error('Login failed');

        // 2. Fetch missing details (BOID, CustomerId, BankId, etc.)
        // We do this every time to ensure we have the correct 16-digit BOID for apply
        const details = await MeroShareApi.fetchDetails(token, acc.username);
        if (!details) throw new Error('Failed to fetch account details');

        // PRE-CHECK: Check active applications to see if already applied
        const activeApps = await MeroShareApi.fetchActiveApplications(token);
        const issueIdStr = (selectedIssue.companyShareId || selectedIssue.id).toString();
        const alreadyAppliedApp = activeApps.find(app => app.companyShareId?.toString() === issueIdStr);

        if (alreadyAppliedApp && ['BLOCKED_APPROVE', 'VERIFIED', 'TRANSACTION_SUCCESS'].includes(alreadyAppliedApp.statusName)) {
          stats.alreadyApplied++;
          setResults(prev => {
            const next = [...prev];
            next[i] = { ...next[i], status: 'already-applied' };
            return next;
          });
          await MeroShareApi.logout(token);
          setSummary({ ...stats });
          continue; // Skip the apply call
        }

        // 3. Apply
        const applyRes = await MeroShareApi.apply(token, {
          demat: details.dmat,
          boid: details.dmat.slice(-8), // MeroShare requires last 8 digits only
          accountNumber: details.accountNumber,
          customerId: details.customerId,
          accountBranchId: details.branchId,
          accountTypeId: details.accountTypeId,
          appliedKitta: kitcount.toString(),
          crnNumber: acc.crnNumber,
          transactionPIN: decrypt(acc.encryptedPin),
          companyShareId: (selectedIssue.companyShareId || selectedIssue.id).toString(),
          bankId: details.bankId,
        });

        // 4. Update status based on response
        if (applyRes.success) {
          stats.applied++;
          setResults(prev => {
            const next = [...prev];
            next[i] = { ...next[i], status: 'applied' };
            return next;
          });
        } else {
          const msg = applyRes.message || '';
          const msgLower = msg.toLowerCase();
          if (msgLower.includes('already applied') || msgLower.includes('already been applied') || msgLower.includes('application in progress')) {
            stats.alreadyApplied++;
            setResults(prev => {
              const next = [...prev];
              next[i] = { ...next[i], status: 'already-applied' };
              return next;
            });
          } else {
            throw new Error(msg);
          }
        }

        await MeroShareApi.logout(token);
      } catch (err) {
        stats.errors++;
        setResults(prev => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'error', error: err.message };
          return next;
        });
      }

      // Update summary live
      setSummary({ ...stats });

      // Safety delay between accounts (except for the last one)
      if (i < enabledList.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    setIsApplying(false);
  };

  const handleCheckStatus = async () => {
    if (!selectedIssue) {
      Toast.show({ type: 'error', text1: 'Select an IPO first' });
      return;
    }
    const enabledList = accounts.filter((_, i) => enabledAccounts.get(i));
    if (enabledList.length === 0) {
      Toast.show({ type: 'error', text1: 'Select at least one account' });
      return;
    }

    setIsCheckingStatus(true);

    // Init all as 'checking'
    const initial = enabledList.map(a => ({
      nickname: a.nickname || a.username,
      username: a.username,
      status: 'checking',
      label: 'Checking...',
    }));
    setStatusResults(initial);

    try {
      const payload = {
        companyShareId: selectedIssue.companyShareId || selectedIssue.id,
        accounts: enabledList.map(a => ({
          clientId:  a.dpId,
          username:  a.username,
          password:  decrypt(a.encryptedPassword),
          nickname:  a.nickname || a.username,
        })),
      };

      console.log('📡 Checking status for:', selectedIssue.companyName, '| accounts:', enabledList.length);

      const res = await fetch(`${getApiBaseUrl()}/meroshare/check-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log('✅ Check status response:', JSON.stringify(data));

      if (data.success && Array.isArray(data.results)) {
        setStatusResults(data.results.map(r => ({
          nickname: r.nickname,
          username: r.username,
          status:   r.status,
          label:    r.label,
          error:    r.error || null,
        })));
      } else {
        // Show error in results but stay on status screen
        setStatusResults(initial.map(r => ({
          ...r,
          status: 'error',
          label: 'Failed',
          error: data.error || 'Status check failed',
        })));
      }
    } catch (e) {
      console.error('❌ Check status error:', e.message);
      // Stay on status screen — show error for each account
      setStatusResults(enabledList.map(a => ({
        nickname: a.nickname || a.username,
        username: a.username,
        status: 'error',
        label: 'Failed',
        error: e.message,
      })));
    } finally {
      setIsCheckingStatus(false);
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
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={COLORS.primary} />
      <View style={{ height: insets.top, backgroundColor: COLORS.primary }} />
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="send-circle" size={22} color="#4CAF50" />
          <Text style={styles.headerTitle}>Bulk Action Manager</Text>
        </View>
      </View>

      {/* Tabs */}
      {viewMode === 'setup' && (
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'apply' && styles.activeTab]}
            onPress={() => setActiveTab('apply')}
          >
            <Text style={[styles.tabText, activeTab === 'apply' && styles.activeTabText]}>
              Bulk IPO Apply
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'status' && styles.activeTab]}
            onPress={() => setActiveTab('status')}
          >
            <Text style={[styles.tabText, activeTab === 'status' && styles.activeTabText]}>
              Check Status
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ===== SETUP VIEW ===== */}
      {viewMode === 'setup' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>

          {/* Issue Selector */}
          <Text style={styles.sectionLabel}>SELECT OPEN IPO</Text>
          <TouchableOpacity style={styles.issueSelector} onPress={() => setShowIssuePicker(true)}>
            {issuesLoading
              ? <ActivityIndicator size="small" color={COLORS.accent} />
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
            <Ionicons name="chevron-down" size={20} color={COLORS.accent} />
          </TouchableOpacity>

          {/* Kitta */}
          {activeTab === 'apply' && (
            <View>
              <Text style={styles.sectionLabel}>KITTA (SHARES TO APPLY)</Text>
              <View style={styles.kittaRow}>
                {['10', '20', '50', '100'].map(k => (
                  <TouchableOpacity key={k}
                    style={[styles.kittaChip, kitta === k && styles.kittaChipActive]}
                    onPress={() => setKitta(k)}>
                    <Text style={[styles.kittaChipText, kitta === k && styles.kittaChipTextActive]}>{k}</Text>
                  </TouchableOpacity>
                ))}
                <View style={{ flex: 1, minWidth: 100 }}>
                  <Text style={{ fontSize: 10, color: '#888', marginBottom: 4, fontWeight: 'bold', marginLeft: 4 }}>MANUAL ENTRY</Text>
                  <TextInput
                    style={[styles.kittaInput, !['10','20','50','100'].includes(kitta) && styles.kittaInputActive, { minWidth: '100%', flex: 0 }]}
                    value={kitta}
                    onChangeText={setKitta}
                    keyboardType="number-pad"
                    placeholder="Add kitta manually"
                    placeholderTextColor="#aaa"
                  />
                </View>
              </View>
            </View>
          )}

          {/* Summary / Progress Banner */}
          {activeTab === 'apply' && isApplying && (
            <View style={[styles.progressBanner, { borderRadius: 12, marginBottom: 12, marginTop: 12 }]}>
              <ActivityIndicator color="#fff" />
              <Text style={{ color: '#fff', marginLeft: 10, fontWeight: '600' }}>Applying... please wait</Text>
            </View>
          )}
          {activeTab === 'apply' && summary && !isApplying && (
            <View style={[styles.summaryBar, { borderRadius: 12, marginBottom: 12, marginTop: 12, overflow: 'hidden' }]}>
              <View style={styles.summaryItem}><Text style={[styles.summaryNum, { color: '#4CAF50' }]}>{summary.applied}</Text><Text style={styles.summaryLabel}>Applied</Text></View>
              <View style={styles.summaryItem}><Text style={[styles.summaryNum, { color: '#FF9800' }]}>{summary.alreadyApplied}</Text><Text style={styles.summaryLabel}>Already Done</Text></View>
              <View style={styles.summaryItem}><Text style={[styles.summaryNum, { color: '#F44336' }]}>{summary.errors}</Text><Text style={styles.summaryLabel}>Failed</Text></View>
            </View>
          )}

          {activeTab === 'status' && isCheckingStatus && (
            <View style={[styles.progressBanner, { borderRadius: 12, marginBottom: 12, marginTop: 12 }]}>
              <ActivityIndicator color="#fff" />
              <Text style={{ color: '#fff', marginLeft: 10, fontWeight: '600' }}>Checking Status... please wait</Text>
            </View>
          )}
          {activeTab === 'status' && statusResults.length > 0 && !isCheckingStatus && (
            <View style={[styles.summaryBar, { borderRadius: 12, marginBottom: 12, marginTop: 12, overflow: 'hidden' }]}>
              {[
                { key: 'verified',    color: '#4CAF50', label: 'Verified'    },
                { key: 'bank_failed', color: '#F44336', label: 'Bank Failed' },
                { key: 'not_applied', color: '#9E9E9E', label: 'Not Applied' },
                { key: 'error',       color: '#FF9800', label: 'Error'       },
              ].map(({ key, color, label }) => (
                <View key={key} style={styles.summaryItem}>
                  <Text style={[styles.summaryNum, { color }]}>{statusResults.filter(r => r.status === key).length}</Text>
                  <Text style={styles.summaryLabel}>{label}</Text>
                </View>
              ))}
            </View>
          )}

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
                  const applyResult = results.find(r => r.username === acc.username);
                  const statusResult = statusResults.find(r => r.username === acc.username);
                  const activeResult = activeTab === 'apply' ? applyResult : statusResult;

                  return (
                    <TouchableOpacity key={index} style={[styles.accountCard, !enabled && { opacity: 0.5 }]}
                      onPress={() => !isApplying && !isCheckingStatus && toggleAccount(index)}
                      disabled={isApplying || isCheckingStatus}>
                      <View style={[styles.accountAvatar, { backgroundColor: enabled ? COLORS.accent : COLORS.surface }]}>
                        <Text style={styles.avatarText}>{(acc.nickname || '?')[0].toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.accountName}>{acc.nickname || acc.username}</Text>
                        <Text style={styles.accountDp} numberOfLines={1}>{acc.dpName}</Text>
                        {activeResult?.error ? <Text style={styles.resultError}>{activeResult.error}</Text> : null}
                        {activeResult?.status && activeResult.status !== 'pending' && activeResult.status !== 'checking' && activeResult.status !== 'applying' && activeResult.status !== 'error' ? (
                           <Text style={[styles.statusLabel, { color: (STATUS_CONFIG[activeResult.status] || STATUS_CONFIG.unknown).color }]}>{(STATUS_CONFIG[activeResult.status] || STATUS_CONFIG.unknown).label}</Text>
                        ) : null}
                      </View>

                      <TouchableOpacity
                        onPress={() => setDashboardAccount(acc)}
                        style={{ marginRight: 10, padding: 8, backgroundColor: COLORS.primary, borderRadius: 20 }}
                      >
                        <Ionicons name="stats-chart" size={16} color={COLORS.text} />
                      </TouchableOpacity>

                      {activeResult ? (
                        <View style={{ alignItems: 'center', width: 24 }}>
                          {activeResult.status === 'applying' || activeResult.status === 'checking'
                            ? <ActivityIndicator size="small" color="#2196F3" />
                            : <Ionicons name={(STATUS_CONFIG[activeResult.status] || STATUS_CONFIG.unknown).icon} size={24} color={(STATUS_CONFIG[activeResult.status] || STATUS_CONFIG.unknown).color} />}
                        </View>
                      ) : (
                        <Ionicons name={enabled ? 'checkbox' : 'square-outline'} size={24} color={enabled ? '#4CAF50' : '#ccc'} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )
          }

          {/* Action Buttons */}
          <View style={{ paddingBottom: 100, gap: 12 }}>
            {activeTab === 'apply' ? (
              results.length > 0 && !isApplying ? (
                <TouchableOpacity style={[styles.applyBtn, { backgroundColor: COLORS.accent }]} onPress={resetScreen}>
                  <Ionicons name="refresh" size={20} color="#fff" />
                  <Text style={styles.applyBtnText}>Done / Reset</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.applyBtn, (!selectedIssue || accounts.length === 0) && { opacity: 0.4 }]}
                  onPress={handleApply}
                  disabled={!selectedIssue || accounts.length === 0 || isApplying}
                >
                  <MaterialCommunityIcons name="send" size={20} color="#fff" />
                  <Text style={styles.applyBtnText}>Apply for All Selected</Text>
                </TouchableOpacity>
              )
            ) : (
              statusResults.length > 0 && !isCheckingStatus ? (
                <TouchableOpacity style={[styles.checkBtn, { backgroundColor: COLORS.accent }]} onPress={resetScreen}>
                  <Ionicons name="refresh" size={20} color="#fff" />
                  <Text style={styles.checkBtnText}>Done / Reset</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.checkBtn, (!selectedIssue || accounts.length === 0) && { opacity: 0.4 }]}
                  onPress={handleCheckStatus}
                  disabled={!selectedIssue || accounts.length === 0 || isCheckingStatus}
                >
                  <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
                  <Text style={styles.checkBtnText}>Check Status for All</Text>
                </TouchableOpacity>
              )
            )}
          </View>
        </ScrollView>
      )}

      {/* Issue Picker Modal */}
      <Modal
        visible={showIssuePicker}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Text style={styles.pickerTitle}>Select Open IPO</Text>
            {issuesLoading
              ? <ActivityIndicator style={{ marginTop: 30 }} color={COLORS.accent} size="large" />
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
                        {item.shareTypeName || item.shareType} • Closes: {item.issueCloseDate || item.closeDate || item.closeShareDate || 'N/A'}
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

      {/* Account Dashboard */}
      {dashboardAccount && (
        <AccountDashboardModal
          account={dashboardAccount}
          onClose={() => setDashboardAccount(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { color: '#fff', fontWeight: 'bold', fontSize: 18, marginLeft: 8 },
  closeBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: COLORS.mutedText, letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  issueSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: COLORS.border, elevation: 1 },
  issueSelected: { fontWeight: '700', fontSize: 15, color: COLORS.text },
  issueSubtext: { fontSize: 12, color: COLORS.mutedText, marginTop: 2 },
  issuePlaceholder: { flex: 1, color: COLORS.mutedText, fontSize: 14 },
  kittaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  kittaChip: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  kittaChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  kittaChipText: { fontSize: 14, color: COLORS.mutedText, fontWeight: '600' },
  kittaChipTextActive: { color: '#fff' },
  kittaInput: { flex: 1, minWidth: 100, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: COLORS.surface, color: COLORS.text, fontWeight: 'bold', textAlign: 'center' },
  kittaInputActive: { borderColor: COLORS.accent, backgroundColor: COLORS.surface },
  emptyAccounts: { alignItems: 'center', paddingVertical: 40, opacity: 0.6 },
  accountCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, marginBottom: 8, elevation: 1 },
  accountAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  accountName: { fontWeight: '700', fontSize: 14, color: COLORS.text },
  accountDp: { fontSize: 11, color: COLORS.mutedText, marginTop: 1 },
  applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 16, marginTop: 8, gap: 8 },
  applyBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  checkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 16, marginTop: 8, gap: 8 },
  checkBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1565C0', paddingHorizontal: 16, paddingVertical: 12 },
  statusHeaderText: { color: '#fff', fontWeight: '700', fontSize: 15, flex: 1 },
  // Results
  summaryBar: { flexDirection: 'row', backgroundColor: COLORS.surface, paddingVertical: 12 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: 24, fontWeight: 'bold' },
  summaryLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  progressBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2196F3', paddingHorizontal: 16, paddingVertical: 10 },
  resultRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, marginBottom: 10, elevation: 1 },
  resultAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  resultName: { fontWeight: '700', fontSize: 14, color: COLORS.text },
  resultUser: { fontSize: 12, color: COLORS.mutedText },
  resultError: { fontSize: 11, color: '#F44336', marginTop: 2 },
  statusLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  tabsContainer: { flexDirection: 'row', backgroundColor: COLORS.surface, elevation: 2, zIndex: 5 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: COLORS.accent },
  tabText: { fontSize: 14, fontWeight: '700', color: COLORS.mutedText },
  activeTabText: { color: COLORS.text },
  doneBtn: { margin: 16, backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Issue picker
  pickerOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: COLORS.primary, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingTop: 16 },
  pickerTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 12, color: COLORS.text },
  issueItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  issueItemName: { fontWeight: '700', fontSize: 15, color: COLORS.text },
  issueItemSub: { fontSize: 12, color: COLORS.mutedText, marginTop: 3 },
  pickerClose: { margin: 12, padding: 14, backgroundColor: '#eee', borderRadius: 10, alignItems: 'center' },
});
