import React, {
  createContext,
  useState,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { notificationsAPI } from '../services/apiService';
import { ERR_SESSION_EXPIRED } from '../constants/errors';
import { useUser } from './UserContext';
import { goToLogin } from '../utils/navigation';

const CACHE_KEY = '@jmd_notifications_cache';

const NotificationContext = createContext(null);

export function NotificationProvider({ children, navigationRef }) {
  const { setUser } = useUser(); // UserProvider must wrap NotificationProvider
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(false);
  const notificationsRef  = useRef([]);
  const inFlightMarkAllTs = useRef(0);

  // Keep the ref mirror, list, badge count, and AsyncStorage cache all in
  // sync from one place — every write to `notifications` goes through here.
  const updateNotifications = useCallback(async (next) => {
    notificationsRef.current = next;
    setNotifications(next);
    setUnreadCount(next.filter(n => !n.read).length);
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next || []));
    } catch {
      // ignore cache write failures — the in-memory list is still correct
    }
  }, []);

  const loadFromCache = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        notificationsRef.current = parsed;
        setNotifications(parsed);
        setUnreadCount(parsed.filter(n => !n.read).length);
      }
    } catch {
      // ignore cache read failures — load() will fetch fresh anyway
    }
  }, []);

  // Centralized logout: clears user, in-memory list/badge, and the
  // AsyncStorage cache, then resets the nav stack to Login. Clearing the
  // cache matters on a shared device — otherwise the next signed-in user
  // would briefly see the previous user's cached notifications.
  const handleLogout = useCallback(async () => {
    setUser(null);
    notificationsRef.current = [];
    setNotifications([]);
    setUnreadCount(0);
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
    } catch {
      // ignore cache clear failures
    }
    if (navigationRef?.current) goToLogin(navigationRef.current);
  }, [setUser, navigationRef]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notificationsAPI.getAll();
      await updateNotifications(data || []);
    } catch (err) {
      if (err?.message === ERR_SESSION_EXPIRED) {
        await handleLogout();
        return;
      }
      // Network or other transient error: keep whatever's already loaded
      // (cache-first — loadFromCache already populated it on mount).
    } finally {
      setLoading(false);
    }
  }, [updateNotifications, handleLogout]);

  // Kept as an alias so existing callers (HomeScreen's focus-triggered
  // badge refresh) don't need to change.
  const refreshUnreadCount = load;

  const markRead = useCallback(async (id) => {
    const prev = notificationsRef.current;
    const startedAt = Date.now();

    const next = prev.map(n => (n.id === id ? { ...n, read: true } : n));
    await updateNotifications(next);

    const { ok, error } = await notificationsAPI.markRead(id);
    if (!ok) {
      if (error === ERR_SESSION_EXPIRED) {
        await handleLogout();
        return { ok: false, error };
      }
      // A global markAllRead that started after us is authoritative — don't
      // stomp on its result with our own revert.
      if (inFlightMarkAllTs.current > startedAt) return { ok: true };
      await updateNotifications(prev);
      return { ok: false, error };
    }
    return { ok: true };
  }, [updateNotifications, handleLogout]);

  const markAllRead = useCallback(async ({ silent = false } = {}) => {
    const prev = notificationsRef.current;
    const ts = Date.now();
    inFlightMarkAllTs.current = ts;

    const next = prev.map(n => ({ ...n, read: true }));
    await updateNotifications(next);

    const { ok, error } = await notificationsAPI.markAllRead();
    if (!ok) {
      if (error === ERR_SESSION_EXPIRED) {
        await handleLogout();
        return { ok: false, error };
      }
      await updateNotifications(prev);
      // This markAllRead did NOT succeed — clear the marker (unless a newer
      // markAllRead has already replaced it) so a markRead that started
      // before us and is still awaiting its own response knows to revert
      // itself instead of assuming we superseded it.
      if (inFlightMarkAllTs.current === ts) {
        inFlightMarkAllTs.current = 0;
      }
      if (!silent) {
        // callers show their own alerts; provider keeps this minimal
      }
      return { ok: false, error };
    }
    return { ok: true };
  }, [updateNotifications, handleLogout]);

  const navigateToNotifications = useCallback((data) => {
    if (navigationRef?.current?.isReady?.()) {
      navigationRef.current.navigate('Notifications', { fromPush: true, data });
      return true;
    }
    return false;
  }, [navigationRef]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await loadFromCache();
      if (!mounted) return;
      await load();

      // Cold start via notification tap: a response that launched the app
      // from a killed state may not fire addNotificationResponseReceivedListener,
      // so check explicitly once on mount.
      try {
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (mounted && lastResponse) {
          const data = lastResponse?.notification?.request?.content?.data || {};
          navigateToNotifications(data);
        }
      } catch {
        // non-critical
      }
    })();

    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      // Refresh from the server so the authoritative list (with real
      // server-assigned ids) is what ends up cached and counted.
      load().catch(() => {});
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data || {};
      if (!navigateToNotifications(data)) {
        load().catch(() => {});
      }
    });

    return () => {
      mounted = false;
      try { receivedSub.remove(); } catch {}
      try { responseSub.remove(); } catch {}
    };
  }, [loadFromCache, load, navigateToNotifications]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      loading,
      unreadCount,
      setUnreadCount,
      load,
      refreshUnreadCount,
      markRead,
      markAllRead,
      handleLogout,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
