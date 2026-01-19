import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { initRemoteConfig } from './utils/remoteConfig';
import { registerRootComponent } from 'expo';

// Initialize Remote Config early
initRemoteConfig();

AppRegistry.registerComponent(appName, () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
