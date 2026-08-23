import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SHADOWS } from '../utils/shadow';
import { s, ms, fs } from '../utils/responsive';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import BackButton from '../components/BackButton';
import { notificationsAPI } from '../services/apiService';
import { useNotifications } from '../context/NotificationContext';
import { ERR_SESSION_EXPIRED } from '../constants/errors';

const TYPE_CONFIG = {
  attendance:   { icon: '✅', color: COLORS.attendance, bg: '#E8F5E9' },
  bus:          { icon: '🚌', color: COLORS.busTrack,   bg: '#FFF3E0' },
  announcement: { icon: '📢', color: COLORS.primary,    bg: '#FFEBEE' },
  general:      { icon: '📋', color: '#1E88E5',          bg: '#E3F2FD' },
};

export default function NotificationScreen({ navigation }) {
  const { notifications, loading, load, markRead, markAllRead } = useNotifications();

  useEffect(() => { load(); }, [load]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Session expiry is already handled inside the context's markAllRead (it
  // calls handleLogout and resets navigation to Login itself) — only alert
  // here for a real, recoverable failure the user can retry.
  const handleMarkAllRead = async () => {
    const { ok, error } = await markAllRead();
    if (!ok && error !== ERR_SESSION_EXPIRED) {
      Alert.alert('Failed to Update', error || 'Could not mark notifications as read.');
    }
  };

  // The full message text is already shown inline in the list — there's no
  // separate detail view — so simply viewing this screen counts as "read"
  // even if the user never taps an individual card or "Mark all read".
  // Auto-mark everything as read on the way out, then clear the now-read
  // notifications so the list doesn't accumulate stale history.
  //
  // ALWAYS preventDefault and wait here — never skip based on local state.
  // A single card tap already flips read state optimistically (via the
  // context) before its request finishes, so checking local state ("is
  // anything still unread?") to decide whether to wait was the bug: it let
  // navigation through while that request — or this screen's own initial
  // view — was still in flight, and Home's focus-triggered badge refetch
  // would win the race and read the still-unread row from the server.
  // markAllRead is idempotent, so unconditionally awaiting it here costs
  // nothing when everything really is already read, and closes the race
  // when it isn't.
  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      (async () => {
        await markAllRead({ silent: true });
        await notificationsAPI.deleteRead();
      })().finally(() => navigation.dispatch(e.data.action));
    });
    return sub;
  }, [navigation, markAllRead]);

  const renderItem = ({ item }) => {
    const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.general;
    return (
      <TouchableOpacity
        style={[styles.card, !item.read && styles.cardUnread]}
        onPress={() => markRead(item.id)}
        activeOpacity={0.85}
      >
        {!item.read && <View style={styles.unreadDot} />}

        <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
          <Text style={styles.iconText}>{cfg.icon}</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={[styles.title, !item.read && styles.titleBold]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.time}>{item.time}</Text>
          </View>
          <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
          <Text style={styles.date}>{item.date}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: s(80) }} />
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: ms(16),
    paddingVertical: ms(14),
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: ms(4),
  },
  headerTitle: {
    fontSize: fs(18),
    fontWeight: '700',
    color: '#FFF',
  },
  headerBadge: {
    backgroundColor: '#FFF',
    borderRadius: ms(10),
    minWidth: s(20),
    height: s(20),
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: ms(8),
    paddingHorizontal: ms(5),
  },
  headerBadgeText: {
    fontSize: fs(11),
    fontWeight: '800',
    color: COLORS.primary,
  },
  markAllBtn: { paddingVertical: ms(4), paddingHorizontal: ms(2) },
  markAllText: {
    fontSize: fs(12),
    color: '#FFFFFF99',
    fontWeight: '600',
    textAlign: 'right',
  },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: ms(16), gap: ms(10) },

  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: ms(14),
    padding: ms(14),
    ...SHADOWS.sm,
    position: 'relative',
  },
  cardUnread: {
    backgroundColor: '#FFFBF0',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  unreadDot: {
    position: 'absolute',
    top: ms(14),
    right: ms(14),
    width: s(8),
    height: s(8),
    borderRadius: s(4),
    backgroundColor: COLORS.primary,
  },
  iconWrap: {
    width: s(44),
    height: s(44),
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ms(12),
    flexShrink: 0,
  },
  iconText: { fontSize: fs(22) },

  content: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: ms(4),
  },
  title: {
    fontSize: fs(14),
    fontWeight: '500',
    color: COLORS.textDark,
    flex: 1,
    marginRight: ms(6),
  },
  titleBold: { fontWeight: '800' },
  time: { fontSize: fs(11), color: COLORS.textLight, flexShrink: 0 },
  message: {
    fontSize: fs(13),
    color: COLORS.textGray,
    lineHeight: fs(18),
    marginBottom: ms(6),
  },
  date: { fontSize: fs(11), color: COLORS.textLight, fontWeight: '500' },

  emptyWrap: { alignItems: 'center', marginTop: ms(80) },
  emptyIcon: { fontSize: fs(48), marginBottom: ms(12) },
  emptyText: { fontSize: fs(16), color: COLORS.textGray, fontWeight: '500' },
});
