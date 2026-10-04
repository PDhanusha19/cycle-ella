import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';
import MiniCalendarPicker, { MONTH_NAMES } from '../../components/MiniCalendarPicker';

const toISO = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function rangesOverlap(aStart, aDur, bStart, bDur) {
  const aEnd = new Date(aStart); aEnd.setDate(aEnd.getDate() + (aDur || 5) - 1);
  const bEnd = new Date(bStart); bEnd.setDate(bEnd.getDate() + (bDur || 5) - 1);
  return new Date(aStart) <= bEnd && new Date(bStart) <= aEnd;
}

export default function PeriodHistoryScreen({ navigation }) {
  const now = new Date();
  const [pendingEntries, setPendingEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  // Precise-date (calendar tap) mode
  const [pickerYear, setPickerYear] = useState(now.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(now.getMonth() + 1);
  const [activeTap, setActiveTap] = useState(null); // { day, month, year }
  const [durationInput, setDurationInput] = useState('5');

  // "I don't remember the exact day" mode — month/year only
  const [estimateMode, setEstimateMode] = useState(false);
  const [estimateMonth, setEstimateMonth] = useState(now.getMonth() + 1);
  const [estimateYear, setEstimateYear] = useState(now.getFullYear());
  const [estimateDuration, setEstimateDuration] = useState('5');

  const prevMonth = () => {
    if (pickerMonth === 1) { setPickerMonth(12); setPickerYear(y => y - 1); }
    else setPickerMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (pickerMonth === 12) { setPickerMonth(1); setPickerYear(y => y + 1); }
    else setPickerMonth(m => m + 1);
  };

  const prevEstimateMonth = () => {
    if (estimateMonth === 1) { setEstimateMonth(12); setEstimateYear(y => y - 1); }
    else setEstimateMonth(m => m - 1);
  };
  const nextEstimateMonth = () => {
    if (estimateMonth === 12) { setEstimateMonth(1); setEstimateYear(y => y + 1); }
    else setEstimateMonth(m => m + 1);
  };

  const onDayPress = (d) => {
    if (!d) return;
    setActiveTap({ day: d, month: pickerMonth, year: pickerYear });
    setDurationInput('5');
  };

  const addPrecise = () => {
    if (!activeTap) return;
    const duration = parseInt(durationInput) || 5;
    const start_date = toISO(activeTap.year, activeTap.month, activeTap.day);
    const overlap = pendingEntries.find(e => rangesOverlap(start_date, duration, e.start_date, e.duration_days));
    if (overlap) {
      Alert.alert('Overlapping Dates', 'This period overlaps one you already added below. Adjust the date or remove the other entry first.');
      return;
    }
    setPendingEntries(prev => [...prev, { start_date, duration_days: duration, is_estimated: false }].sort((a, b) => a.start_date.localeCompare(b.start_date)));
    setActiveTap(null);
  };

  const addEstimate = () => {
    const duration = parseInt(estimateDuration) || 5;
    const start_date = toISO(estimateYear, estimateMonth, 1);
    const overlap = pendingEntries.find(e => rangesOverlap(start_date, duration, e.start_date, e.duration_days));
    if (overlap) {
      Alert.alert('Overlapping Dates', 'This overlaps a period you already added below.');
      return;
    }
    setPendingEntries(prev => [...prev, { start_date, duration_days: duration, is_estimated: true }].sort((a, b) => a.start_date.localeCompare(b.start_date)));
    setEstimateMode(false);
  };

  const removeEntry = (start_date) => {
    setPendingEntries(prev => prev.filter(e => e.start_date !== start_date));
  };

  const fmtEntry = (e) => {
    const d = new Date(e.start_date);
    const label = e.is_estimated
      ? `Around ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
      : `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    return `${label} · ${e.duration_days} day${e.duration_days !== 1 ? 's' : ''}${e.is_estimated ? ' · estimated' : ''}`;
  };

  const handleComplete = async () => {
    if (pendingEntries.length === 0) { navigation.navigate('Questionnaire'); return; }
    setLoading(true);
    try {
      await api.post('/period/history', { periods: pendingEntries });
      navigation.navigate('Questionnaire');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || "Couldn't save your period history. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => navigation.navigate('Questionnaire');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Period History</Text>
        <Text style={s.stepLabel}>Step 3 of 5</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.stepBar}>
          {[0, 1, 2].map(i => <View key={i} style={[s.stepSeg, s.stepSegDone]} />)}
          <View style={s.stepSeg} />
          <View style={s.stepSeg} />
        </View>

        <Text style={s.hint}>Add as many past periods as you can remember — the more real dates you add, the sooner your cycle tracking becomes useful. Tap a date below to add one.</Text>

        {!estimateMode ? (
          <View style={s.card}>
            <MiniCalendarPicker
              year={pickerYear}
              month={pickerMonth}
              onPrevMonth={prevMonth}
              onNextMonth={nextMonth}
              onDayPress={onDayPress}
              disableFutureDates
              getDayStyle={(d) => {
                if (activeTap && activeTap.day === d && activeTap.month === pickerMonth && activeTap.year === pickerYear) {
                  return { backgroundColor: colors.pink, borderRadius: 99 };
                }
                const iso = toISO(pickerYear, pickerMonth, d);
                if (pendingEntries.some(e => e.start_date === iso)) {
                  return { backgroundColor: 'rgba(229,69,122,0.25)' };
                }
                return null;
              }}
            />

            {activeTap && (
              <View style={s.confirmRow}>
                <View style={[s.field, { flex: 1 }]}>
                  <Text style={s.label}>DURATION (DAYS)</Text>
                  <TextInput style={s.input} value={durationInput} onChangeText={setDurationInput} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
                </View>
                <TouchableOpacity style={s.addBtn} onPress={addPrecise}>
                  <Text style={s.addBtnTxt}>Add</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.cancelTapBtn} onPress={() => setActiveTap(null)}>
                  <Text style={s.cancelTapTxt}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={s.estimateLink} onPress={() => setEstimateMode(true)}>
              <Text style={s.estimateLinkTxt}>I don't remember the exact day →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.card}>
            <Text style={s.estimateTitle}>Roughly which month?</Text>
            <View style={s.calHeader}>
              <TouchableOpacity style={s.calNav} onPress={prevEstimateMonth}><Text style={s.calNavTxt}>‹</Text></TouchableOpacity>
              <Text style={s.calMonth}>{MONTH_NAMES[estimateMonth - 1]} {estimateYear}</Text>
              <TouchableOpacity style={s.calNav} onPress={nextEstimateMonth}><Text style={s.calNavTxt}>›</Text></TouchableOpacity>
            </View>
            <View style={s.confirmRow}>
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.label}>DURATION (DAYS)</Text>
                <TextInput style={s.input} value={estimateDuration} onChangeText={setEstimateDuration} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
              </View>
              <TouchableOpacity style={s.addBtn} onPress={addEstimate}>
                <Text style={s.addBtnTxt}>Add</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.estimateLink} onPress={() => setEstimateMode(false)}>
              <Text style={s.estimateLinkTxt}>← Back to exact date</Text>
            </TouchableOpacity>
          </View>
        )}

        {pendingEntries.length > 0 && (
          <View style={s.entriesWrap}>
            <Text style={s.label}>PERIODS ADDED</Text>
            {pendingEntries.map((e) => (
              <View key={e.start_date} style={s.entryPill}>
                <Text style={s.entryPillTxt}>{fmtEntry(e)}</Text>
                <TouchableOpacity onPress={() => removeEntry(e.start_date)}>
                  <Text style={s.entryPillRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={s.primaryBtn} onPress={handleComplete} disabled={loading} activeOpacity={0.85}>
          <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Complete Setup 🎉</Text>}
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={s.skipBtn} onPress={handleSkip}>
          <Text style={s.skipBtnTxt}>Skip — I'll add this later</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingHorizontal: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: colors.purple, fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  stepLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  scroll: { padding: 20, gap: 16 },
  stepBar: { flexDirection: 'row', gap: 8 },
  stepSeg: { flex: 1, height: 4, borderRadius: 99, backgroundColor: colors.border },
  stepSegDone: { backgroundColor: colors.pink },
  hint: { fontSize: 12, color: colors.textSecondary, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 16, gap: 12 },
  confirmRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  field: { gap: 8 },
  label: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { padding: 14, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  addBtn: { backgroundColor: colors.pink, paddingHorizontal: 18, paddingVertical: 15, borderRadius: 14 },
  addBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  cancelTapBtn: { width: 44, height: 47, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelTapTxt: { fontSize: 14, color: colors.textSecondary, fontWeight: '800' },
  estimateLink: { alignSelf: 'center', marginTop: 4 },
  estimateLinkTxt: { fontSize: 12, color: colors.purple, fontWeight: '700' },
  estimateTitle: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calNav: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  calNavTxt: { fontSize: 18, color: colors.purple, fontWeight: '700' },
  calMonth: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  entriesWrap: { gap: 8 },
  entryPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.lavender, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  entryPillTxt: { fontSize: 12, fontWeight: '700', color: colors.purple, flex: 1 },
  entryPillRemove: { fontSize: 13, color: colors.purple, fontWeight: '900', marginLeft: 8 },
  primaryBtn: { borderRadius: 16, overflow: 'hidden', shadowColor: '#E5457A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 8 },
  primaryGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: 16 },
  primaryTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  skipBtn: { paddingVertical: 16, alignItems: 'center' },
  skipBtnTxt: { fontSize: 15, color: colors.textSecondary, fontWeight: '700' },
});
