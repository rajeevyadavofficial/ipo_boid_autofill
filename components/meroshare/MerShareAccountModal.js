import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Platform,
  KeyboardAvoidingView, Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { getApiBaseUrl } from '../../utils/config';
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

const encrypt = (text) => { try { return btoa(text); } catch { return text; } };
const decrypt = (encoded) => { try { return atob(encoded); } catch { return encoded; } };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, paddingHorizontal: 16, paddingVertical: 14 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 12, color: '#aaa' },
  closeBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
  formTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.mutedText, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: COLORS.border, padding: 11, borderRadius: 10, marginBottom: 12, fontSize: 14, backgroundColor: COLORS.surface, color: COLORS.text },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  eyeBtn: { padding: 11, marginLeft: 8 },
  dpBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, padding: 11, borderRadius: 10, marginBottom: 12, backgroundColor: COLORS.surface },
  dpSelected: { color: COLORS.text, fontSize: 14, flex: 1 },
  dpPlaceholder: { color: COLORS.mutedText, fontSize: 14, flex: 1 },
  encryptNotice: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  encryptText: { fontSize: 11, color: '#4CAF50' },
  btn: { paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  accountCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, marginBottom: 10, elevation: 1 },
  accountAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  accountName: { fontWeight: '700', fontSize: 15, color: COLORS.text },
  accountUser: { fontSize: 12, color: COLORS.mutedText },
  accountDp: { fontSize: 11, color: COLORS.mutedText, marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 14, gap: 8, marginHorizontal: 16, marginTop: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  dpOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00000088', justifyContent: 'flex-end', zIndex: 999 },
  dpSheet: { backgroundColor: COLORS.primary, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '80%', paddingTop: 16, width: '100%' },
  dpTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 12, color: COLORS.text },
  dpSearch: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, marginHorizontal: 12, padding: 10, marginBottom: 8, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.surface },
  dpItem: { paddingVertical: 13, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dpItemText: { fontSize: 14, color: COLORS.text },
  securityAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
    gap: 10
  },
  securityAlertText: { fontSize: 12, color: COLORS.text, flex: 1, lineHeight: 17, fontWeight: '500' },
});

export const loadMerShareAccounts = async () => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

export const saveMerShareAccounts = async (accounts) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
};

