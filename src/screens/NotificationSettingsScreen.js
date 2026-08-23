import React, { useState, useEffect } from 'react';
import {
  View, Text, Switch, StyleSheet, StatusBar,
  TouchableOpacity, ScrollView, ActivityIndicator, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../constants/colors';
import BackButton from '../components/BackButton';
import { authAPI, saveUser } from '../services/apiService';
import { useUser } from '../context/UserContext';
import { SHADOWS } from '../utils/shadow';
import { s, ms, fs } from '../utils/responsive';

const SETTINGS_KEY = '@jmd_notif_settings';

const DEFAULT_SETTINGS = {
  busAlerts: true,
};

// `remote: true` categories are saved server-side (via authAPI) under `field`
// and actually gate whether the matching notifier fires a push. Plain
// categories are device-local only (AsyncStorage) and don't affect the server.
const CATEGORIES = [
  {
    key: 'attendanceAlerts',
    icon: '✅',
    label: 'Attendance Alerts',
    desc: 'Get notified when your attendance is marked Present or Absent',
    color: COLORS.attendance,
    remote: true,
    field: 'notify_attendance',
  },
  {
    key: 'busAlerts',
    icon: '🚌',
    label: 'Bus Alerts',
    desc: 'Approaching and arrival alerts for your bus stop',
    color: COLORS.busTrack,
    remote: true,
    field: 'notify_bus',
  },
];

export default function NotificationSettingsScreen({ navigation }) {
  const { user, setUser } = useUser();
  const [settings, setSettings]         = useState(DEFAULT_SETTINGS);
  const [osPermission, setOsPermission] = useState(null); // 'granted' | 'denied' | 'undetermined'
  const [saving, setSaving]             = useState(false);
  const [loading, setLoading]           = useState(true);

  // Load saved settings and check OS permission on mount
  useEffect(() => {
    (async () => {
      // Load persisted local-only settings
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      } catch {}

      // Remote toggles are server-truth, not local storage — "enabled unless
      // explicitly off", so old sessions from before a setting existed (value
      // undefined) default to enabled.
      setSettings(prev => ({
        ...prev,
        attendanceAlerts: user?.notify_attendance !== false,
        busAlerts: user?.notify_bus !== false,
      }));

      // Check OS permission
      await refreshPermission();
      setLoading(false);
    })();
  }, [user?.notify_attendance, user?.notify_bus]);

  const refreshPermission = async () => {
    if (Platform.OS === 'web') { setOsPermission('granted'); return; }
    const { status } = await Notifications.getPermissionsAsync();
    setOsPermission(status);
  };

  const requestPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setOsPermission(status);
    if (status !== 'granted') {
      // Permission denied — open device Settings
      Linking.openSettings();
    }
  };

  const toggle = async (cat) => {
    const nextValue = !settings[cat.key];
    const updated = { ...settings, [cat.key]: nextValue };
    setSettings(updated);
    setSaving(true);
    try {
      if (cat.remote) {
        await authAPI.updateNotificationSettings({ [cat.field]: nextValue });
        const nextUser = { ...user, [cat.field]: nextValue };
        setUser(nextUser);
        await saveUser(nextUser);
      } else {
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      }
    } catch (err) {
      // Roll back on failure — server rejected it or the request never landed.
      setSettings(prev => ({ ...prev, [cat.key]: !nextValue }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Notification Settings</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const permissionGranted = osPermission === 'granted';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <View style={styles.backBtn}>
          {saving && <ActivityIndicator size="small" color="#FFF" />}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* OS Permission card */}
        <View style={[styles.permCard, permissionGranted ? styles.permCardGranted : styles.permCardDenied]}>
          <Text style={styles.permIcon}>{permissionGranted ? '✅' : '⚠️'}</Text>
          <View style={styles.permInfo}>
            <Text style={styles.permTitle}>
              {permissionGranted ? 'Notifications Enabled' : 'Notifications Disabled'}
            </Text>
            <Text style={styles.permDesc}>
              {permissionGranted
                ? 'Your device is set to receive notifications.'
                : 'Enable notifications in device Settings to receive alerts.'}
            </Text>
          </View>
          {!permissionGranted && (
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnText}>Enable</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Types</Text>
          <View style={styles.card}>
            {CATEGORIES.map((cat, idx) => (
              <View
                key={cat.key}
                style={[styles.row, idx < CATEGORIES.length - 1 && styles.rowBorder]}
              >
                <View style={[styles.iconBox, { backgroundColor: cat.color + '20' }]}>
                  <Text style={styles.iconText}>{cat.icon}</Text>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowLabel}>{cat.label}</Text>
                  <Text style={styles.rowDesc}>{cat.desc}</Text>
                </View>
                <Switch
                  value={permissionGranted ? settings[cat.key] : false}
                  onValueChange={() => permissionGranted && toggle(cat)}
                  trackColor={{ false: COLORS.border, true: cat.color + '80' }}
                  thumbColor={settings[cat.key] && permissionGranted ? cat.color : '#FFF'}
                  disabled={!permissionGranted}
                />
              </View>
            ))}
          </View>
        </View>

        {!permissionGranted && (
          <Text style={styles.disabledNote}>
            All toggles are disabled until notifications are enabled in device Settings.
          </Text>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: ms(16), paddingVertical: ms(14),
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: fs(18), fontWeight: '700', color: '#FFF' },

  scroll: { padding: ms(16), gap: ms(16), paddingBottom: ms(40) },

  permCard: {
    flexDirection: 'row', alignItems: 'center', gap: ms(12),
    borderRadius: ms(14), padding: ms(14), borderWidth: 1,
  },
  permCardGranted: { backgroundColor: '#F1F8E9', borderColor: '#C5E1A5' },
  permCardDenied:  { backgroundColor: '#FFF8E1', borderColor: '#FFE082' },
  permIcon:  { fontSize: fs(22) },
  permInfo:  { flex: 1 },
  permTitle: { fontSize: fs(14), fontWeight: '700', color: COLORS.textDark, marginBottom: ms(2) },
  permDesc:  { fontSize: fs(12), color: COLORS.textGray, lineHeight: fs(16) },
  permBtn: {
    backgroundColor: COLORS.primary, borderRadius: ms(8),
    paddingHorizontal: ms(12), paddingVertical: ms(6),
  },
  permBtnText: { fontSize: fs(12), fontWeight: '700', color: '#FFF' },

  section:      { gap: ms(8) },
  sectionTitle: { fontSize: fs(12), fontWeight: '700', color: COLORS.textGray, letterSpacing: 0.5, marginLeft: ms(4) },

  card: {
    backgroundColor: '#FFF', borderRadius: ms(14),
    ...SHADOWS.sm,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: ms(16), paddingVertical: ms(14), gap: ms(12),
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  iconBox: { width: s(40), height: s(40), borderRadius: ms(10), alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: fs(20) },
  rowInfo:  { flex: 1 },
  rowLabel: { fontSize: fs(14), fontWeight: '600', color: COLORS.textDark, marginBottom: ms(2) },
  rowDesc:  { fontSize: fs(12), color: COLORS.textGray, lineHeight: fs(16) },

  disabledNote: {
    textAlign: 'center', fontSize: fs(12),
    color: COLORS.textLight, fontStyle: 'italic', paddingHorizontal: ms(20),
  },
  backBtn: { width: s(44), alignItems: 'flex-end', justifyContent: 'center' },
});
