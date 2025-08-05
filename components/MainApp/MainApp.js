import React, { useRef, useState, useEffect } from 'react';
import {
  SafeAreaView,
  ToastAndroid,
  TouchableOpacity,
  Text,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WebViewContainer from './WebViewContainer';
import UrlBar from './UrlBar';
import BoidModal from './BoidModal';
// Removed BoidResultModal import
import styles from './styles';

export default function MainAppV2() {
  const webViewRef = useRef(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [boidInput, setBoidInput] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [savedBoids, setSavedBoids] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [webUrl, setWebUrl] = useState('https://iporesult.cdsc.com.np/');
  const [currentUrl, setCurrentUrl] = useState(
    'https://iporesult.cdsc.com.np/'
  );

  // Result tracking states
  const [results, setResults] = useState([]); // { boid, nickname, result }
  const [currentCheckingBoid, setCurrentCheckingBoid] = useState(null);

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

  const handleRefresh = () => {
    webViewRef.current?.reload();
    ToastAndroid.show('Page refreshed', ToastAndroid.SHORT);
  };

  const handleGoPress = () => {
    setCurrentUrl(webUrl);
  };

  // Called from WebView on result extraction after user taps Capture Result
  const handleResultExtracted = (resultText) => {
    if (!currentCheckingBoid) return;

    setResults((prevResults) => {
      // Replace existing result for same BOID or add new
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
    <SafeAreaView style={styles.container}>
      {/* <UrlBar
        webUrl={webUrl}
        setWebUrl={setWebUrl}
        onGoPress={handleGoPress}
        onRefresh={handleRefresh}
      /> */}

      <WebViewContainer
        ref={webViewRef}
        currentUrl={currentUrl}
        onResultExtracted={handleResultExtracted}
      />

      {/* ☰ Button to open BOID Modal */}
      <TouchableOpacity
        style={styles.popupButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.popupButtonText}>☰</Text>
      </TouchableOpacity>

      {/* Removed Check Results button and modal */}

      {/* BOID Modal (Form + List + Results + Clear Results) */}
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
    </SafeAreaView>
  );
}
