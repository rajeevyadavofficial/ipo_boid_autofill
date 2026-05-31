import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BoidModal from '../boid/BoidModal';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import GoogleSignIn from '../GoogleSignIn';
import MerShareAccountModal, { loadMerShareAccounts, saveMerShareAccounts } from '../meroshare/MerShareAccountModal';
import { useBoidSync } from '../../hooks/useBoidSync';
import { COLORS } from '../../utils/theme';

const BACKUP_STATE_KEY = 'accountManagerBackupState';

export default function AccountManagerScreen({ visible, boidProps, onGoogleAccountReady }) {
  const insets = useSafeAreaInsets();
  const {
    syncToCloud,
    syncMeroshareAccountsToCloud,
    syncMeroshareAccountsFromCloud,
    syncing,
  } = useBoidSync();
  const lastMeroshareSyncGoogleIdRef = useRef(null);
  const [activeTab, setActiveTab] = useState('Boids');
  const [googleUser, setGoogleUser] = useState(null);
  const [meroshareAccounts, setMeroshareAccounts] = useState([]);
  const [backupSaved, setBackupSaved] = useState(false);
  const [showBackupSection, setShowBackupSection] = useState(false);

  const getMeroshareAccountKey = (account) => (
    `${account?.dpId || ''}|${account?.username || ''}|${account?.crnNumber || ''}`
  );

  const mergeMeroshareAccounts = (localAccounts = [], cloudAccounts = []) => {
    const merged = Array.isArray(cloudAccounts) ? [...cloudAccounts] : [];
    (Array.isArray(localAccounts) ? localAccounts : []).forEach((localAccount) => {
      const localKey = getMeroshareAccountKey(localAccount);
      if (!localKey.replace(/\|/g, '')) return;
      const exists = merged.some((cloudAccount) => getMeroshareAccountKey(cloudAccount) === localKey);
      if (!exists) merged.push(localAccount);
    });
    return merged;
  };

  const buildBackupSnapshot = useCallback((boids, accounts) => JSON.stringify({
    boids: Array.isArray(boids) ? boids : [],
    meroshareAccounts: Array.isArray(accounts) ? accounts : [],
  }), []);

  const markBackupSaved = useCallback(async (googleId, accounts) => {
    if (!googleId) return;
    await AsyncStorage.setItem(BACKUP_STATE_KEY, JSON.stringify({
      googleId,
      snapshot: buildBackupSnapshot(boidProps?.savedBoids, accounts),
    }));
    setBackupSaved(true);
  }, [boidProps?.savedBoids, buildBackupSnapshot]);

  const autoSyncMeroshareAccounts = useCallback(async (user, options = {}) => {
    const googleId = user?.googleId;
    if (!googleId) return;
    if (!options.force && lastMeroshareSyncGoogleIdRef.current === googleId) return;

    try {
      const localAccounts = await loadMerShareAccounts();
      const cloudResult = await syncMeroshareAccountsFromCloud(googleId);
      if (!cloudResult.success) throw new Error(cloudResult.error || 'Failed to load MeroShare cloud backup');

      const cloudAccounts = Array.isArray(cloudResult.accounts) ? cloudResult.accounts : [];
      const mergedAccounts = mergeMeroshareAccounts(localAccounts, cloudAccounts);
      await saveMerShareAccounts(mergedAccounts);
      setMeroshareAccounts(mergedAccounts);

      if (JSON.stringify(mergedAccounts) !== JSON.stringify(cloudAccounts)) {
        const uploadResult = await syncMeroshareAccountsToCloud(mergedAccounts, googleId);
        if (!uploadResult.success) throw new Error(uploadResult.error || 'Failed to save MeroShare backup');
      }
      await markBackupSaved(googleId, mergedAccounts);
      lastMeroshareSyncGoogleIdRef.current = googleId;
    } catch (error) {
      console.warn('Auto MeroShare sync failed:', error.message);
      Toast.show({ type: 'error', text1: 'MeroShare backup failed', text2: error.message });
    }
  }, [markBackupSaved, syncMeroshareAccountsFromCloud, syncMeroshareAccountsToCloud]);

  const syncAllAccountDataToCloud = useCallback(async (user) => {
    const googleId = user?.googleId;
    if (!googleId) return;

    const boids = Array.isArray(boidProps?.savedBoids) ? boidProps.savedBoids : [];
    const latestMeroshareAccounts = await loadMerShareAccounts();

    const boidResult = await syncToCloud(boids, googleId);
    if (!boidResult.success) throw new Error(boidResult.error || 'Failed to save BOID backup');

    const meroshareResult = await syncMeroshareAccountsToCloud(latestMeroshareAccounts, googleId);
    if (!meroshareResult.success) throw new Error(meroshareResult.error || 'Failed to save MeroShare backup');

    setMeroshareAccounts(latestMeroshareAccounts);
    await markBackupSaved(googleId, latestMeroshareAccounts);
  }, [boidProps?.savedBoids, markBackupSaved, syncMeroshareAccountsToCloud, syncToCloud]);

  useEffect(() => {
    const loadData = async () => {
      const userData = await AsyncStorage.getItem('googleUser');
      const parsedUser = userData ? JSON.parse(userData) : null;
      const latestMeroshareAccounts = await loadMerShareAccounts();
      const currentSnapshot = buildBackupSnapshot(boidProps?.savedBoids, latestMeroshareAccounts);
      const backupStateRaw = await AsyncStorage.getItem(BACKUP_STATE_KEY);
      const backupState = backupStateRaw ? JSON.parse(backupStateRaw) : null;

      setGoogleUser(parsedUser);
      setMeroshareAccounts(latestMeroshareAccounts);
      setBackupSaved(Boolean(
        parsedUser?.googleId &&
        backupState?.googleId === parsedUser.googleId &&
        backupState?.snapshot === currentSnapshot
      ));
    };

    loadData();
  }, [boidProps?.savedBoids, visible]);

  useEffect(() => {
    if (visible && googleUser?.googleId) {
      autoSyncMeroshareAccounts(googleUser);
      onGoogleAccountReady?.(googleUser);
    }
  }, [autoSyncMeroshareAccounts, googleUser, onGoogleAccountReady, visible]);

  const handleBackup = async () => {
    try {
      if (!googleUser?.googleId) {
        Toast.show({ type: 'info', text1: 'Sign in first', text2: 'Use Google sign-in before saving your backup.' });
        return;
      }

      const boids = Array.isArray(boidProps?.savedBoids) ? boidProps.savedBoids : [];
      const latestMeroshareAccounts = await loadMerShareAccounts();

      const boidResult = await syncToCloud(boids, googleUser.googleId);
      if (!boidResult.success) throw new Error(boidResult.error || 'Failed to save BOID backup');

      const meroshareResult = await syncMeroshareAccountsToCloud(latestMeroshareAccounts, googleUser.googleId);
      if (!meroshareResult.success) throw new Error(meroshareResult.error || 'Failed to save MeroShare backup');

      setMeroshareAccounts(latestMeroshareAccounts);
      await markBackupSaved(googleUser.googleId, latestMeroshareAccounts);
      Toast.show({ type: 'success', text1: 'Backup saved', text2: 'BOIDs and MeroShare details were backed up securely.' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Backup failed', text2: error.message });
    }
  };

  const handleMeroshareAccountsPersisted = useCallback(async (accounts) => {
    setMeroshareAccounts(accounts);
    setBackupSaved(false);

    if (!googleUser?.googleId) return;

    const result = await syncMeroshareAccountsToCloud(accounts, googleUser.googleId);
    if (result.success) {
      await markBackupSaved(googleUser.googleId, accounts);
      return;
    }

    Toast.show({
      type: 'error',
      text1: 'MeroShare backup failed',
      text2: result.error || 'Please tap Backup to try again.',
    });
  }, [googleUser?.googleId, markBackupSaved, syncMeroshareAccountsToCloud]);

  const wrappedBoidProps = useMemo(() => ({
    ...boidProps,
    setSavedBoids: (value) => {
      setBackupSaved(false);
      if (typeof boidProps?.setSavedBoids === 'function') boidProps.setSavedBoids(value);
    },
    saveBoidsToStorage: async (value) => {
      setBackupSaved(false);
      if (typeof boidProps?.saveBoidsToStorage === 'function') await boidProps.saveBoidsToStorage(value);
    },
  }), [boidProps]);

  if (!visible) return null;

  const boidCount = boidProps?.savedBoids?.length || 0;
  const meroshareCount = meroshareAccounts.length;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.primary, zIndex: 10 }]}>
      <StatusBar style="light" backgroundColor={COLORS.primary} />

      {/* Status bar spacer */}
      <View style={{ height: insets.top, backgroundColor: COLORS.primary }} />

      {/* Clean Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Account Manager</Text>
            <Text style={styles.headerSubtitle}>Manage your BOIDs & MeroShare accounts</Text>
          </View>
          {/* Cloud Backup Pill */}
          <TouchableOpacity
            style={[styles.backupPill, backupSaved && styles.backupPillSaved]}
            onPress={() => setShowBackupSection(!showBackupSection)}
          >
            <Ionicons
              name={backupSaved ? 'cloud-done-outline' : 'cloud-upload-outline'}
              size={15}
              color={backupSaved ? '#0F766E' : '#4F46E5'}
            />
            <Text style={[styles.backupPillText, backupSaved && styles.backupPillTextSaved]}>
              {backupSaved ? 'Saved' : 'Backup'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Expandable Backup Section */}
        {showBackupSection && (
          <View style={styles.backupCard}>
            <TouchableOpacity onPress={() => setShowBackupSection(false)} style={styles.backupCloseButton}>
              <Ionicons name="close" size={18} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.backupCardTitle}>☁️ Cloud Backup</Text>
            <Text style={styles.backupCardDesc}>
              Sign in with Google to securely back up your BOIDs and MeroShare credentials. Data is encrypted before upload.
            </Text>
            <GoogleSignIn
              onSignInSuccess={async (user) => {
                try {
                  setGoogleUser(user);
                  setBackupSaved(false);
                  onGoogleAccountReady?.(user);
                  await autoSyncMeroshareAccounts(user, { force: true });
                  await syncAllAccountDataToCloud(user);
                  Toast.show({ type: 'success', text1: 'Backup saved', text2: 'BOIDs and MeroShare accounts are saved to cloud.' });
                } catch (error) {
                  Toast.show({ type: 'error', text1: 'Backup failed', text2: error.message });
                }
              }}
              onSignOut={() => { setGoogleUser(null); setBackupSaved(false); }}
              buttonText="Sign in with Google"
            />
            {googleUser && (
              <TouchableOpacity
                style={[styles.backupButton, (syncing || backupSaved) && { opacity: 0.6 }]}
                onPress={handleBackup}
                disabled={syncing || backupSaved}
              >
                <Ionicons name={backupSaved ? 'cloud-done-outline' : 'cloud-upload-outline'} size={16} color="#fff" />
                <Text style={styles.backupButtonText}>
                  {syncing ? 'Saving...' : backupSaved ? 'Backup Up to Date' : 'Save to Cloud'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {[
            { key: 'Boids', label: 'BOIDs', icon: 'people-outline', count: boidCount },
            { key: 'MeroShare', label: 'MeroShare', icon: 'wallet-outline', count: meroshareCount },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons
                name={tab.icon}
                size={18}
                color={activeTab === tab.key ? COLORS.text : COLORS.mutedText}
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                {tab.label}
              </Text>
              <View style={[styles.countBadge, activeTab === tab.key && styles.countBadgeActive]}>
                <Text style={[styles.countText, activeTab === tab.key && styles.countTextActive]}>
                  {tab.count}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      <View style={{ flex: 1, paddingBottom: insets.bottom + 80 }}>
        {activeTab === 'Boids' ? (
          <BoidModal {...wrappedBoidProps} />
        ) : (
          <MerShareAccountModal
            embedded
            onAccountsChange={(accounts) => {
              setMeroshareAccounts(accounts);
            }}
            onAccountsPersisted={handleMeroshareAccountsPersisted}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.surface,
    paddingTop: 16,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.mutedText,
    marginTop: 2,
  },
  backupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  backupPillSaved: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  backupPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  backupPillTextSaved: {
    color: COLORS.text,
  },
  backupCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backupCloseButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 2,
  },
  backupCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  backupCardDesc: {
    fontSize: 12,
    color: COLORS.mutedText,
    lineHeight: 18,
    marginBottom: 12,
  },
  backupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 8,
  },
  backupButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 0,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: COLORS.accent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.mutedText,
  },
  activeTabText: {
    color: COLORS.text,
  },
  countBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countBadgeActive: {
    backgroundColor: COLORS.accent,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.mutedText,
  },
  countTextActive: {
    color: COLORS.text,
  },
});
