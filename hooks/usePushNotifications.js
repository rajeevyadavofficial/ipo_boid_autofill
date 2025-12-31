import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform, ToastAndroid } from 'react-native';

// Handle Expo Go limitation
const isExpoGo = true; // Simplified check, or we can just try/catch

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (error) {
  console.warn('Notifications setup failed (likely Expo Go limitation):', error.message);
}

export const usePushNotifications = () => {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(false);
  const notificationListener = useRef();
  const responseListener = useRef();

  async function registerForPushNotificationsAsync() {
    let token;

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      if (Device.isDevice) {
        ToastAndroid.show('Checking Permissions...', ToastAndroid.SHORT);
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          ToastAndroid.show('Requesting Permissions...', ToastAndroid.SHORT);
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          ToastAndroid.show('❌ Permission Denied', ToastAndroid.SHORT);
          console.log('Failed to get push token for push notification!');
          return;
        }
        
        // Get the token
        ToastAndroid.show('Fetching Expo Token...', ToastAndroid.SHORT);
        token = (await Notifications.getExpoPushTokenAsync({
          projectId: '41e9f039-83c5-42e4-a19e-26a8acf96c09', // Added projectId from app.json
        })).data;
        
        console.log('Expo Push Token:', token);
      } else {
        ToastAndroid.show('Must use physical device', ToastAndroid.SHORT);
        console.log('Must use physical device for Push Notifications');
      }
    } catch (error) {
      ToastAndroid.show(`❌ Registration failed: ${error.message}`, ToastAndroid.LONG);
      console.warn('Push notification registration failed:', error.message);
      // Return null or handle gracefully
      return null;
    }

    return token;
  }

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) setExpoPushToken(token);
    });

    try {
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        setNotification(notification);
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log(response);
      });
    } catch (error) {
      console.warn('Notification listeners failed:', error.message);
    }

    return () => {
      if (notificationListener.current) Notifications.removeNotificationSubscription(notificationListener.current);
      if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  return {
    expoPushToken,
    notification,
  };
};
