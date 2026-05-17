import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context'; 
import * as SplashScreenModule from 'expo-splash-screen'; 
import { StatusBar } from 'expo-status-bar';

import MainApp from './screens/MainApp.js';
import Toast from 'react-native-toast-message';
import { COLORS } from './utils/theme';

// Keep the splash screen visible while we fetch resources
SplashScreenModule.preventAutoHideAsync();

export default function App() {
  React.useEffect(() => {
    // Keep splash screen visible for 2 seconds to show logo
    const timer = setTimeout(async () => {
      await SplashScreenModule.hideAsync();
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="light" backgroundColor={COLORS.primary} translucent={false} />
        <MainApp />
        <Toast />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
});
