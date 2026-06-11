import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// The EAS project ID from app.json — required by Expo to route push tokens correctly
const EXPO_PROJECT_ID = 'aae96ae8-6346-4b1a-958b-b2718ef45d24';

// Request push notification permission and return the Expo push token.
// Returns null if the user denies permission or we're on a simulator.
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Push tokens only work on real devices
    if (!Device.isDevice) {
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    // Android requires a notification channel for foreground/background behaviour
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Παιχνίδια',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00C2A8',
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: EXPO_PROJECT_ID,
    });

    return tokenData.data;
  } catch (err) {
    console.error('Failed to register for push notifications:', err);
    return null;
  }
}
