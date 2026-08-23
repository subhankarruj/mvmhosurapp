import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Show notification even when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Request permission ──────────────────────────────────────────────────────
export async function requestNotificationPermission() {
  if (Platform.OS === 'web') return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowSound: true,
      allowBadge: true,
    },
  });
  return status === 'granted';
}

// ─── Register for real OS push notifications ─────────────────────────────────
// To receive server-created notifications (attendance, bus proximity, etc.)
// as a real push even when the app is closed, the device needs an Expo push
// token registered with the backend.
export async function getExpoPushToken() {
  if (Platform.OS === 'web') return null;

  const granted = await requestNotificationPermission();
  if (!granted) return null;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return null;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}
