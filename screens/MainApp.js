// screens/MainApp.js
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform, Modal, SafeAreaView, Alert, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WebViewContainer from '../components/main/WebViewContainer';
import BottomNavBar from '../components/navigation/BottomNavBar';
import UpcomingIposScreen from './upcomingIpos/UpcomingIposScreen';
import OpenIposScreen from './openIpos/OpenIposScreen';
import BulkCheckPanel from '../components/boid/BulkCheckPanel';
import AccountManagerScreen from '../components/main/AccountManagerScreen';
import BulkApplyPanel from '../components/meroshare/BulkApplyPanel';
import MoreSidebar from '../components/navigation/MoreSidebar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import { setStatusBarBackgroundColor } from 'expo-status-bar';
import { getApiBaseUrl } from '../utils/config';
import styles from '../styles/styles';
import { COLORS } from '../utils/theme';
import { useBoidSync } from '../hooks/useBoidSync';

import { usePushNotifications } from '../hooks/usePushNotifications';

const CURRENT_VERSION = '1.0.11';
const CURRENT_VERSION_CODE = 21;

const compareVersionNames = (left = '0.0.0', right = '0.0.0') => {
  const a = String(left).split('.').map(part => parseInt(part, 10) || 0);
  const b = String(right).split('.').map(part => parseInt(part, 10) || 0);
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return 1;
    if ((a[i] || 0) < (b[i] || 0)) return -1;
  }
  return 0;
};

