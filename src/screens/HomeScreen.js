import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../constants/colors';
import { SCHOOL_CONFIG } from '../config/appConfig';
import { getAcademicYear, formatDateShort } from '../utils/dateUtils';
import { SHADOWS } from '../utils/shadow';
import { s, ms, fs } from '../utils/responsive';
import { useUser } from '../context/UserContext';
import { useNotifications } from '../context/NotificationContext';

const MODULES = [
  {
    id: 'attendance',
    label: 'Attendance',
    icon: '✅',
    bg: COLORS.attendance,
    screen: 'Attendance',
  },
  {
    id: 'bustrack',
    label: 'Bus Track',
    icon: '🚌',
    bg: COLORS.busTrack,
    screen: 'BusTrack',
  },
];


export default function HomeScreen({ navigation }) {
  const academicYear = getAcademicYear();
  const todayLabel   = formatDateShort();
  const { user }     = useUser();
  const { unreadCount, refreshUnreadCount } = useNotifications();

  const schoolName = user?.schoolName || user?.school_name || SCHOOL_CONFIG.name;

  // Cached sessions from before feature flags existed have no attendance_enabled /
  // bus_tracking_enabled field — treat "unset" as enabled, matching the DB default.
  const modules = MODULES.filter(mod => {
    if (mod.id === 'attendance') return user?.attendance_enabled !== false;
    if (mod.id === 'bustrack')   return user?.bus_tracking_enabled !== false;
    return true;
  });

  // Re-sync from the server on focus (e.g. a new notification arrived while
  // away). Mark-as-read updates the shared count instantly and directly —
  // see NotificationContext — so there's no race waiting on this refetch.
  useFocusEffect(
    useCallback(() => { refreshUnreadCount(); }, [refreshUnreadCount])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <Image
            source={require('../../assets/mvm-logo.png')}
            style={styles.logoImg}
            resizeMode="contain"
          />
        </View>
        <View style={styles.headerTextCol}>
          <Text style={styles.headerTitle} numberOfLines={1}>{schoolName}</Text>
          <Text style={styles.headerSub}>Academic Year {academicYear}</Text>
        </View>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Text style={styles.notifIcon}>🔔</Text>
          {unreadCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeTxt}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.greetCard}>
          <Text style={styles.greetName}>Welcome, {user?.name || 'Student'}</Text>
          <Text style={styles.greetDate}>📅 {todayLabel}</Text>
        </View>

        {/* Module Grid */}
        <View style={styles.gridCard}>
          <View style={styles.grid}>
            {modules.map((mod) => (
              <TouchableOpacity
                key={mod.id}
                style={styles.moduleCell}
                onPress={() => navigation.navigate(mod.screen)}
                activeOpacity={0.8}
              >
                <View style={[styles.moduleIconBox, { backgroundColor: mod.bg }]}>
                  <Text style={styles.moduleIcon}>{mod.icon}</Text>
                </View>
                <Text style={styles.moduleLabel}>{mod.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: ms(16),
    paddingVertical: ms(12),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.md,
  },
  logoBox: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1.5,
    borderColor: COLORS.primary + '40',
    borderRadius: ms(10),
    padding: ms(4),
    marginRight: ms(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImg: {
    width: s(42),
    height: s(42),
  },
  headerTextCol: { flex: 1 },
  headerTitle: {
    fontSize: fs(13),
    fontWeight: '800',
    color: '#2F6B3F',
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: fs(11),
    color: COLORS.textGray,
    marginTop: 1,
  },
  notifBtn: { padding: ms(6) },
  notifIcon: { fontSize: fs(22) },
  notifBadge: {
    position: 'absolute',
    top: ms(2),
    right: ms(2),
    minWidth: ms(16),
    height: ms(16),
    borderRadius: ms(8),
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(3),
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  notifBadgeTxt: { fontSize: fs(9), fontWeight: '800', color: '#FFFFFF' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: ms(20) },

  // Greeting
  greetCard: {
    backgroundColor: '#2F6B3F',
    marginHorizontal: ms(16),
    marginTop: ms(16),
    borderRadius: ms(14),
    padding: ms(16),
  },
  greetName: {
    fontSize: fs(17),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  greetDate: {
    fontSize: fs(11),
    color: '#FFFFFF99',
    marginTop: ms(6),
  },

  // Module Grid
  gridCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: ms(16),
    marginTop: ms(16),
    borderRadius: ms(16),
    padding: ms(16),
    ...SHADOWS.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  moduleCell: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: ms(18),
  },
  moduleIconBox: {
    width: s(80),
    height: s(80),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ms(10),
    ...SHADOWS.icon,
  },
  moduleIcon: { fontSize: fs(38) },
  moduleLabel: {
    fontSize: fs(14),
    fontWeight: '700',
    color: COLORS.textDark,
    textAlign: 'center',
  },

});
