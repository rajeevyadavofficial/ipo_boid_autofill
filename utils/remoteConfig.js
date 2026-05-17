import { Platform } from 'react-native';
let remoteConfig;
if (Platform.OS !== 'web') {
  remoteConfig = require('@react-native-firebase/remote-config').default;
}

// Default values in case fetch fails
const defaultConfig = {
  backend_api_url: Platform.OS === 'web'
    ? 'http://localhost:3000/api'
    : 'https://ipo-backend-zzjb.onrender.com/api',
};

export const initRemoteConfig = async () => {
  if (Platform.OS === 'web') {
    console.log('🌐 Web platform detected: Skipping Remote Config fetch');
    return;
  }

  try {
    await remoteConfig().setConfigSettings({
      minimumFetchIntervalMillis: 0,
    });

    await remoteConfig().setDefaults(defaultConfig);

    // Fetch and activate values from the cloud
    await remoteConfig().fetchAndActivate();

    console.log('✅ Remote Config fetched and activated');
  } catch (error) {
    console.error('❌ Remote Config fetch failed:', error);
  }
};

export const getBackendUrl = () => {
  if (Platform.OS === 'web') {
    return defaultConfig.backend_api_url;
  }
  const url = remoteConfig().getValue('backend_api_url').asString();
  console.log('🔗 Current Backend URL:', url);
  return url || defaultConfig.backend_api_url;
};
