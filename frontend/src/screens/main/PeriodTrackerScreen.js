import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SYMPTOMS = ['😣 Cramps', '🤰 Bloating', '😔 Mood', '😴 Fatigue', '🤕 Headache', '🍫 Cravings'];

const PHASE_INFO = {
  menstrual: { name: 'Menstrual Phase', color: colors.pink, bg: colors.lightPink, desc: 'Your body is shedding the uterine lining. Rest and warm foods are recommended.', tip: '🍵 Focus: Iron-rich foods, warm herbal teas, gentle movement' },
  follicular: { name: 'Follicular Phase', color: colors.blue, bg: colors.blueBg, desc: 'Estrogen starts rising. Energy levels begin to increase — a good time to exercise.', tip: '🥗 Focus: Antioxidant foods, lean protein, leafy greens' },
  ovulatory: { name: 'Ovulatory Phase', color: colors.purple, bg: colors.lavender, desc: 'Your body is releasing an egg. Estrogen peaks and energy levels are high.', tip: '🥑 Focus: Protein, iron-rich foods, leafy greens' },
  luteal: { name: 'Luteal Phase', color: colors.amber, bg: colors.amberBg, desc: 'Progesterone rises after ovulation. You may experience some PMS symptoms.', tip: '🍫 Focus: Magnesium-rich foods, complex carbs, reduce caffeine' },
  unknown: { name: 'No Data Yet', color: colors.textSecondary, bg: colors.lavender, desc: 'Log your period to start tracking your cycle phases and get personalized tips.', tip: '👆 Tap two dates on the calendar: start, then end' },
};

