import * as Location from 'expo-location';
import { Platform } from 'react-native';

// ─── Request location permission ─────────────────────────────────────────────
export async function requestLocationPermission() {
  if (Platform.OS === 'web') return false;

  const { status: existing } = await Location.getForegroundPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

// ─── Get current GPS coordinates ─────────────────────────────────────────────
export async function getCurrentLocation() {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
}

// ─── Haversine distance between two GPS points (returns metres) ──────────────
export function distanceBetween(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
