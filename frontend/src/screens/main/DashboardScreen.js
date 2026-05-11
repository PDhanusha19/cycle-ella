import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';
import useStore from '../../store/useStore';

const QUICK_ACTIONS = [
  { emoji: '🍱', label: 'Log Food', screen: 'FoodLog' },
  { emoji: '📅', label: 'Period Log', screen: 'PeriodTracker' },
  { emoji: '💡', label: "Today's Tips", screen: 'Tips' },
  { emoji: '📊', label: 'Reports', screen: 'Reports' },
];

function HealthScoreRing({ score }) {
  const pct = Math.min(score, 100);
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
        <Text style={s.scoreSub}>Great progress this week!</Text>
        <Text style={s.scoreTrend}>↑ +5 from last week</Text>
      </View>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const user = useStore((s) => s.user);
  const healthScore = useStore((s) => s.healthScore);
  const [phase, setPhase] = useState({ name: 'Follicular Phase', day: 7 });
  const [reminders, setReminders] = useState([]);
  const [calories, setCalories] = useState({ consumed: 0, goal: 1800 });
  const [tip, setTip] = useState(null);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning,';
    if (h < 17) return 'Good afternoon,';
    return 'Good evening,';
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [phaseRes, remRes, foodRes, tipRes] = await Promise.allSettled([
          api.get('/period/phase'),
          api.get('/reminders'),
        api.get('/food/summary'),
api.get('/tips/generate'),
        ]);
        if (phaseRes.status === 'fulfilled') setPhase(phaseRes.value.data);
        if (remRes.status === 'fulfilled') setReminders(remRes.value.data?.slice(0, 3) || []);
        if (foodRes.status === 'fulfilled') setCalories(foodRes.value.data?.calories || { consumed: 0, goal: 1800 });
        if (tipRes.status === 'fulfilled') setTip(tipRes.value.data?.highlight);
      } catch (_) {}
    };
    load();
  }, []);

  const calPct = calories.goal > 0 ? Math.min((calories.consumed / calories.goal) * 100, 100) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <LinearGradient colors={[colors.navy, colors.navyLight]} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View>
          <Text style={s.greeting}>{greeting()}</Text>
          <Text style={s.name}>{user?.full_name?.split(' ')[0] || 'Kavya'} 🌸</Text>
        </View>
        <View style={s.phasePill}>
          <View style={s.phaseDot} />
          <Text style={s.phaseTxt}>{phase?.name || 'Follicular Phase'}</Text>
          <Text style={s.phaseDay}> · Day {phase?.day || 7}</Text>
        </View>
      </LinearGradient>

      <ScrollView style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false}>
        <HealthScoreRing score={healthScore || 72} />

        <Text style={s.sectionTitle}>Quick Actions</Text>
        <View style={s.qaGrid}>
          {QUICK_ACTIONS.map(qa => (
            <TouchableOpacity key={qa.screen} style={s.qaCard} onPress={() => navigation.navigate(qa.screen)} activeOpacity={0.8}>
              <Text style={s.qaEmoji}>{qa.emoji}</Text>
              <Text style={s.qaLabel}>{qa.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.sectionTitle}>Today's Top Tip</Text>
        <TouchableOpacity style={s.tipCard} onPress={() => navigation.navigate('Tips')} activeOpacity={0.85}>
          <Text style={s.tipTag}>🌀 Cycle Insight</Text>
          <Text style={s.tipBody}>{tip || "You're in your follicular phase — focus on iron-rich foods and light exercise. Stay hydrated throughout the day!"}</Text>
          <Text style={s.tipLink}>View all tips →</Text>
        </TouchableOpacity>

        <Text style={s.sectionTitle}>Upcoming Reminders</Text>
        <View style={s.card}>
          {reminders.length > 0 ? reminders.map((r, i) => (
            <View key={i} style={s.reminderRow}>
              <View style={s.reminderIcon}><Text style={{ fontSize: 16 }}>{r.emoji || '🔔'}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.reminderTitle}>{r.title}</Text>
                <Text style={s.reminderSub}>{r.subtitle || r.time}</Text>
              </View>
              <Text style={s.reminderTime}>{r.time}</Text>
            </View>
          )) : (
            <>
              <View style={s.reminderRow}>
                <View style={s.reminderIcon}><Text style={{ fontSize: 16 }}>🍽️</Text></View>
                <View style={{ flex: 1 }}><Text style={s.reminderTitle}>Lunch Log Reminder</Text><Text style={s.reminderSub}>Daily</Text></View>
                <Text style={s.reminderTime}>12:30</Text>
              </View>
              <View style={s.reminderRow}>
                <View style={s.reminderIcon}><Text style={{ fontSize: 16 }}>🔴</Text></View>
                <View style={{ flex: 1 }}><Text style={s.reminderTitle}>Period Expected</Text><Text style={s.reminderSub}>In 14 days</Text></View>
                <Text style={s.reminderTime}>May 28</Text>
              </View>
            </>
          )}
        </View>

        <Text style={s.sectionTitle}>Today's Calories</Text>
        <View style={[s.card, { gap: 8 }]}>
          <View style={s.calRow}>
            <Text style={s.calNum}>{calories.consumed > 0 ? `${calories.consumed.toLocaleString()}` : '0'} / {calories.goal.toLocaleString()} kcal</Text>
            <Text style={s.calPct}>{Math.round(calPct)}% of goal</Text>
          </View>
          <View style={s.calBar}>
            <View style={[s.calFill, { width: `${calPct}%` }]} />
          </View>
        </View>

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
          <TouchableOpacity style={s.moreBtn} onPress={() => navigation.navigate('Chatbot')}>
            <Text style={s.moreTxt}>💬 Chat</Text>
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
  phaseDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: colors.green },
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
  scoreSub: { fontSize: 12, color: colors.textSecondary },
  scoreTrend: { fontSize: 12, color: colors.green, fontWeight: '700' },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qaCard: { flex: 1, minWidth: '22%', backgroundColor: colors.surface, borderRadius: 16, padding: 12, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border },
  qaEmoji: { fontSize: 24 },
  qaLabel: { fontSize: 10, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  tipCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 8 },
  tipTag: { fontSize: 11, fontWeight: '800', color: colors.purple },
  tipBody: { fontSize: 13, color: colors.textPrimary, lineHeight: 20 },
  tipLink: { fontSize: 11, color: colors.purple, fontWeight: '800' },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  reminderIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  reminderTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  reminderSub: { fontSize: 11, color: colors.textSecondary },
  reminderTime: { fontSize: 11, fontWeight: '700', color: colors.purple },
  calRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calNum: { fontSize: 13, fontWeight: '900', color: colors.textPrimary },
  calPct: { fontSize: 11, color: colors.textSecondary },
  calBar: { height: 8, backgroundColor: colors.border, borderRadius: 99, overflow: 'hidden' },
  calFill: { height: '100%', borderRadius: 99, backgroundColor: colors.pink },
  moreRow: { flexDirection: 'row', gap: 8 },
  moreBtn: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  moreTxt: { fontSize: 10, fontWeight: '700', color: colors.textPrimary },
});
