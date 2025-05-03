import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import SplashScreen from './components/SplashScreen.js'; // Import your SplashScreen
import MainApp from './MainApp'; // Import your MainApp or WebView screen

export default function App() {
  const [isSplashFinished, setIsSplashFinished] = useState(false);

  if (!isSplashFinished) {
    // While splash is not finished, show SplashScreen
    return <SplashScreen onFinish={() => setIsSplashFinished(true)} />;
  }

  // After splash is finished, show MainApp
  return (
    <View style={styles.container}>
      <MainApp />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
