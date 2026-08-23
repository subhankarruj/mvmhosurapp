import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../constants/colors';
import { SCHOOL_CONFIG } from '../config/appConfig';
import { useUser } from '../context/UserContext';
import { authAPI } from '../services/apiService';
import { s, ms, fs } from '../utils/responsive';
import { goToLogin } from '../utils/navigation';
import { ERR_SESSION_EXPIRED } from '../constants/errors';

const MENU_ITEMS = [
  { id: 'notif', icon: '🔔', label: 'Notification Settings', color: '#F57C00' },
];

export default function ProfileScreen({ navigation }) {
  const { user, setUser } = useUser();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Re-fetch every time this screen gains focus.
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const data = await authAPI.me();
          if (!cancelled) setProfile(data);
        } catch (err) {
          if (err.message === ERR_SESSION_EXPIRED) {
            setUser(null);
            goToLogin(navigation);
            return;
          }
          // Fall back to locally cached user if API temporarily unavailable
          if (user && !cancelled) {
            // Normalize camelCase login-response fields to match /me response shape
            setProfile({ ...user, school_name: user.school_name ?? user.schoolName });
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive', onPress: async () => {
          await authAPI.logout().catch(() => {});
          setUser(null);
          goToLogin(navigation);
        },
      },
    ]);
  };

  const infoRows = profile ? [
    { label: 'Name',           value: profile.name,                                              icon: '👤' },
    { label: 'Class',          value: (profile.grade && profile.section) ? `${profile.grade} - ${profile.section}` : '—', icon: '🎓' },
    { label: 'Roll No.',       value: profile.admission_number || '—',                            icon: '🔖' },
    { label: 'Date of Birth',  value: profile.date_of_birth ? profile.date_of_birth.split('T')[0] : '—', icon: '🎂' },
    { label: 'Contact Number', value: profile.phone        || '—',                               icon: '📞' },
    { label: 'School Name',    value: profile.school_name  || SCHOOL_CONFIG.name,                icon: '🏫' },
    // Read-only — sourced from SmartOffice's Employees.Location, not editable
    // by the student (see authController.js `bus_stand`).
    { label: 'Bus Stand',      value: profile.bus_stand    || '—',                               icon: '🚌' },
  ] : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Student Details */}
        <Text style={styles.sectionTitle}>Student Details</Text>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading profile…</Text>
          </View>
        ) : (
          infoRows.map((row, idx) => {
            const RowWrapper = row.editable ? TouchableOpacity : View;
            return (
              <RowWrapper
                key={row.label}
                style={[styles.row, idx === infoRows.length - 1 && styles.rowLast]}
                {...(row.editable ? { onPress: row.onPress, activeOpacity: 0.6 } : {})}
              >
                <Text style={styles.rowIcon}>{row.icon}</Text>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowValue}>{row.value}</Text>
                </View>
                {row.editable && <Text style={styles.editIcon}>✏️</Text>}
              </RowWrapper>
            );
          })
        )}

        {/* Settings */}
        <Text style={styles.sectionTitle}>Settings</Text>
        {MENU_ITEMS.map((item, idx) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.row, idx === MENU_ITEMS.length - 1 && styles.rowLast]}
            activeOpacity={0.6}
            onPress={() => {
              if (item.id === 'notif') navigation.navigate('NotificationSettings');
            }}
          >
            <View style={[styles.menuIconBox, { backgroundColor: item.color + '20' }]}>
              <Text style={styles.rowIcon}>{item.icon}</Text>
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>🚪  Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>MVM v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },

  sectionTitle: {
    fontSize: fs(12), fontWeight: '700',
    color: COLORS.textGray, letterSpacing: 0.6,
    paddingHorizontal: ms(20), paddingTop: ms(24), paddingBottom: ms(8),
    textTransform: 'uppercase',
  },

  loadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: ms(10),
    paddingHorizontal: ms(20), paddingVertical: ms(20),
  },
  loadingText: { fontSize: fs(14), color: COLORS.textGray },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: ms(20), paddingVertical: ms(14),
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: '#FFF',
  },
  rowLast:    { borderBottomWidth: 0 },
  rowIcon:    { fontSize: fs(18), marginRight: ms(14) },
  rowContent: { flex: 1 },
  rowLabel:   { fontSize: fs(11), color: COLORS.textGray, marginBottom: ms(2) },
  rowValue:   { fontSize: fs(14), fontWeight: '600', color: COLORS.textDark },
  editIcon:   { fontSize: fs(15), marginLeft: ms(8) },

  menuIconBox: {
    width: s(34), height: s(34), borderRadius: ms(8),
    alignItems: 'center', justifyContent: 'center', marginRight: ms(14),
  },
  menuLabel: { flex: 1, fontSize: fs(14), fontWeight: '600', color: COLORS.textDark },
  menuArrow: { fontSize: fs(22), color: COLORS.textLight },

  logoutBtn: {
    marginHorizontal: ms(20), marginTop: ms(24),
    borderWidth: 1.5, borderColor: '#FFCDD2',
    borderRadius: ms(12), paddingVertical: ms(14), alignItems: 'center',
  },
  logoutText: { fontSize: fs(15), fontWeight: '700', color: COLORS.primary },

  version: {
    textAlign: 'center', fontSize: fs(11),
    color: COLORS.textLight, marginTop: ms(12), marginBottom: ms(30),
  },
  backBtn: { width: s(40) },
});
