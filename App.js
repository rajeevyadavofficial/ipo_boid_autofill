import React, { useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context'; 
import * as SplashScreenModule from 'expo-splash-screen'; // Rename to avoid conflict with component

import CustomSplashScreen from './components/SplashScreen.js'; // Rename import for clarity
import MainApp from './screens/MainApp.js';
import Toast from 'react-native-toast-message';

// Keep the splash screen visible while we fetch resources
SplashScreenModule.preventAutoHideAsync();


export default function App() {
  const [isSplashFinished, setIsSplashFinished] = useState(false);

  React.useEffect(() => {
    // Hide the native splash screen immediately so our video can play
    SplashScreenModule.hideAsync();
  }, []);

  if (!isSplashFinished) {
    // While splash is not finished, show CustomSplashScreen
    return <CustomSplashScreen onFinish={() => setIsSplashFinished(true)} />;
  }

  // After splash is finished, wrap everything in SafeAreaProvider
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#343a40" />
        <MainApp />
        <Toast />
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
