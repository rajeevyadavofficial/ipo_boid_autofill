// screens/MainApp.js
import React, { useRef, useState, useEffect } from 'react';
import { View, ToastAndroid, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BoidModal from '../components/boid/BoidModal';
import WebViewContainer from '../components/main/WebViewContainer';
import BottomNavBar from '../components/navigation/BottomNavBar';
import DeveloperSidebar from '../components/developer/DeveloperSidebar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styles from '../styles/styles';

export default function MainApp() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [boidInput, setBoidInput] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [savedBoids, setSavedBoids] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [developerVisible, setDeveloperVisible] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(
    'https://iporesult.cdsc.com.np/'
  );
  const [results, setResults] = useState([]);
  const [currentCheckingBoid, setCurrentCheckingBoid] = useState(null);

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
    <View style={{ flex: 1, backgroundColor: '#343a40' }}>
      {/* WebView */}
      <WebViewContainer
        ref={webViewRef}
        currentUrl={currentUrl}
        onResultExtracted={handleResultExtracted}
      />

      {/* Bottom Navigation Bar */}
      <View
        style={[localStyles.bottomNavWrapper, { paddingBottom: insets.bottom }]}
      >
        <BottomNavBar
          onOpenBoidModal={() => setModalVisible(true)}
          onOpenUpcomingIpos={() =>
            ToastAndroid.show('Upcoming IPOs coming soon!', ToastAndroid.SHORT)
          }
          onOpenDeveloperInfo={() => setDeveloperVisible(true)}
        />
      </View>

      {/* BOID Modal */}
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
        webViewRef={webViewRef}
        results={results}
        setResults={setResults}
        setCurrentCheckingBoid={setCurrentCheckingBoid}
      />

      {/* Developer Sidebar */}
      <DeveloperSidebar
        visible={developerVisible}
        onClose={() => setDeveloperVisible(false)}
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
