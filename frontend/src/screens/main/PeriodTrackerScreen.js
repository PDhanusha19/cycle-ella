import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
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
};

function buildCalendar(year, month) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

export default function PeriodTrackerScreen({ navigation }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [periodDays, setPeriodDays] = useState([]);
  const [phase, setPhase] = useState('follicular');
  const [phaseDay, setPhaseDay] = useState(7);
  const [symptoms, setSymptoms] = useState([]);
  const [predictions, setPredictions] = useState({ nextPeriod: 'May 28', ovulationWindow: '14–16', avgCycle: '28d' });

  const cells = buildCalendar(viewYear, viewMonth);
  const today = now.getDate();
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth() + 1;

  useEffect(() => {
    const load = async () => {
      try {
        const [phaseRes, logsRes] = await Promise.allSettled([
          api.get('/period/phase'),
          api.get('/period/history'),
        ]);
        if (phaseRes.status === 'fulfilled') {
          setPhase(phaseRes.value.data?.phase_name?.toLowerCase() || 'follicular');
          setPhaseDay(phaseRes.value.data?.day_of_cycle || 7);
        }
        if (logsRes.status === 'fulfilled') {
          setPeriodDays(logsRes.value.data?.periodDays || []);
        }
      } catch (_) {}
    };
    load();
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const toggleSymptom = (sym) => {
    setSymptoms(s => s.includes(sym) ? s.filter(x => x !== sym) : [...s, sym]);
  };

  const handleStartPeriod = async () => {
    try {
      await api.post('/period/start');
      Alert.alert('Period Started', 'Your period has been logged. 🌸');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not start period');
    }
  };

  const handleEndPeriod = async () => {
    try {
      await api.put('/period/end', { duration_days: 5 });
      Alert.alert('Period Ended', 'End date logged. 🌸');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not end period');
    }
  };

  const phaseInfo = PHASE_INFO[phase] || PHASE_INFO.follicular;

  const getDayStyle = (d) => {
    if (!d) return null;
    if (periodDays.includes(d)) return { backgroundColor: 'rgba(229,69,122,0.25)' };
    if (phase === 'ovulatory' && isCurrentMonth && d >= 14 && d <= 16) return { backgroundColor: 'rgba(155,77,181,0.15)' };
    if (phase === 'luteal' && isCurrentMonth && d >= 18 && d <= 28) return { backgroundColor: colors.lavender };
    return null;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Period Tracker</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <View style={s.calHeader}>
            <TouchableOpacity style={s.calNav} onPress={prevMonth}><Text style={s.calNavTxt}>‹</Text></TouchableOpacity>
            <Text style={s.calMonth}>{MONTH_NAMES[viewMonth - 1]} {viewYear}</Text>
            <TouchableOpacity style={s.calNav} onPress={nextMonth}><Text style={s.calNavTxt}>›</Text></TouchableOpacity>
          </View>
          <View style={s.calGrid}>
            {DAYS.map((d, i) => <Text key={i} style={s.dayLabel}>{d}</Text>)}
            {cells.map((d, i) => (
              <View key={i} style={[s.dayCell, d && getDayStyle(d), isCurrentMonth && d === today && s.dayCellToday]}>
                {d && <Text style={[s.dayNum, isCurrentMonth && d === today && s.dayNumToday]}>{d}</Text>}
              </View>
            ))}
          </View>
          <View style={s.legend}>
            <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: 'rgba(229,69,122,0.25)' }]} /><Text style={s.legendTxt}>Period</Text></View>
            <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: 'rgba(155,77,181,0.15)' }]} /><Text style={s.legendTxt}>Ovulatory</Text></View>
            <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: colors.lavender }]} /><Text style={s.legendTxt}>Luteal</Text></View>
            <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: colors.pink, borderRadius: 99 }]} /><Text style={s.legendTxt}>Today</Text></View>
          </View>
        </View>

        <View style={[s.phaseCard, { backgroundColor: phaseInfo.bg }]}>
          <Text style={[s.phaseName, { color: phaseInfo.color }]}>{phaseInfo.name}</Text>
          <Text style={[s.phaseDay, { color: phaseInfo.color }]}>Day {phaseDay} of your cycle</Text>
          <Text style={s.phaseDesc}>{phaseInfo.desc}</Text>
          <Text style={[s.phaseTip, { color: phaseInfo.color }]}>{phaseInfo.tip}</Text>
        </View>

        <View style={s.actionRow}>
          <TouchableOpacity style={s.startBtn} onPress={handleStartPeriod}>
            <LinearGradient colors={['#E5457A', '#C73568']} style={s.actionBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={s.actionBtnTxt}>🔴 Start Period</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={s.endBtn} onPress={handleEndPeriod}>
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

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingHorizontal: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: colors.purple, fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  scroll: { padding: 16, gap: 12 },
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
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
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