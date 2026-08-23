import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import BackButton from '../components/BackButton';
import { attendanceAPI } from '../services/apiService';
import { cacheService } from '../services/cacheService';
import { useUser } from '../context/UserContext';
import { nowIST } from '../utils/dateUtils';
import { SHADOWS } from '../utils/shadow';
import { s, ms, fs, SCREEN } from '../utils/responsive';

// Calendar circle fits inside a cell that is 1/7 of calendar width.
// Card: mx=16, px=16 each side → available = W - 64. Circle = 72% of cell.
const CELL_W    = Math.floor((SCREEN.W - 64) / 7);
const CIRCLE_SZ = Math.max(26, Math.min(44, Math.floor(CELL_W * 0.72)));

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function AttendanceScreen({ navigation }) {
  const today = nowIST();
  const { user } = useUser();
  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth());
  const [attendanceMap, setAttendanceMap] = useState({});
  const [statCounts, setStatCounts] = useState({ present: 0, absent: 0, holiday: 0, leave: 0 });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isCached, setIsCached] = useState(false);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const applyResult = (result) => {
    const map = {};
    (result.records || []).forEach(rec => {
      const [ry, rm, rd] = rec.date.split('T')[0].split('-').map(Number);
      map[`${ry}-${rm}-${rd}`] = rec.status;
    });
    setAttendanceMap(map);
    setStatCounts(result.summary || { present: 0, absent: 0, holiday: 0, leave: 0 });
  };

  const fetchAttendance = useCallback(async (y, m) => {
    if (!user) {
      setErrorMsg('Please login again.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setIsCached(false);
    const cacheKey = `attendance_${user.id}_${y}_${m}`;
    try {
      const result = await attendanceAPI.getMonthly(y, m + 1);
      cacheService.set(cacheKey, result);
      applyResult(result);
    } catch (err) {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        applyResult(cached);
        setIsCached(true);
        setErrorMsg('Showing cached data. Check your connection.');
      } else {
        setErrorMsg(err.message || 'Failed to load attendance. No cached data available.');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAttendance(year, month);
  }, [year, month, fetchAttendance]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const getStatus = (day) => attendanceMap[`${year}-${month + 1}-${day}`];

  const getDotColor = (status) => {
    switch (status) {
      case 'present': return COLORS.present;
      case 'absent': return COLORS.absent;
      case 'holiday': return COLORS.holiday;
      case 'leave': return COLORS.leave;
      default: return 'transparent';
    }
  };

  const isToday = (day) =>
    day === today.getUTCDate() && month === today.getUTCMonth() && year === today.getUTCFullYear();

  // Build calendar cells (blanks + days)
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.attendancePurple} />

      {/* Purple header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Attendance</Text>
        <View style={{ width: s(44) }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Error / cached data banner */}
        {errorMsg ? (
          <View style={[styles.errorBanner, isCached && styles.cachedBanner]}>
            <Text style={[styles.errorText, isCached && styles.cachedText]}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* Month stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statChip, { backgroundColor: '#E8F5E9' }]}>
            <Text style={[styles.statNum, { color: COLORS.present }]}>{statCounts.present}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: '#FFEBEE' }]}>
            <Text style={[styles.statNum, { color: COLORS.absent }]}>{statCounts.absent}</Text>
            <Text style={styles.statLabel}>Absent</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: '#F3E5F5' }]}>
            <Text style={[styles.statNum, { color: COLORS.holiday }]}>{statCounts.holiday}</Text>
            <Text style={styles.statLabel}>Holiday</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: '#E3F2FD' }]}>
            <Text style={[styles.statNum, { color: COLORS.leave }]}>{statCounts.leave}</Text>
            <Text style={styles.statLabel}>Leave</Text>
          </View>
        </View>

        {/* Calendar card */}
        <View style={styles.calendarCard}>
          {/* Month nav */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
              <Text style={styles.navArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {MONTHS[month]} {year}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
              <Text style={styles.navArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={styles.dayHeaderRow}>
            {DAYS.map((d) => (
              <Text
                key={d}
                style={[
                  styles.dayHeader,
                  (d === 'Sun' || d === 'Sat') && styles.weekend,
                ]}
              >
                {d}
              </Text>
            ))}
          </View>

          {/* Loading overlay */}
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={COLORS.attendancePurple} />
            </View>
          )}

          {/* Calendar cells */}
          <View style={styles.daysGrid}>
            {cells.map((day, idx) => {
              if (!day) return <View key={`blank-${idx}`} style={styles.dayCell} />;
              const status = getStatus(day);
              const todayFlag = isToday(day);
              const dotColor = getDotColor(status);
              const colIdx = idx % 7;
              const isWeekend = colIdx === 0 || colIdx === 6;

              return (
                <View key={`day-${day}`} style={styles.dayCell}>
                  <View
                    style={[
                      styles.dayCircle,
                      status && { backgroundColor: dotColor },
                      todayFlag && !status && styles.todayCircle,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNum,
                        isWeekend && styles.weekendNum,
                        status && styles.dayNumOnColor,
                        todayFlag && !status && styles.todayNum,
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legendCard}>
          <Text style={styles.legendHeading}>Legend</Text>
          <View style={styles.legendGrid}>
            {[
              { color: COLORS.present, label: 'Present' },
              { color: COLORS.absent, label: 'Absent' },
              { color: COLORS.holiday, label: 'Holidays' },
              { color: COLORS.leave, label: 'Leave' },
            ].map((item) => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendLabel}>{item.label}</Text>
              </View>
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
    backgroundColor: COLORS.attendancePurple,
    paddingHorizontal: ms(16),
    paddingVertical: ms(14),
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: fs(18),
    fontWeight: '700',
    color: '#FFFFFF',
  },

  scroll: { flex: 1 },

  errorBanner: {
    marginHorizontal: ms(16),
    marginTop: ms(12),
    backgroundColor: '#FFEBEE',
    borderRadius: ms(10),
    paddingVertical: ms(10),
    paddingHorizontal: ms(14),
  },
  cachedBanner: { backgroundColor: '#FFF8E1' },
  errorText: {
    color: COLORS.absent,
    fontSize: fs(13),
    fontWeight: '500',
    textAlign: 'center',
  },
  cachedText: { color: '#E65100' },
  loadingOverlay: { paddingVertical: ms(24), alignItems: 'center' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: ms(16),
    paddingTop: ms(16),
    gap: ms(8),
  },
  statChip: {
    flex: 1,
    borderRadius: ms(10),
    paddingVertical: ms(10),
    alignItems: 'center',
  },
  statNum:   { fontSize: fs(20), fontWeight: '800' },
  statLabel: { fontSize: fs(10), color: COLORS.textGray, marginTop: ms(2) },

  // Calendar
  calendarCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: ms(16),
    marginTop: ms(16),
    borderRadius: ms(16),
    padding: ms(16),
    ...SHADOWS.sm,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: ms(16),
  },
  navBtn: {
    width: s(36),
    height: s(36),
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: {
    fontSize: fs(28),
    color: COLORS.attendancePurple,
    fontWeight: '300',
  },
  monthTitle: {
    fontSize: fs(16),
    fontWeight: '700',
    color: COLORS.attendancePurple,
  },

  dayHeaderRow: { flexDirection: 'row', marginBottom: ms(8) },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: fs(12),
    fontWeight: '700',
    color: COLORS.textGray,
  },
  weekend: { color: COLORS.primary },

  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  dayCircle: {
    width: CIRCLE_SZ,
    height: CIRCLE_SZ,
    borderRadius: CIRCLE_SZ / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: { backgroundColor: COLORS.calendarHighlight },
  dayNum: {
    fontSize: fs(12),
    fontWeight: '500',
    color: COLORS.black,
  },
  weekendNum:    { color: COLORS.primary },
  dayNumOnColor: { color: '#FFFFFF', fontWeight: '700' },
  todayNum:      { color: '#FFFFFF', fontWeight: '700' },

  // Legend
  legendCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: ms(16),
    marginTop: ms(16),
    marginBottom: ms(24),
    borderRadius: ms(16),
    padding: ms(16),
    ...SHADOWS.sm,
  },
  legendHeading: {
    fontSize: fs(14),
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: ms(12),
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ms(12),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '45%',
  },
  legendDot: {
    width: s(26),
    height: s(26),
    borderRadius: s(13),
    marginRight: ms(10),
  },
  legendLabel: {
    fontSize: fs(13),
    color: COLORS.textDark,
    fontWeight: '500',
  },
});