function DpPickerOverlay({ visible, dpList, dpLoading, dpSearch, setDpSearch, onSelect, onClose, onRetry, insets }) {
  if (!visible) return null;

  // Broad filter that checks all string values in the DP object
  const filtered = (dpList || []).filter(dp => {
    if (!dp) return false;
    const search = (dpSearch || '').toLowerCase();
    if (!search) return true;
    return Object.values(dp).some(val =>
      String(val).toLowerCase().includes(search)
    );
  });

  return (
    <View style={styles.dpOverlay}>
      <View style={[styles.dpSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Text style={styles.dpTitle}>Select Depository Participant</Text>
        <TextInput
          style={styles.dpSearch}
          placeholder="Search DP (e.g. Global, NIBL)..."
          value={dpSearch}
          onChangeText={setDpSearch}
        />
        {dpLoading
          ? (
            <View style={{ padding: 40 }}>
              <ActivityIndicator color={COLORS.accent} size="large" />
              <Text style={{ textAlign: 'center', marginTop: 10, color: '#666' }}>Fetching broker list...</Text>
            </View>
          )
          : (
            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
              {filtered.map((item, i) => (
                <TouchableOpacity key={(item?.id || item?.code || i).toString()} style={styles.dpItem} onPress={() => onSelect(item)}>
                  <Text style={styles.dpItemText}>{item?.name || item?.capitalName || item?.dp || `Broker ${item?.id || item?.code || i}`}</Text>
                  <Text style={{ fontSize: 10, color: '#999' }}>Code: {item?.code || item?.id}</Text>
                </TouchableOpacity>
              ))}
              {filtered.length === 0 && (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Ionicons name="alert-circle-outline" size={48} color="#ccc" />
                  <Text style={{ textAlign: 'center', color: '#999', marginTop: 20 }}>No results found.</Text>
                  <TouchableOpacity
                    onPress={onRetry}
                    style={{ marginTop: 15, backgroundColor: '#f0f0f0', padding: 10, borderRadius: 8 }}
                  >
                    <Text style={{ color: COLORS.text, fontWeight: '700' }}>Retry Fetching List</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )
        }
        <TouchableOpacity style={[styles.btn, { backgroundColor: '#eee', margin: 12 }]} onPress={onClose}>
          <Text style={{ color: '#333', fontWeight: '600' }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function MerShareAccountModal({ onClose, embedded = false, onAccountsChange, onAccountsPersisted }) {
  const insets = useSafeAreaInsets();
  const [accounts, setAccounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [dpList, setDpList] = useState([]);
  const [dpLoading, setDpLoading] = useState(false);
  const [showDpPicker, setShowDpPicker] = useState(false);
  const [dpSearch, setDpSearch] = useState('');
  const [dashboardAccount, setDashboardAccount] = useState(null); // for account detail view

  const [form, setForm] = useState({ nickname: '', dpId: '', dpName: '', username: '', password: '', pin: '', crnNumber: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null); // null, 'verifying', 'success', 'error'
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    loadMerShareAccounts().then(setAccounts);
    fetchDpList();
  }, []);

  useEffect(() => {
    if (onAccountsChange) {
      onAccountsChange(accounts);
    }
  }, [accounts, onAccountsChange]);

  const fetchDpList = async () => {
    if (dpLoading) return;
    setDpLoading(true);
    try {
      console.log('🔗 Fetching DP list from:', `${getApiBaseUrl()}/meroshare/dp`);
      const res = await fetch(`${getApiBaseUrl()}/meroshare/dp`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        console.log(`✅ Fetched ${data.data.length} brokers`);
        setDpList(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch brooker list');
      }
    } catch (e) {
      console.warn('Failed to fetch DP list:', e.message);
      Toast.show({ type: 'error', text1: 'Broker List Error', text2: e.message || 'Check your internet connection' });
    } finally {
      setDpLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ nickname: '', dpId: '', dpName: '', username: '', password: '', pin: '', crnNumber: '' });
    setEditIndex(null);
    setShowPassword(false);
    setShowPin(false);
    setVerificationStatus(null);
    setIsVerifying(false);
  };

  const handleSave = async () => {
    const cleanUsername = (form.username || '').trim();
    const cleanPassword = (form.password || '').trim();
    const cleanCrn = (form.crnNumber || '').trim();
    const cleanPin = (form.pin || '').trim();

    if (!form.dpId || !cleanUsername || !cleanPassword || !cleanPin || !cleanCrn) {
      Toast.show({ type: 'error', text1: 'All fields required', text2: 'DP, Username, Password, PIN and CRN are required.' });
      return;
    }
    if (cleanPin.length !== 4) {
      Toast.show({ type: 'error', text1: 'Invalid PIN', text2: 'PIN must be exactly 4 digits.' });
      return;
    }

    setIsVerifying(true);
    setVerificationStatus('verifying');
    console.log('🚀 [Save] Starting verification for:', form.username);

    try {
      const response = await fetch(`${getApiBaseUrl()}/meroshare/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: parseInt(form.dpId),
          username: cleanUsername,
          password: cleanPassword,
        }),
      });
      const verification = await response.json();

      if (!response.ok || !verification.success) {
        setVerificationStatus('error');
        Toast.show({
          type: 'error',
          text1: 'Verification Failed',
          text2: verification.error || 'Please check your DP, Username and Password.'
        });
        return;
      }

      // Success branch
      setVerificationStatus('success');

      const newAccount = {
        nickname: form.nickname.trim() || cleanUsername,
        dpId: form.dpId,
        dpName: form.dpName,
        username: cleanUsername,
        crnNumber: cleanCrn,
        encryptedPassword: encrypt(cleanPassword),
        encryptedPin: encrypt(cleanPin),
      };

      const updated = [...accounts];
      if (editIndex !== null) updated[editIndex] = newAccount;
      else updated.push(newAccount);

      await saveMerShareAccounts(updated);
      setAccounts(updated);
      await onAccountsPersisted?.(updated);

      // Brief delay to let user see "Verified" status
      setTimeout(() => {
        setShowForm(false);
        resetForm();
        Toast.show({ type: 'success', text1: editIndex !== null ? '✅ Account Updated' : '✅ Account Verified & Saved' });
      }, 1000);

    } catch (err) {
      console.error('❌ [Save] Error during verification:', err.message);
      setVerificationStatus('error');
      Toast.show({
        type: 'error',
        text1: 'Connection Error',
        text2: err.message || 'Verification failed. Please try again.'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleEdit = (index) => {
    const acc = accounts[index];
    setForm({
      nickname: acc.nickname,
      dpId: acc.dpId,
      dpName: acc.dpName,
      username: acc.username,
      password: decrypt(acc.encryptedPassword || ''),
      pin: decrypt(acc.encryptedPin || ''),
      crnNumber: acc.crnNumber || '',
    });
    setEditIndex(index);
    setShowForm(true);
  };

  const handleDelete = async (index) => {
    const updated = accounts.filter((_, i) => i !== index);
    await saveMerShareAccounts(updated);
    setAccounts(updated);
    await onAccountsPersisted?.(updated);
    Toast.show({ type: 'success', text1: 'Account removed' });
  };

  const openRawDataInBrowser = async (acc) => {
    try {
      const password = decrypt(acc.encryptedPassword || '');
      Toast.show({ type: 'info', text1: '⏳ Fetching data...', text2: 'Opening in browser (~4 seconds)', visibilityTime: 5000 });
      const res = await fetch(`${getApiBaseUrl()}/meroshare/raw-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: parseInt(acc.dpId), username: acc.username, password }),
      });
      const json = await res.json();
      if (!res.ok || !json.viewUrl) {
        Toast.show({ type: 'error', text1: 'Failed', text2: json.error || 'Could not fetch data' });
        return;
      }
      // Open the token URL directly — works in Chrome, Edge, any browser
      window.open(json.viewUrl, '_blank');
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message });
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        {!embedded && (
          <>
            <StatusBar style="light" backgroundColor={COLORS.primary} />
            <View style={{ height: insets.top, backgroundColor: COLORS.primary }} />
          </>
        )}



        {showForm ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 40) }}>
            <View style={styles.securityAlert}>
              <Ionicons name="shield-checkmark" size={20} color="#2196F3" />
              <Text style={styles.securityAlertText}>
                Your data is safe. MeroShare credentials are encrypted locally on your phone using industry standards.
              </Text>
            </View>
            <Text style={styles.formTitle}>{editIndex !== null ? 'Edit Account' : 'Add MeroShare Account'}</Text>

            <Text style={styles.label}>Nickname (optional)</Text>
            <TextInput style={styles.input} placeholder="e.g. Dad's Account"
              value={form.nickname} onChangeText={v => setForm(p => ({ ...p, nickname: v }))} />

            <Text style={styles.label}>Depository Participant *</Text>
            <TouchableOpacity style={styles.dpBtn} onPress={() => setShowDpPicker(true)}>
              <Text style={form.dpName ? styles.dpSelected : styles.dpPlaceholder}>
                {form.dpName || 'Select your DP (broker)'}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#666" />
            </TouchableOpacity>

            <Text style={styles.label}>Username *</Text>
            <TextInput style={styles.input} placeholder="MeroShare username"
              value={form.username} onChangeText={v => setForm(p => ({ ...p, username: v }))}
              autoCapitalize="none" />

            <Text style={styles.label}>Password *</Text>
            <View style={styles.inputRow}>
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="MeroShare password"
                secureTextEntry={!showPassword}
                value={form.password} onChangeText={v => setForm(p => ({ ...p, password: v }))}
                autoCapitalize="none" />
              <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Transaction PIN * (4 digits)</Text>
            <View style={styles.inputRow}>
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0, letterSpacing: 8 }]}
                placeholder="••••"
                secureTextEntry={!showPin}
                keyboardType="number-pad"
                maxLength={4}
                value={form.pin} onChangeText={v => setForm(p => ({ ...p, pin: v }))} />
              <TouchableOpacity onPress={() => setShowPin(p => !p)} style={styles.eyeBtn}>
                <Ionicons name={showPin ? 'eye-off' : 'eye'} size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>CRN Number *</Text>
            <TextInput style={styles.input} placeholder="Enter your CRN number"
              value={form.crnNumber} onChangeText={v => setForm(p => ({ ...p, crnNumber: v }))}
              autoCapitalize="characters" />

            <View style={styles.encryptNotice}>
              <Ionicons name="lock-closed" size={13} color="#4CAF50" />
              <Text style={styles.encryptText}>Password & PIN stored encrypted on device</Text>
            </View>

            <View style={{ marginTop: 16 }}>
              {verificationStatus === 'verifying' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, gap: 8 }}>
                  <ActivityIndicator size="small" color={COLORS.accent} />
                  <Text style={{ color: COLORS.text, fontWeight: '600' }}>Verifying Account...</Text>
                </View>
              )}
              {verificationStatus === 'success' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                  <Text style={{ color: '#4CAF50', fontWeight: '700' }}>Verification Successful!</Text>
                </View>
              )}
              {verificationStatus === 'error' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, gap: 8 }}>
                  <Ionicons name="close-circle" size={18} color="#F44336" />
                  <Text style={{ color: '#F44336', fontWeight: '700' }}>Verification Failed</Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: '#eee', flex: 1 }]}
                  onPress={() => { setShowForm(false); resetForm(); }}>
                  <Text style={{ color: '#333', fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: COLORS.accent, flex: 2, opacity: isVerifying ? 0.7 : 1 }]}
                  onPress={handleSave}
                  disabled={isVerifying || verificationStatus === 'success'}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    {verificationStatus === 'verifying' ? 'Verifying...' :
                     verificationStatus === 'success' ? 'Verified ✓' :
                     (editIndex !== null ? 'Update Account' : 'Save Account')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
              keyboardShouldPersistTaps="handled"
            >
              {accounts.length > 0 && (
                <View style={styles.securityAlert}>
                  <Ionicons name="lock-closed" size={20} color={COLORS.accent} />
                  <Text style={styles.securityAlertText}>
                    All saved accounts are encrypted and verified. Only you can access your credentials.
                  </Text>
                </View>
              )}
              {accounts.map((item, index) => (
                <View key={index.toString()} style={styles.accountCard}>
                  <View style={styles.accountAvatar}>
                    <Text style={styles.avatarText}>{(item.nickname || '?')[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountName}>{item.nickname}</Text>
                    <Text style={styles.accountUser}>{item.username}</Text>
                    <Text style={styles.accountDp} numberOfLines={1}>{item.dpName}</Text>
                  </View>

                  <TouchableOpacity onPress={() => handleEdit(index)} style={{ marginRight: 8 }}>
                    <Ionicons name="create-outline" size={20} color="#FF9800" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(index)}>
                    <Ionicons name="trash-outline" size={20} color="#F44336" />
                  </TouchableOpacity>
                </View>
              ))}
              {accounts.length === 0 && (
                <View style={{ alignItems: 'center', marginTop: 40, opacity: 0.5 }}>
                  <Ionicons name="person-circle-outline" size={56} color="#999" />
                  <Text style={{ color: '#999', marginTop: 10 }}>No accounts yet. Tap + to add.</Text>
                </View>
              )}
            </ScrollView>
            <TouchableOpacity style={[styles.addBtn, { marginBottom: Math.max(insets.bottom, 16) }]}
              onPress={() => { resetForm(); setShowForm(true); }}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addBtnText}>Add MeroShare Account</Text>
            </TouchableOpacity>
          </View>
        )}

        <DpPickerOverlay
          visible={showDpPicker}
          dpList={dpList}
          dpLoading={dpLoading}
          dpSearch={dpSearch}
          setDpSearch={setDpSearch}
          onRetry={fetchDpList}
          onSelect={(item) => {
            if (item) {
              setForm(p => ({
                ...p,
                dpId: (item.id || item.dp || item.code || '').toString(),
                dpName: item.name || item.capitalName || item.dp || '',
              }));
            }
            setDpSearch('');
            setShowDpPicker(false);
          }}
          onClose={() => setShowDpPicker(false)}
          insets={insets}
        />

        {/* Account Dashboard Modal */}
        {dashboardAccount && (
          <AccountDashboardModal
            account={dashboardAccount}
            onClose={() => setDashboardAccount(null)}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
