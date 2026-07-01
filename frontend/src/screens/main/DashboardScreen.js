import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';
import useStore from '../../store/useStore';

const QUICK_ACTIONS = [
  { emoji: '🍱', label: 'Log Food', screen: 'FoodLog' },
  { emoji: '📅', label: 'Period Log', screen: 'PeriodTracker' },
  { emoji: '💬', label: 'Ask AI', screen: 'Chatbot' },
  { emoji: '📊', label: 'Reports', screen: 'Reports' },
];

const PHASE_COLORS = {
  Menstrual: colors.pink,
  Follicular: colors.blue,
  Ovulatory: colors.purple,
  Luteal: colors.amber,
};

function HealthScoreRing({ score }) {
  const pct = Math.min(Math.max(score, 0), 100);
  return (
    <View style={s.scoreCard}>
      <View style={s.scoreRing}>
        <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.scoreRingInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={s.scoreNum}>{pct}</Text>
          <Text style={s.scoreMax}>/100</Text>
        </LinearGradient>
      </View>
      <View style={s.scoreInfo}>
        <Text style={s.scoreTitle}>Health Score</Text>
        <Text style={s.scoreSub}>
          {pct >= 75 ? 'Excellent progress! Keep it up 🌸' : pct >= 50 ? 'Good progress, keep going!' : 'Log consistently to improve your score'}
        </Text>
      </View>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const user = useStore((s) => s.user);
  const [phase, setPhase] = useState({ phase_name: null, day_of_cycle: 0 });
  const [healthScore, setHealthScore] = useState(0);
  const [calories, setCalories] = useState({ consumed: 0, goal: 1800 });
  const [nextPeriod, setNextPeriod] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning,';
    if (h < 17) return 'Good afternoon,';
    return 'Good evening,';
  };

  const loadAll = useCallback(async () => {
    try {
      const phaseRes = await api.get('/period/phase');
      setPhase({
        phase_name: phaseRes.data?.phase_name || null,
        day_of_cycle: phaseRes.data?.day_of_cycle || 0,
      });
    } catch (_) {}

    try {
      const foodRes = await api.get('/food/today');
      setCalories({
        consumed: foodRes.data?.nutrition?.calories || 0,
        goal: foodRes.data?.nutrition?.goal || 1800,
      });
    } catch (_) {}

    try {
      const predRes = await api.get('/period/predictions');
      setNextPeriod(predRes.data?.nextPeriod || null);
    } catch (_) {}

    try {
      const reportRes = await api.get('/reports/weekly');
      if (reportRes.data?.stats?.healthScore) {
        setHealthScore(parseInt(reportRes.data.stats.healthScore) || 0);
      }
    } catch (_) {}
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const calPct = calories.goal > 0 ? Math.min((calories.consumed / calories.goal) * 100, 100) : 0;
  const phaseColor = PHASE_COLORS[phase.phase_name] || colors.green;
  const phaseLabel = phase.phase_name ? `${phase.phase_name} Phase` : 'Start tracking';

  // Build today's nutrition tip based on phase
  const phaseTips = {
    Menstrual: "You're in your menstrual phase — iron-rich foods like spinach and dates help replenish what's lost.",
    Follicular: "You're in your follicular phase — focus on protein and light exercise as your energy rises.",
    Ovulatory: "You're in your ovulatory phase — antioxidant-rich foods like berries support this peak energy time.",
    Luteal: "You're in your luteal phase — reduce sugar and add magnesium-rich foods to ease PMS symptoms.",
  };
  const todayTip = phase.phase_name
    ? phaseTips[phase.phase_name]
    : "Log your period and meals to start getting personalized cycle-based tips 🌸";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <LinearGradient colors={[colors.navy, colors.navyLight]} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View>
          <Text style={s.greeting}>{greeting()}</Text>
          <Text style={s.name}>{user?.full_name?.split(' ')[0] || 'there'} 🌸</Text>
        </View>
        <View style={s.phasePill}>
          <View style={[s.phaseDot, { backgroundColor: phaseColor }]} />
          <Text style={s.phaseTxt}>{phaseLabel}</Text>
          {phase.day_of_cycle > 0 && <Text style={s.phaseDay}> · Day {phase.day_of_cycle}</Text>}
        </View>
      </LinearGradient>

      <ScrollView
        style={s.body}
        contentContainerStyle={s.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pink} />}
      >
        <HealthScoreRing score={healthScore} />

        <Text style={s.sectionTitle}>Quick Actions</Text>
        <View style={s.qaGrid}>
          {QUICK_ACTIONS.map(qa => (
            <TouchableOpacity key={qa.screen} style={s.qaCard} onPress={() => navigation.navigate(qa.screen)} activeOpacity={0.8}>
              <Text style={s.qaEmoji}>{qa.emoji}</Text>
              <Text style={s.qaLabel}>{qa.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.sectionTitle}>Today's Cycle Insight</Text>
        <TouchableOpacity style={s.tipCard} onPress={() => navigation.navigate('PeriodTracker')} activeOpacity={0.85}>
          <Text style={[s.tipTag, { color: phaseColor }]}>🌀 {phaseLabel}</Text>
          <Text style={s.tipBody}>{todayTip}</Text>
          <Text style={s.tipLink}>View cycle details →</Text>
        </TouchableOpacity>

        <Text style={s.sectionTitle}>Upcoming</Text>
        <View style={s.card}>
          <TouchableOpacity style={s.reminderRow} onPress={() => navigation.navigate('FoodLog')}>
            <View style={s.reminderIcon}><Text style={{ fontSize: 16 }}>🍽️</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.reminderTitle}>Log today's meals</Text>
              <Text style={s.reminderSub}>{calories.consumed > 0 ? `${calories.consumed} kcal logged so far` : 'Nothing logged yet'}</Text>
            </View>
            <Text style={s.reminderTime}>→</Text>
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.reminderRow} onPress={() => navigation.navigate('PeriodTracker')}>
            <View style={s.reminderIcon}><Text style={{ fontSize: 16 }}>🔴</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.reminderTitle}>Next Period</Text>
              <Text style={s.reminderSub}>Predicted based on your cycle</Text>
            </View>
            <Text style={s.reminderTime}>{nextPeriod || '—'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.sectionTitle}>Today's Calories</Text>
        <TouchableOpacity style={[s.card, { gap: 8 }]} onPress={() => navigation.navigate('FoodLog')} activeOpacity={0.85}>
          <View style={s.calRow}>
            <Text style={s.calNum}>{calories.consumed.toLocaleString()} / {calories.goal.toLocaleString()} kcal</Text>
            <Text style={s.calPct}>{Math.round(calPct)}% of goal</Text>
          </View>
          <View style={s.calBar}>
            <LinearGradient colors={['#E5457A', '#9B4DB5']} style={[s.calFill, { width: `${calPct}%` }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
          </View>
        </TouchableOpacity>

        <View style={s.moreRow}>
          <TouchableOpacity style={s.moreBtn} onPress={() => navigation.navigate('Progress')}>
            <Text style={s.moreTxt}>📈 Progress</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.moreBtn} onPress={() => navigation.navigate('Reminders')}>
            <Text style={s.moreTxt}>🔔 Reminders</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.moreBtn} onPress={() => navigation.navigate('Gyno')}>
            <Text style={s.moreTxt}>👩‍⚕️ Gyno</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.moreBtn} onPress={() => navigation.navigate('Settings')}>
            <Text style={s.moreTxt}>⚖️ BMI</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  name: { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 2 },
  phasePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, gap: 6 },
  phaseDot: { width: 7, height: 7, borderRadius: 99 },
  phaseTxt: { fontSize: 11, fontWeight: '700', color: '#fff' },
  phaseDay: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 12 },
  scoreCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: colors.border, shadowColor: '#9B4DB5', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  scoreRing: { width: 72, height: 72, borderRadius: 99, overflow: 'hidden' },
  scoreRingInner: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: 22, fontWeight: '900', color: '#fff' },
  scoreMax: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: -2 },
  scoreInfo: { flex: 1, gap: 2 },
  scoreTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  scoreSub: { fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qaCard: { flex: 1, minWidth: '22%', backgroundColor: colors.surface, borderRadius: 16, padding: 12, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border },
  qaEmoji: { fontSize: 24 },
  qaLabel: { fontSize: 10, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  tipCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 8 },
  tipTag: { fontSize: 11, fontWeight: '800' },
  tipBody: { fontSize: 13, color: colors.textPrimary, lineHeight: 20 },
  tipLink: { fontSize: 11, color: colors.purple, fontWeight: '800' },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  reminderIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  reminderTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  reminderSub: { fontSize: 11, color: colors.textSecondary },
  reminderTime: { fontSize: 11, fontWeight: '700', color: colors.purple },
  calRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calNum: { fontSize: 13, fontWeight: '900', color: colors.textPrimary },
  calPct: { fontSize: 11, color: colors.textSecondary },
  calBar: { height: 8, backgroundColor: colors.border, borderRadius: 99, overflow: 'hidden' },
  calFill: { height: '100%', borderRadius: 99 },
  moreRow: { flexDirection: 'row', gap: 8 },
  moreBtn: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  moreTxt: { fontSize: 10, fontWeight: '700', color: colors.textPrimary },
});