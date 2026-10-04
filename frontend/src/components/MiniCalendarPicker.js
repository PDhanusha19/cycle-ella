import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';

export const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function buildCalendarCells(year, month) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

// Shared date-grid used by both the Period Tracker (marking logged/predicted
// days, tap-to-log-or-edit) and onboarding backdating (plain date selection).
// The parent owns all selection/marking state — this component only renders
// the grid and reports taps.
export default function MiniCalendarPicker({
  year, month, onPrevMonth, onNextMonth,
  onDayPress, getDayStyle, disableFutureDates = true,
}) {
  const now = new Date();
  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const cells = buildCalendarCells(year, month);

  const isFuture = (d) => {
    if (!disableFutureDates) return false;
    const cellDate = new Date(year, month - 1, d);
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return cellDate > todayDate;
  };

  return (
    <View>
      <View style={s.calHeader}>
        <TouchableOpacity style={s.calNav} onPress={onPrevMonth}><Text style={s.calNavTxt}>‹</Text></TouchableOpacity>
        <Text style={s.calMonth}>{MONTH_NAMES[month - 1]} {year}</Text>
        <TouchableOpacity style={s.calNav} onPress={onNextMonth}><Text style={s.calNavTxt}>›</Text></TouchableOpacity>
      </View>
      <View style={s.calGrid}>
        {DAYS.map((d, i) => <Text key={i} style={s.dayLabel}>{d}</Text>)}
        {cells.map((d, i) => {
          const future = !!d && isFuture(d);
          return (
            <TouchableOpacity
              key={i}
              disabled={!d || future}
              activeOpacity={0.6}
              onPress={() => onDayPress(d)}
              style={[
                s.dayCell,
                d && getDayStyle && getDayStyle(d),
                isCurrentMonth && d === today && s.dayCellToday,
                future && s.dayCellDisabled,
              ]}
            >
              {d && (
                <Text style={[s.dayNum, isCurrentMonth && d === today && s.dayNumToday, future && s.dayNumDisabled]}>
                  {d}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calNav: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  calNavTxt: { fontSize: 18, color: colors.purple, fontWeight: '700' },
  calMonth: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayLabel: { width: '14.28%', textAlign: 'center', fontSize: 11, fontWeight: '800', color: colors.textSecondary, paddingVertical: 4 },
  dayCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  dayCellToday: { backgroundColor: colors.pink, borderRadius: 99 },
  dayCellDisabled: { opacity: 0.3 },
  dayNum: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  dayNumToday: { color: '#fff', fontWeight: '900' },
  dayNumDisabled: { color: colors.textSecondary },
});
