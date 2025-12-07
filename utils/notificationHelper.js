import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cancel all scheduled IPO notifications
 */
export const cancelAllIpoNotifications = async () => {
  const allIds = await Notifications.getAllScheduledNotificationsAsync();
  for (let n of allIds) {
    await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
};

/**
 * Schedule daily notifications for an IPO from startDate to endDate
 */
export const scheduleIpoNotifications = async (ipo) => {
  const start = new Date(ipo.startDate);
  const end = new Date(ipo.endDate);

  const now = new Date();

  // Loop through each day of the IPO
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // Only schedule future notifications
    if (d >= now) {
      const triggerDate = new Date(d);
      triggerDate.setHours(9, 0, 0, 0); // 9:00 AM

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'IPO Reminder',
          body: `The IPO "${ipo.name}" is open today (${ipo.startDate} → ${ipo.endDate}).`,
          sound: true,
        },
        trigger: triggerDate,
      });
    }
  }
};
