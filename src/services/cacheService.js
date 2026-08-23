import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour

export const cacheService = {
  async set(key, data, ttl = DEFAULT_TTL) {
    try {
      const item = { data, timestamp: Date.now(), ttl };
      await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(item));
    } catch {}
  },

  async get(key) {
    try {
      const raw = await AsyncStorage.getItem(`cache_${key}`);
      if (!raw) return null;
      const { data, timestamp, ttl } = JSON.parse(raw);
      if (Date.now() - timestamp > ttl) {
        AsyncStorage.removeItem(`cache_${key}`);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  },

  async clear(key) {
    try { await AsyncStorage.removeItem(`cache_${key}`); } catch {}
  },
};