export default function MainApp() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef(null);
  const lastAutoSyncGoogleIdRef = useRef(null);

  const { expoPushToken } = usePushNotifications();
  const { syncToCloud, syncFromCloud } = useBoidSync();

  // DEEP DIVE FIX: Global Status & Navigation Bar Styling
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Force Android system bars to use the app chrome color.
      setStatusBarBackgroundColor(COLORS.primary, true);
      NavigationBar.setBackgroundColorAsync(COLORS.primary);
      NavigationBar.setButtonStyleAsync('light');
    }
  }, []);

  // Register push token with backend
  useEffect(() => {
    if (expoPushToken) {
      const registerToken = async () => {
        try {
          const API_URL = `${getApiBaseUrl()}/notifications/register`;
          await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: expoPushToken }),
          });
          console.log('✅ Token sent to backend');
        } catch (error) {
          console.error('❌ Failed to send token to backend:', error);
        }
      };
      registerToken();
    }
  }, [expoPushToken]);

  const [showAccountManager, setShowAccountManager] = useState(false);
  const [boidInput, setBoidInput] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [savedBoids, setSavedBoids] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [showMoreSidebar, setShowMoreSidebar] = useState(false);
  const [showUpcomingIpos, setShowUpcomingIpos] = useState(false);
  const [showBulkCheck, setShowBulkCheck] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('https://iporesult.cdsc.com.np/');
  const [results, setResults] = useState([]);
  const [currentCheckingBoid, setCurrentCheckingBoid] = useState(null);
  const [currentIPO, setCurrentIPO] = useState(null);
  const [onWebViewMessage, setOnWebViewMessage] = useState(null);
  const [useAiModel, setUseAiModel] = useState(true);
  const [showBulkApply, setShowBulkApply] = useState(false);
  const [showOpenIpos, setShowOpenIpos] = useState(false);
  const [currentApplyIPO, setCurrentApplyIPO] = useState(null);

  const closeAllScreens = () => {
    setShowUpcomingIpos(false);
    setShowOpenIpos(false);
    setShowBulkCheck(false);
    setShowAccountManager(false);
    setShowBulkApply(false);
    setShowMoreSidebar(false);
  };

  const getStoredGoogleUser = async () => {
    const userData = await AsyncStorage.getItem('googleUser');
    return userData ? JSON.parse(userData) : null;
  };

  const mergeBoids = (localBoids = [], cloudBoids = []) => {
    const merged = Array.isArray(cloudBoids) ? [...cloudBoids] : [];
    (Array.isArray(localBoids) ? localBoids : []).forEach((localBoid) => {
      if (!localBoid?.boid) return;
      const exists = merged.some((item) => item?.boid === localBoid.boid);
      if (!exists) merged.push(localBoid);
    });
    return merged;
  };

  const syncBoidsForGoogleUser = useCallback(async (user, options = {}) => {
    const googleId = user?.googleId;
    if (!googleId) return;
    if (!options.force && lastAutoSyncGoogleIdRef.current === googleId) return;
    lastAutoSyncGoogleIdRef.current = googleId;

    try {
      const localData = await AsyncStorage.getItem('savedBoids');
      const localBoids = localData ? JSON.parse(localData) : [];
      const cloudResult = await syncFromCloud(googleId);
      if (!cloudResult.success) return;

      const cloudBoids = Array.isArray(cloudResult.boidList) ? cloudResult.boidList : [];
      const mergedBoids = mergeBoids(localBoids, cloudBoids);
      setSavedBoids(mergedBoids);
      await AsyncStorage.setItem('savedBoids', JSON.stringify(mergedBoids));

      if (JSON.stringify(mergedBoids) !== JSON.stringify(cloudBoids)) {
        await syncToCloud(mergedBoids, googleId);
      }
    } catch (error) {
      console.warn('Auto BOID sync failed:', error.message);
    }
  }, [syncFromCloud, syncToCloud]);

  // Load saved BOIDs
  useEffect(() => {
    (async () => {
      const data = await AsyncStorage.getItem('savedBoids');
      if (data) setSavedBoids(JSON.parse(data));
      const googleUser = await getStoredGoogleUser();
      if (googleUser?.googleId) {
        await syncBoidsForGoogleUser(googleUser);
      }
    })();
  }, [syncBoidsForGoogleUser]);

  // Check for App Updates
  useEffect(() => {
    fetch(`${getApiBaseUrl()}/version`)
      .then(res => res.json())
      .then(data => {
        const latestVersionCode = parseInt(data.latestVersionCode, 10);
        const hasNewVersionCode = latestVersionCode && latestVersionCode > CURRENT_VERSION_CODE;
        const hasNewVersionName = data.latestVersion && compareVersionNames(data.latestVersion, CURRENT_VERSION) > 0;

        if (hasNewVersionCode || hasNewVersionName) {
          Alert.alert(
            "Update Available",
            data.message || "A new version of the IPO App is available.",
            [
              { text: "Later", style: "cancel" },
              { text: "Update Now", onPress: () => {
                if (data.updateUrl) Linking.openURL(data.updateUrl);
              }}
            ]
          );
        }
      })
      .catch(err => console.log("Version check failed", err.message));
  }, []);

  const saveBoidsToStorage = async (data, options = {}) => {
    setSavedBoids(data);
    await AsyncStorage.setItem('savedBoids', JSON.stringify(data));
    if (options.skipCloudSync) return;

    try {
      const googleUser = await getStoredGoogleUser();
      if (googleUser?.googleId) {
        await syncToCloud(data, googleUser.googleId);
      }
    } catch (error) {
      console.warn('Auto BOID cloud backup failed:', error.message);
    }
  };

  const resetForm = () => {
    setBoidInput('');
    setNicknameInput('');
    setEditIndex(null);
  };

  const handleResultExtracted = (resultText) => {
    if (!currentCheckingBoid) return;
    setResults((prevResults) => {
      const index = prevResults.findIndex(
        (item) => item.boid === currentCheckingBoid.boid
      );
      if (index >= 0) {
        const updated = [...prevResults];
        updated[index].result = resultText;
        return updated;
      }
      return [
        ...prevResults,
        {
          boid: currentCheckingBoid.boid,
          nickname: currentCheckingBoid.nickname,
          result: resultText,
        },
      ];
    });
    setCurrentCheckingBoid(null);
    if (Platform.OS === 'android') {
      // ToastAndroid.show('Result received', ToastAndroid.SHORT);
    } else {
      Toast.show({ type: 'success', text1: 'Result received' });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.primary }}>
      <StatusBar style="light" backgroundColor={COLORS.primary} />
      {/* WebView */}
      <View style={{ flex: 1, display: (showUpcomingIpos || showOpenIpos || showBulkCheck || showAccountManager || showBulkApply) ? 'none' : 'flex', backgroundColor: COLORS.primary }}>
        <WebViewContainer
          ref={webViewRef}
          currentUrl={currentUrl}
          onResultExtracted={handleResultExtracted}
          onMessage={(e) => {
            onWebViewMessage?.(e);
            try {
              const data = JSON.parse(e.nativeEvent.data);
              if (data.type === 'COMPANY_SELECTED' && data.company) {
                // Update current IPO if name is different
                if (currentIPO?.company !== data.company) {
                  setCurrentIPO({ company: data.company });
                }
              }
            } catch (err) {
              // Ignore non-JSON messages
            }
          }}
          topInset={insets.top}
        />
      </View>

      {/* Upcoming IPOs Screen */}
      {showUpcomingIpos && !showOpenIpos && (
        <View style={{ flex: 1, paddingBottom: 80 }}>
          <UpcomingIposScreen
            onSelectIPO={(ipo) => {
              if (currentIPO?.company !== ipo.company) {
                setResults([]);
              }
              setCurrentIPO(ipo);
              setShowBulkCheck(true);
              setShowUpcomingIpos(false);
            }}
          />
        </View>
      )}

      {/* Live Open IPOs from MeroShare */}
      {showOpenIpos && (
        <View style={{ flex: 1, paddingBottom: 80 }}>
          <OpenIposScreen
            onApply={(ipo) => {
              setCurrentApplyIPO(ipo);
              setShowOpenIpos(false);
              setShowBulkApply(true);
            }}
          />
        </View>
      )}



      {/* Account Manager Screen */}
      <AccountManagerScreen
        visible={showAccountManager}
        onGoogleAccountReady={(user) => syncBoidsForGoogleUser(user, { force: true })}
        boidProps={{
          boidInput,
          nicknameInput,
          setBoidInput,
          setNicknameInput,
          savedBoids,
          setSavedBoids,
          editIndex,
          setEditIndex,
          saveBoidsToStorage,
          resetForm,
          webViewRef,
          setResults,
          setCurrentCheckingBoid,
        }}
      />

      {/* Bulk Check Full-Screen Modal */}
      {showBulkCheck && (
        <View style={{ flex: 1, backgroundColor: COLORS.primary, paddingBottom: 80 }}>
          <BulkCheckPanel
            savedBoids={Array.isArray(savedBoids) ? savedBoids.filter(b => b && b.boid) : []}
            ipoName={currentIPO?.company}
            webViewRef={webViewRef}
            visible={showBulkCheck}
            results={results}
            setResults={setResults}
            onModeChange={() => {}}
            onWebViewMessage={setOnWebViewMessage}
            autoCheckBoid={null}
            onAutoCheckComplete={() => {}}
            useAiModel={useAiModel}
            setUseAiModel={setUseAiModel}
            onClose={() => setShowBulkCheck(false)}
            onOpenAccountManager={() => {
              setShowBulkCheck(false);
              setShowAccountManager(true);
            }}
          />
        </View>
      )}


      {/* More Sidebar */}
      <MoreSidebar
        visible={showMoreSidebar}
        onClose={() => setShowMoreSidebar(false)}
        onOpenBoidModal={() => {
          closeAllScreens();
          setShowAccountManager(true);
        }}
        onOpenOpenIpos={() => {
          closeAllScreens();
          setShowOpenIpos(true);
        }}
        onOpenUpcomingIpos={() => {
          closeAllScreens();
          setShowUpcomingIpos(true);
        }}
      />



      {/* Bulk Apply Full-Screen Modal */}
      {showBulkApply && (
        <View style={{ flex: 1, paddingBottom: 80 }}>
          <BulkApplyPanel initialIssue={currentApplyIPO} onClose={() => setShowBulkApply(false)} />
        </View>
      )}

      {/* Bottom Navigation Bar */}
      {!showMoreSidebar && (
        <View style={localStyles.bottomNavWrapper}>
        <BottomNavBar
          onOpenHome={() => {
            closeAllScreens();
          }}
          onOpenAccounts={() => {
            closeAllScreens();
            setShowAccountManager(true);
          }}
          onOpenBulkCheck={() => {
            closeAllScreens();
            setShowBulkCheck(true);
          }}
          onOpenBulkApply={() => {
            closeAllScreens();
            setShowBulkApply(true);
          }}
          onOpenMore={() => {
            setShowMoreSidebar(true);
          }}
        />
        </View>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  bottomNavWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