function buildCalendar(year, month) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function RangeConfirmModal({ visible, startLabel, endLabel, duration, onClose, onConfirm, loading }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={dm.overlay}>
        <View style={dm.sheet}>
          <Text style={dm.emoji}>🔴</Text>
          <Text style={dm.title}>Log This Period?</Text>
          <View style={dm.rangeBox}>
            <View style={dm.rangeCol}>
              <Text style={dm.rangeLabel}>START</Text>
              <Text style={dm.rangeVal}>{startLabel}</Text>
            </View>
            <Text style={dm.rangeArrow}>→</Text>
            <View style={dm.rangeCol}>
              <Text style={dm.rangeLabel}>END</Text>
              <Text style={dm.rangeVal}>{endLabel}</Text>
            </View>
          </View>
          <Text style={dm.durationTxt}>{duration} day{duration !== 1 ? 's' : ''} duration</Text>
          <View style={dm.btnRow}>
            <TouchableOpacity style={dm.cancelBtn} onPress={onClose}>
              <Text style={dm.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dm.confirmBtn} onPress={onConfirm} disabled={loading}>
              <LinearGradient colors={['#E5457A', '#9B4DB5']} style={dm.confirmGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={dm.confirmTxt}>Confirm ✓</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function PeriodTrackerScreen({ navigation }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [periodDays, setPeriodDays] = useState([]);
  const [predictedDays, setPredictedDays] = useState([]);
  const [phase, setPhase] = useState('unknown');
  const [phaseDay, setPhaseDay] = useState(0);
  const [symptoms, setSymptoms] = useState([]);
  const [predictions, setPredictions] = useState({ nextPeriod: '—', ovulationWindow: '—', avgCycle: '28d' });
  const [regularity, setRegularity] = useState({ status: null, message: '', avgCycle: null, variance: null });
  const [hasAssessment, setHasAssessment] = useState(true); // assume true until checked, so the button doesn't flash in
  const [loading, setLoading] = useState(false);

  const [pendingStart, setPendingStart] = useState(null);
  const [pendingEnd, setPendingEnd] = useState(null);
  const [showRangeModal, setShowRangeModal] = useState(false);

  const cells = buildCalendar(viewYear, viewMonth);
  const today = now.getDate();
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth() + 1;

  useEffect(() => { loadCalendarData(); }, [viewYear, viewMonth]);
  useEffect(() => { loadPhaseAndPredictions(); loadTodaySymptoms(); loadRegularity(); loadAssessmentStatus(); }, []);

  const loadCalendarData = async () => {
    try {
      const res = await api.get(`/period/calendar?month=${viewMonth}&year=${viewYear}`);
      setPeriodDays(res.data?.periodDays || []);
      setPredictedDays(res.data?.predictedDays || []);
    } catch (_) {}
  };

  const loadPhaseAndPredictions = async () => {
    try {
      const phaseRes = await api.get('/period/phase');
      setPhase(phaseRes.data?.phase_name?.toLowerCase() || 'unknown');
      setPhaseDay(phaseRes.data?.day_of_cycle || 0);
    } catch (_) {}
    try {
      const predRes = await api.get('/period/predictions');
      setPredictions({
        nextPeriod: predRes.data?.nextPeriod || '—',
        ovulationWindow: predRes.data?.ovulationWindow || '—',
        avgCycle: predRes.data?.avgCycle || '28d',
      });
    } catch (_) {}
  };

  const loadRegularity = async () => {
    try {
      const res = await api.get('/period/regularity');
      setRegularity(res.data || {});
    } catch (_) {}
  };

  const loadAssessmentStatus = async () => {
    try {
      await api.get('/pcos/risk');
      setHasAssessment(true);
    } catch (err) {
      setHasAssessment(err?.response?.status !== 404);
    }
  };

  const loadTodaySymptoms = async () => {
    try {
      const res = await api.get('/period/symptoms/today');
      setSymptoms(res.data?.symptoms || []);
    } catch (_) {}
  };

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const toggleSymptom = async (sym) => {
    const updated = symptoms.includes(sym) ? symptoms.filter(x => x !== sym) : [...symptoms, sym];
    setSymptoms(updated);
    try { await api.post('/period/symptoms', { symptoms: updated }); } catch (_) {}
  };

  const dateToObj = (day) => new Date(viewYear, viewMonth - 1, day);

  const onDayPress = (d) => {
    if (!d) return;
    const tapped = dateToObj(d);
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (tapped > todayDate) return;

    if (!pendingStart) {
      setPendingStart({ day: d, month: viewMonth, year: viewYear });
      setPendingEnd(null);
      return;
    }

    const startObj = new Date(pendingStart.year, pendingStart.month - 1, pendingStart.day);
    if (tapped < startObj) {
      setPendingStart({ day: d, month: viewMonth, year: viewYear });
      setPendingEnd(null);
      return;
    }

    const diffDays = Math.round((tapped - startObj) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 14) {
      Alert.alert('Too Long', 'Period duration cannot exceed 14 days. Please select a closer end date.');
      return;
    }

    setPendingEnd({ day: d, month: viewMonth, year: viewYear });
    setShowRangeModal(true);
  };

  const cancelSelection = () => {
    setPendingStart(null);
    setPendingEnd(null);
    setShowRangeModal(false);
  };

  const confirmRangeLog = async () => {
    if (!pendingStart || !pendingEnd) return;
    setLoading(true);
    const startStr = `${pendingStart.year}-${String(pendingStart.month).padStart(2, '0')}-${String(pendingStart.day).padStart(2, '0')}`;
    const startObj = new Date(pendingStart.year, pendingStart.month - 1, pendingStart.day);
    const endObj = new Date(pendingEnd.year, pendingEnd.month - 1, pendingEnd.day);
    const duration = Math.round((endObj - startObj) / (1000 * 60 * 60 * 24)) + 1;

    try {
      await api.post('/period/start', { start_date: startStr, duration_days: duration });
      setShowRangeModal(false);
      Alert.alert('Logged! 🌸', `Period saved: ${duration} day${duration !== 1 ? 's' : ''}`);
      setPendingStart(null);
      setPendingEnd(null);
      loadCalendarData();
      loadPhaseAndPredictions();
      loadRegularity();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not log period');
    } finally {
      setLoading(false);
    }
  };

  const handleStartPeriod = async () => {
    setLoading(true);
    try {
      await api.post('/period/start');
      Alert.alert('Period Started 🌸', 'Your period has been logged for today!');
      loadCalendarData();
      loadPhaseAndPredictions();
      loadRegularity();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not start period');
    } finally {
      setLoading(false);
    }
  };

  const handleEndPeriod = async () => {
    setLoading(true);
    try {
      const res = await api.put('/period/end', {});
      Alert.alert('Period Ended 🌸', `Duration: ${res.data?.duration_days || 5} days`);
      loadCalendarData();
      loadRegularity();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not end period');
    } finally {
      setLoading(false);
    }
  };

  const phaseInfo = PHASE_INFO[phase] || PHASE_INFO.unknown;

  const getDayStyle = (d) => {
    if (!d) return null;

    if (pendingStart && pendingStart.day === d && pendingStart.month === viewMonth && pendingStart.year === viewYear) {
      return { backgroundColor: colors.pink, borderRadius: 99 };
    }
    if (pendingStart && !pendingEnd) {
      const startObj = new Date(pendingStart.year, pendingStart.month - 1, pendingStart.day);
      const cellObj = dateToObj(d);
      if (cellObj > startObj && pendingStart.month === viewMonth && pendingStart.year === viewYear) {
        return { backgroundColor: 'rgba(229,69,122,0.12)' };
      }
    }

    if (periodDays.includes(d)) return { backgroundColor: 'rgba(229,69,122,0.25)' };
    if (predictedDays.includes(d)) return { backgroundColor: 'rgba(229,69,122,0.10)', borderWidth: 1, borderColor: 'rgba(229,69,122,0.3)', borderStyle: 'dashed' };
    return null;
  };

  const fmtLabel = (sel) => sel ? `${MONTH_NAMES[sel.month - 1]} ${sel.day}, ${sel.year}` : '';
  const rangeDuration = pendingStart && pendingEnd
    ? Math.round((new Date(pendingEnd.year, pendingEnd.month - 1, pendingEnd.day) - new Date(pendingStart.year, pendingStart.month - 1, pendingStart.day)) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  const isIrregular = regularity.status === 'Irregular';
  const hasRegularityData = regularity.status && regularity.status !== 'Not enough data';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <RangeConfirmModal
        visible={showRangeModal}
        startLabel={fmtLabel(pendingStart)}
        endLabel={fmtLabel(pendingEnd)}
        duration={rangeDuration}
        onClose={cancelSelection}
        onConfirm={confirmRangeLog}
        loading={loading}
      />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Period Tracker</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Regularity Badge */}
        {hasRegularityData && (
          <View style={[s.regBanner, { backgroundColor: isIrregular ? colors.lightPink : colors.greenBg }]}>
            <Text style={{ fontSize: 18 }}>{isIrregular ? '⚠️' : '✅'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.regTitle, { color: isIrregular ? colors.pink : '#1a8a5c' }]}>
                {isIrregular ? 'Irregular Cycle Detected' : 'Regular Cycle'}
              </Text>
              <Text style={[s.regSub, { color: isIrregular ? colors.pink : '#1a8a5c' }]}>
                {regularity.message}
              </Text>
              {isIrregular && (
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {!hasAssessment && (
                    <TouchableOpacity style={s.gynoBtn} onPress={() => navigation.navigate('Questionnaire')}>
                      <Text style={s.gynoBtnTxt}>📋 Take the PCOS Assessment</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={s.gynoBtn} onPress={() => navigation.navigate('HealthAssistant', { initialTab: 'doctors' })}>
                    <Text style={s.gynoBtnTxt}>👩‍⚕️ Find a Gynecologist</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={s.card}>
          <View style={s.calHeader}>
            <TouchableOpacity style={s.calNav} onPress={prevMonth}><Text style={s.calNavTxt}>‹</Text></TouchableOpacity>
            <Text style={s.calMonth}>{MONTH_NAMES[viewMonth - 1]} {viewYear}</Text>
            <TouchableOpacity style={s.calNav} onPress={nextMonth}><Text style={s.calNavTxt}>›</Text></TouchableOpacity>
          </View>
          <View style={s.calGrid}>
            {DAYS.map((d, i) => <Text key={i} style={s.dayLabel}>{d}</Text>)}
            {cells.map((d, i) => (
              <TouchableOpacity key={i} disabled={!d} activeOpacity={0.6} onPress={() => onDayPress(d)} style={[s.dayCell, d && getDayStyle(d), isCurrentMonth && d === today && s.dayCellToday]}>
                {d && <Text style={[s.dayNum, isCurrentMonth && d === today && s.dayNumToday]}>{d}</Text>}
              </TouchableOpacity>
            ))}
          </View>

          {pendingStart && !pendingEnd ? (
            <View style={s.hintBoxActive}>
              <Text style={s.hintActiveTxt}>📍 Start: {fmtLabel(pendingStart)} — now tap the end date</Text>
              <TouchableOpacity onPress={cancelSelection}><Text style={s.hintCancelTxt}>Cancel</Text></TouchableOpacity>
            </View>
          ) : (
            <Text style={s.tapHint}>💡 Tap a start date, then an end date to log a period</Text>
          )}

          <View style={s.legend}>
            <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: 'rgba(229,69,122,0.25)' }]} /><Text style={s.legendTxt}>Period</Text></View>
            <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: 'rgba(229,69,122,0.10)', borderWidth: 1, borderColor: 'rgba(229,69,122,0.3)' }]} /><Text style={s.legendTxt}>Predicted</Text></View>
            <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: colors.pink, borderRadius: 99 }]} /><Text style={s.legendTxt}>Today</Text></View>
          </View>
        </View>

        <View style={[s.phaseCard, { backgroundColor: phaseInfo.bg }]}>
          <Text style={[s.phaseName, { color: phaseInfo.color }]}>{phaseInfo.name}</Text>
          {phaseDay > 0 && <Text style={[s.phaseDay, { color: phaseInfo.color }]}>Day {phaseDay} of your cycle</Text>}
          <Text style={s.phaseDesc}>{phaseInfo.desc}</Text>
          <Text style={[s.phaseTip, { color: phaseInfo.color }]}>{phaseInfo.tip}</Text>
        </View>

        <View style={s.actionRow}>
          <TouchableOpacity style={s.startBtn} onPress={handleStartPeriod} disabled={loading}>
            <LinearGradient colors={['#E5457A', '#C73568']} style={s.actionBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.actionBtnTxt}>🔴 Period Started Today</Text>}
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={s.endBtn} onPress={handleEndPeriod} disabled={loading}>
            <Text style={s.endBtnTxt}>⬛ End Period</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.sectionTitle}>Log Symptoms Today</Text>
        <View style={s.symptomWrap}>
          {SYMPTOMS.map(sym => (
            <TouchableOpacity key={sym} style={[s.symptomTag, symptoms.includes(sym) && s.symptomTagActive]} onPress={() => toggleSymptom(sym)}>
              <Text style={[s.symptomTxt, symptoms.includes(sym) && s.symptomTxtActive]}>{sym}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.sectionTitle}>Predictions</Text>
        <View style={s.card}>
          <View style={s.predRow}>
            <View style={s.predCol}>
              <Text style={s.predVal}>{predictions.nextPeriod}</Text>
              <Text style={s.predLabel}>Next Period</Text>
            </View>
            <View style={s.predDivider} />
            <View style={s.predCol}>
              <Text style={[s.predVal, { color: colors.purple }]}>{predictions.ovulationWindow}</Text>
              <Text style={s.predLabel}>Ovulation Window</Text>
            </View>
            <View style={s.predDivider} />
            <View style={s.predCol}>
              <Text style={s.predVal}>{predictions.avgCycle}</Text>
              <Text style={s.predLabel}>Avg. Cycle</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const dm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: colors.surface, borderRadius: 24, padding: 24, width: '100%', alignItems: 'center', gap: 8 },
  emoji: { fontSize: 36 },
  title: { fontSize: 17, fontWeight: '900', color: colors.textPrimary },
  rangeBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.lavender, borderRadius: 16, padding: 14, marginTop: 8, width: '100%', justifyContent: 'center' },
  rangeCol: { alignItems: 'center', gap: 2 },
  rangeLabel: { fontSize: 9, fontWeight: '800', color: colors.purple, letterSpacing: 1 },
  rangeVal: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  rangeArrow: { fontSize: 18, color: colors.purple },
  durationTxt: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginTop: 4, marginBottom: 4 },
  btnRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: colors.border },
  cancelTxt: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  confirmBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  confirmGrad: { paddingVertical: 14, alignItems: 'center', borderRadius: 14 },
  confirmTxt: { fontSize: 13, fontWeight: '800', color: '#fff' },
});

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingHorizontal: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: colors.purple, fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  scroll: { padding: 16, gap: 12 },
  regBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 16 },
  regTitle: { fontSize: 13, fontWeight: '800' },
  regSub: { fontSize: 11, marginTop: 3, lineHeight: 16 },
  gynoBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: colors.pink, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99 },
  gynoBtnTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calNav: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  calNavTxt: { fontSize: 18, color: colors.purple, fontWeight: '700' },
  calMonth: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayLabel: { width: '14.28%', textAlign: 'center', fontSize: 11, fontWeight: '800', color: colors.textSecondary, paddingVertical: 4 },
  dayCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  dayCellToday: { backgroundColor: colors.pink, borderRadius: 99 },
  dayNum: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  dayNumToday: { color: '#fff', fontWeight: '900' },
  tapHint: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
  hintBoxActive: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.lightPink, borderRadius: 12, padding: 10, marginTop: 8 },
  hintActiveTxt: { fontSize: 11, color: colors.pink, fontWeight: '700', flex: 1 },
  hintCancelTxt: { fontSize: 11, color: colors.pink, fontWeight: '900', textDecorationLine: 'underline' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendTxt: { fontSize: 10, color: colors.textSecondary, fontWeight: '700' },
  phaseCard: { borderRadius: 20, padding: 16, gap: 8 },
  phaseName: { fontSize: 17, fontWeight: '900' },
  phaseDay: { fontSize: 12, fontWeight: '700' },
  phaseDesc: { fontSize: 13, color: colors.textPrimary, lineHeight: 20 },
  phaseTip: { fontSize: 12, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8 },
  startBtn: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  actionBtnGrad: { paddingVertical: 14, alignItems: 'center', borderRadius: 16 },
  actionBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  endBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  endBtnTxt: { fontWeight: '800', fontSize: 13, color: colors.textPrimary },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  symptomWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  symptomTag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  symptomTagActive: { backgroundColor: colors.lightPink, borderColor: colors.pink },
  symptomTxt: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  symptomTxtActive: { color: colors.pink },
  predRow: { flexDirection: 'row', alignItems: 'center' },
  predCol: { flex: 1, alignItems: 'center', gap: 4 },
  predDivider: { width: 1, height: 40, backgroundColor: colors.border },
  predVal: { fontSize: 15, fontWeight: '900', color: colors.textPrimary },
  predLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
});