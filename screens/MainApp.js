// screens/MainApp.js
import React, { useRef, useState, useEffect } from 'react';
import { View, ToastAndroid, StyleSheet, Platform, Modal, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BoidModal from '../components/boid/BoidModal';
import WebViewContainer from '../components/main/WebViewContainer';
import BottomNavBar from '../components/navigation/BottomNavBar';
import DeveloperSidebar from '../components/developer/DeveloperSidebar';
import UpcomingIposScreen from './upcomingIpos/UpcomingIposScreen';
import BulkCheckPanel from '../components/boid/BulkCheckPanel';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiBaseUrl } from '../utils/config';
import styles from '../styles/styles';

import { usePushNotifications } from '../hooks/usePushNotifications';

export default function MainApp() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef(null);
  
  const { expoPushToken } = usePushNotifications();

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

  const [modalVisible, setModalVisible] = useState(false);
  const [boidInput, setBoidInput] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [savedBoids, setSavedBoids] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [developerVisible, setDeveloperVisible] = useState(false);
  const [showUpcomingIpos, setShowUpcomingIpos] = useState(false);
  const [showBulkCheck, setShowBulkCheck] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('https://iporesult.cdsc.com.np/');
  const [results, setResults] = useState([]);
  const [currentCheckingBoid, setCurrentCheckingBoid] = useState(null);
  const [currentIPO, setCurrentIPO] = useState(null);
  const [onWebViewMessage, setOnWebViewMessage] = useState(null);

  // Load saved BOIDs
  useEffect(() => {
    (async () => {
      const data = await AsyncStorage.getItem('savedBoids');
      if (data) setSavedBoids(JSON.parse(data));
    })();
  }, []);

  const saveBoidsToStorage = async (data) => {
    setSavedBoids(data);
    await AsyncStorage.setItem('savedBoids', JSON.stringify(data));
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
    ToastAndroid.show('Result received', ToastAndroid.SHORT);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#333a56' }}>
      {/* WebView */}
      <View style={{ flex: 1, display: showUpcomingIpos ? 'none' : 'flex', paddingBottom: 64 + insets.bottom }}>
        <WebViewContainer
          ref={webViewRef}
          currentUrl={currentUrl}
          onResultExtracted={handleResultExtracted}
          onMessage={(e) => onWebViewMessage?.(e)}
          topInset={insets.top}
        />
      </View>

      {/* Upcoming IPOs Screen */}
      {showUpcomingIpos && (
        <View style={{ flex: 1, paddingBottom: 80 }}>
          <UpcomingIposScreen 
            onSelectIPO={(ipo) => {
              if (currentIPO?.company !== ipo.company) {
                setResults([]);
              }
              setCurrentIPO(ipo);
              // Open Bulk Check screen directly after selecting IPO
              setShowBulkCheck(true);
              setShowUpcomingIpos(false);
            }}
          />
        </View>
      )}

      {/* Bottom Navigation Bar */}
      <View style={localStyles.bottomNavWrapper}>
        <BottomNavBar
          onOpenBoidModal={() => {
            if (showUpcomingIpos) setShowUpcomingIpos(false);
            setModalVisible(true);
          }}
          onOpenBulkCheck={() => {
            if (showUpcomingIpos) setShowUpcomingIpos(false);
            setShowBulkCheck(true);
          }}
          onOpenUpcomingIpos={() => setShowUpcomingIpos(!showUpcomingIpos)}
          onOpenDeveloperInfo={() => setDeveloperVisible(true)}
        />
      </View>

      {/* BOID Manager Modal */}
      <BoidModal
        visible={modalVisible}
        setVisible={setModalVisible}
        boidInput={boidInput}
        nicknameInput={nicknameInput}
        setBoidInput={setBoidInput}
        setNicknameInput={setNicknameInput}
        savedBoids={savedBoids}
        setSavedBoids={setSavedBoids}
        editIndex={editIndex}
        setEditIndex={setEditIndex}
        saveBoidsToStorage={saveBoidsToStorage}
        resetForm={resetForm}
      />

      {/* Bulk Check Full-Screen Modal */}
      <Modal
        visible={showBulkCheck}
        animationType="slide"
        onRequestClose={() => setShowBulkCheck(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
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
            useAiModel={true}
            setUseAiModel={() => {}}
            onClose={() => setShowBulkCheck(false)}
          />
        </View>
      </Modal>

      {/* Developer Sidebar */}
      <DeveloperSidebar
        visible={developerVisible}
        onClose={() => setDeveloperVisible(false)}
        webViewRef={webViewRef}
        onWebViewMessage={setOnWebViewMessage}
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  bottomNavWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
