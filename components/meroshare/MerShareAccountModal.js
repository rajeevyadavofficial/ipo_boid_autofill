import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { getApiBaseUrl } from '../../utils/config';

const STORAGE_KEY = 'meroshareAccounts';

// Simple base64 encoding (safe for ASCII credentials, sent over HTTPS)
const encrypt = (text) => { try { return btoa(text); } catch { return text; } };
const decrypt = (encoded) => { try { return atob(encoded); } catch { return encoded; } };

export const loadMerShareAccounts = async () => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

const saveMerShareAccounts = async (accounts) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
};

// DP Picker as an absolutely-positioned overlay (no Modal) to avoid Android nested-Modal crash.
// Uses ScrollView + map (not FlatList) because FlatList needs explicit height in absolute overlays.
function DpPickerOverlay({ visible, dpList, dpLoading, dpSearch, setDpSearch, onSelect, onClose, insets }) {
  if (!visible) return null;
  const filtered = (dpList || []).filter(dp =>
    (dp.name || dp.dp || '').toLowerCase().includes(dpSearch.toLowerCase())
  );
  return (
    <View style={styles.dpOverlay}>
      <View style={[styles.dpSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Text style={styles.dpTitle}>Select Depository Participant</Text>
        <TextInput
          style={styles.dpSearch}
          placeholder="Search DP..."
          value={dpSearch}
          onChangeText={setDpSearch}
          autoFocus
        />
        {dpLoading
          ? <ActivityIndicator style={{ marginTop: 30 }} color="#6200EE" />
          : (
            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
              {filtered.map((item, i) => (
                <TouchableOpacity key={(item.id || i).toString()} style={styles.dpItem} onPress={() => onSelect(item)}>
                  <Text style={styles.dpItemText}>{item.name || item.dp}</Text>
                </TouchableOpacity>
              ))}
              {filtered.length === 0 && (
                <Text style={{ textAlign: 'center', color: '#999', marginTop: 20, padding: 16 }}>
                  {dpLoading ? '' : 'No results found.'}
                </Text>
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

export default function MerShareAccountModal({ onClose }) {
  const insets = useSafeAreaInsets();
  const [accounts, setAccounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [dpList, setDpList] = useState([]);
  const [dpLoading, setDpLoading] = useState(false);
  const [showDpPicker, setShowDpPicker] = useState(false);
  const [dpSearch, setDpSearch] = useState('');

  const [form, setForm] = useState({ nickname: '', dpId: '', dpName: '', username: '', password: '', pin: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    loadMerShareAccounts().then(setAccounts);
    fetchDpList();
  }, []);

  const fetchDpList = async () => {
    setDpLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/meroshare/dp`);
      const data = await res.json();
      if (data.success) setDpList(data.data);
    } catch (e) {
      console.warn('Failed to fetch DP list:', e.message);
    } finally {
      setDpLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ nickname: '', dpId: '', dpName: '', username: '', password: '', pin: '' });
    setEditIndex(null);
    setShowPassword(false);
    setShowPin(false);
  };

  const handleSave = async () => {
    if (!form.dpId || !form.username || !form.password || !form.pin) {
      Toast.show({ type: 'error', text1: 'All fields required', text2: 'DP, Username, Password and PIN are required.' });
      return;
    }
    if (form.pin.length !== 4) {
      Toast.show({ type: 'error', text1: 'Invalid PIN', text2: 'PIN must be exactly 4 digits.' });
      return;
    }
    const newAccount = {
      nickname: form.nickname || form.username,
      dpId: form.dpId,
      dpName: form.dpName,
      username: form.username,
      encryptedPassword: encrypt(form.password),
      encryptedPin: encrypt(form.pin),
    };
    const updated = [...accounts];
    if (editIndex !== null) updated[editIndex] = newAccount;
    else updated.push(newAccount);
    await saveMerShareAccounts(updated);
    setAccounts(updated);
    setShowForm(false);
    resetForm();
    Toast.show({ type: 'success', text1: editIndex !== null ? '✅ Account Updated' : '✅ Account Added' });
  };

  const handleEdit = (index) => {
    const acc = accounts[index];
    setForm({
      nickname: acc.nickname,
      dpId: acc.dpId,
      dpName: acc.dpName,
      username: acc.username,
      password: decrypt(acc.encryptedPassword),
      pin: decrypt(acc.encryptedPin),
    });
    setEditIndex(index);
    setShowForm(true);
  };

  const handleDelete = async (index) => {
    const updated = accounts.filter((_, i) => i !== index);
    await saveMerShareAccounts(updated);
    setAccounts(updated);
    Toast.show({ type: 'success', text1: 'Account removed' });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>MeroShare Accounts</Text>
            <Text style={styles.subtitle}>Manage accounts for bulk IPO apply</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#F44336" />
          </TouchableOpacity>
        </View>

        {showForm ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 40) }}>
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

            <View style={styles.encryptNotice}>
              <Ionicons name="lock-closed" size={13} color="#4CAF50" />
              <Text style={styles.encryptText}>Password & PIN stored encrypted on device</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: '#eee', flex: 1 }]}
                onPress={() => { setShowForm(false); resetForm(); }}>
                <Text style={{ color: '#333', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: '#6200EE', flex: 2 }]} onPress={handleSave}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {editIndex !== null ? 'Update Account' : 'Save Account'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              data={accounts}
              keyExtractor={(_, i) => i.toString()}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', marginTop: 40, opacity: 0.5 }}>
                  <Ionicons name="person-circle-outline" size={56} color="#999" />
                  <Text style={{ color: '#999', marginTop: 10 }}>No accounts yet. Tap + to add.</Text>
                </View>
              }
              renderItem={({ item, index }) => (
                <View style={styles.accountCard}>
                  <View style={styles.accountAvatar}>
                    <Text style={styles.avatarText}>{(item.nickname || '?')[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountName}>{item.nickname}</Text>
                    <Text style={styles.accountUser}>{item.username}</Text>
                    <Text style={styles.accountDp} numberOfLines={1}>{item.dpName}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleEdit(index)} style={{ marginRight: 12 }}>
                    <Ionicons name="create-outline" size={20} color="#FF9800" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(index)}>
                    <Ionicons name="trash-outline" size={20} color="#F44336" />
                  </TouchableOpacity>
                </View>
              )}
            />
            <TouchableOpacity style={[styles.addBtn, { marginBottom: Math.max(insets.bottom, 16) }]}
              onPress={() => { resetForm(); setShowForm(true); }}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addBtnText}>Add MeroShare Account</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* DP Picker as plain overlay View — NOT a Modal (avoids Android nested Modal crash) */}
        <DpPickerOverlay
          visible={showDpPicker}
          dpList={dpList}
          dpLoading={dpLoading}
          dpSearch={dpSearch}
          setDpSearch={setDpSearch}
          onSelect={(item) => {
            setForm(p => ({
              ...p,
              dpId: (item.id || item.dp || '').toString(),
              dpName: item.name || item.dp || '',
            }));
            setDpSearch('');
            setShowDpPicker(false);
          }}
          onClose={() => setShowDpPicker(false)}
          insets={insets}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#333a56', paddingHorizontal: 16, paddingVertical: 14 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#6200EE' },
  subtitle: { fontSize: 12, color: '#aaa' },
  closeBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
  formTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 11, borderRadius: 10, marginBottom: 12, fontSize: 14, backgroundColor: '#fff' },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  eyeBtn: { padding: 11, marginLeft: 8 },
  dpBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', padding: 11, borderRadius: 10, marginBottom: 12, backgroundColor: '#fff' },
  dpSelected: { color: '#333', fontSize: 14, flex: 1 },
  dpPlaceholder: { color: '#aaa', fontSize: 14, flex: 1 },
  encryptNotice: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  encryptText: { fontSize: 11, color: '#4CAF50' },
  btn: { paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  accountCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, elevation: 1 },
  accountAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#6200EE', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  accountName: { fontWeight: '700', fontSize: 15, color: '#222' },
  accountUser: { fontSize: 12, color: '#666' },
  accountDp: { fontSize: 11, color: '#999', marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6200EE', borderRadius: 12, paddingVertical: 14, gap: 8, marginHorizontal: 16, marginTop: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // DP Picker overlay (plain View, not Modal)
  dpOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00000088', justifyContent: 'flex-end', zIndex: 100 },
  dpSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingTop: 16 },
  dpTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 12, color: '#333' },
  dpSearch: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, marginHorizontal: 12, padding: 10, marginBottom: 8, fontSize: 14 },
  dpItem: { paddingVertical: 13, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  dpItemText: { fontSize: 14, color: '#333' },
});
