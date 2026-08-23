import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar,
} from 'react-native';
import { SHADOWS } from '../utils/shadow';
import { s, ms, fs } from '../utils/responsive';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import { useUser } from '../context/UserContext';

const ALL_MODULES = [
  { id: 'bustrack', label: 'Bus Track', icon: '🚌', bg: COLORS.busTrack, screen: 'BusTrack', desc: 'Live bus location tracking' },
  { id: 'attendance', label: 'Attendance', icon: '✅', bg: COLORS.attendance, screen: 'Attendance', desc: 'Monthly attendance calendar' },
];

export default function ModuleScreen({ navigation }) {
  const { user } = useUser();

  // Cached sessions from before feature flags existed have no attendance_enabled /
  // bus_tracking_enabled field — treat "unset" as enabled, matching the DB default.
  const modules = ALL_MODULES.filter(mod => {
    if (mod.id === 'attendance') return user?.attendance_enabled !== false;
    if (mod.id === 'bustrack')   return user?.bus_tracking_enabled !== false;
    return true;
  });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>All Modules</Text>
        <Text style={styles.headerSub}>MVM</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {modules.map((mod) => (
          <TouchableOpacity
            key={mod.id}
            style={styles.row}
            onPress={() => navigation.navigate(mod.screen)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconBox, { backgroundColor: mod.bg }]}>
              <Text style={styles.icon}>{mod.icon}</Text>
            </View>
            <View style={styles.textCol}>
              <Text style={styles.label}>{mod.label}</Text>
              <Text style={styles.desc}>{mod.desc}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: ms(20), paddingTop: ms(20), paddingBottom: ms(14),
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: fs(22), fontWeight: '800', color: COLORS.textDark },
  headerSub: { fontSize: fs(12), color: COLORS.textGray, marginTop: ms(2) },
  list: { padding: ms(16), gap: ms(10) },
  row: {
    backgroundColor: '#FFF', borderRadius: ms(14),
    flexDirection: 'row', alignItems: 'center',
    padding: ms(14),
    ...SHADOWS.sm,
  },
  iconBox: {
    width: s(52), height: s(52), borderRadius: ms(14),
    alignItems: 'center', justifyContent: 'center', marginRight: ms(14),
  },
  icon: { fontSize: fs(26) },
  textCol: { flex: 1 },
  label: { fontSize: fs(15), fontWeight: '700', color: COLORS.textDark },
  desc: { fontSize: fs(12), color: COLORS.textGray, marginTop: ms(2) },
  arrow: { fontSize: fs(24), color: COLORS.textLight },
});
