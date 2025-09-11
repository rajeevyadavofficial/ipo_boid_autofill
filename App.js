import React, { useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context'; // ✅ import

import SplashScreen from './components/SplashScreen.js';
import MainApp from './screens/MainApp.js';

export default function App() {
  const [isSplashFinished, setIsSplashFinished] = useState(false);

  if (!isSplashFinished) {
    // While splash is not finished, show SplashScreen
    return <SplashScreen onFinish={() => setIsSplashFinished(true)} />;
  }

  // After splash is finished, wrap everything in SafeAreaProvider
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#343a40" />
        <MainApp />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#6200EE',
  },
});
