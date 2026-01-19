import remoteConfig from '@react-native-firebase/remote-config';

// Default values in case fetch fails
const defaultConfig = {
  backend_api_url: 'https://ipo-backend-zzjb.onrender.com/api',
};

export const initRemoteConfig = async () => {
  try {
    await remoteConfig().setDefaults(defaultConfig);
    
    // Fetch and activate values from the cloud
    // We use a small fetch interval for dev/testing, but increase it for prod
    await remoteConfig().fetchAndActivate();
    
    console.log('✅ Remote Config fetched and activated');
  } catch (error) {
    console.error('❌ Remote Config fetch failed:', error);
  }
};

export const getBackendUrl = () => {
  const url = remoteConfig().getValue('backend_api_url').asString();
  console.log('🔗 Current Backend URL:', url);
  return url || defaultConfig.backend_api_url;
};
