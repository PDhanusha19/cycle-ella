import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const ACHIEVEMENTS = [
  { emoji: '🔥', label: '7-day streak!' },
  { emoji: '📝', label: 'First log' },
  { emoji: '⚖️', label: 'BMI updated' },
  { emoji: '📋', label: 'Assessment done' },
  { emoji: '💧', label: 'Hydration goal' },
];

const BREAKDOWN = [
  { label: 'Nutrition', pct: 78 },
  { label: 'Cycle regularity', pct: 65 },
  { label: 'Symptoms', pct: 70 },
  { label: 'Consistency', pct: 85 },
];

export default function ProgressScreen({ navigation }) {
  const [period, setPeriod] = useState('Weekly');
  const [score, setScore] = useState(72);
  const [trend, setTrend] = useState('+5');
  const [calBars, setCalBars] = useState([55, 70, 80, 60, 75, 90, 69]);
  const [aiInsight, setAiInsight] = useState('Your bloating symptoms reduced after you cut sugar intake last week — keep it up! You also logged food 6 out of 7 days — excellent consistency!');
  const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/tips/health-score`);
        if (res.data) {
          setScore(res.data.score || 72);
          setTrend(res.data.trend || '+5');
          if (res.data.calBars) setCalBars(res.data.calBars);
          if (res.data.aiInsight) setAiInsight(res.data.aiInsight);
        }
      } catch (_) {}
    };
    load();
  }, [period]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Progress</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Period Toggle */}
        <View style={s.tabToggle}>
          {['Weekly', 'Monthly'].map(t => (
            <TouchableOpacity key={t} style={[s.tabBtn, period === t && s.tabBtnActive]} onPress={() => setPeriod(t)}>
              <Text style={[s.tabTxt, period === t && s.tabTxtActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Score Gauge */}
        <View style={[s.card, { alignItems: 'center', paddingVertical: 24, gap: 16 }]}>
          <View style={s.gaugeWrap}>
            <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.gaugeRing} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={s.gaugeInner}>
                <Text style={s.gaugeNum}>{score}</Text>
                <Text style={s.gaugeMax}>/100</Text>
              </View>
            </LinearGradient>
          </View>
          <Text style={s.trendTxt}>↑ {trend} from last {period === 'Weekly' ? 'week' : 'month'} · Great progress!</Text>

          <View style={{ width: '100%', gap: 4 }}>
            {BREAKDOWN.map((item, i) => (
              <View key={i} style={s.breakdownRow}>
                <Text style={s.breakdownLabel}>{item.label}</Text>
                <View style={s.breakdownTrack}>
                  <LinearGradient colors={['#E5457A', '#9B4DB5']} style={[s.breakdownFill, { width: `${item.pct}%` }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                </View>
                <Text style={s.breakdownPct}>{item.pct}%</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Calorie Bar Chart */}
        <Text style={s.sectionTitle}>Calorie Intake This {period === 'Weekly' ? 'Week' : 'Month'}</Text>
        <View style={[s.card, { paddingBottom: 12 }]}>
          <View style={s.miniBars}>
            {calBars.map((pct, i) => (
              <View key={i} style={s.miniBarWrap}>
                {i === todayIdx ? (
                  <LinearGradient colors={['#E5457A', '#9B4DB5']} style={[s.miniBar, { height: `${pct}%` }]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
                ) : (
                  <View style={[s.miniBar, s.miniBarNormal, { height: `${pct}%` }]} />
                )}
              </View>
            ))}
          </View>
          <View style={s.miniBarDays}>
            {DAYS.map((d, i) => (
              <Text key={i} style={[s.miniBarDay, i === todayIdx && s.miniBarDayToday]}>{d}</Text>
            ))}
          </View>
        </View>

        {/* Achievements */}
        <Text style={s.sectionTitle}>Achievements</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {ACHIEVEMENTS.map((a, i) => (
            <View key={i} style={s.achieveCard}>
              <Text style={s.achieveEmoji}>{a.emoji}</Text>
              <Text style={s.achieveLabel}>{a.label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* AI Insight */}
        <Text style={s.sectionTitle}>AI Insight</Text>
        <View style={s.insightCard}>
          <Text style={s.insightTxt}>{aiInsight}</Text>
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
  scroll: { padding: 16, gap: 16 },
  tabToggle: { flexDirection: 'row', backgroundColor: colors.lavender, borderRadius: 16, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.surface },
  tabTxt: { fontSize: 12, fontWeight: '800', color: colors.textSecondary },
  tabTxtActive: { color: colors.purple },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border },
  gaugeWrap: { width: 140, height: 140, borderRadius: 70, overflow: 'hidden' },
  gaugeRing: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  gaugeInner: { width: 112, height: 112, borderRadius: 56, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  gaugeNum: { fontSize: 36, fontWeight: '900', color: colors.textPrimary, lineHeight: 40 },
  gaugeMax: { fontSize: 11, color: colors.textSecondary },
  trendTxt: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  breakdownLabel: { width: 110, fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  breakdownTrack: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 99, overflow: 'hidden' },
  breakdownFill: { height: '100%', borderRadius: 99 },
  breakdownPct: { width: 36, textAlign: 'right', fontSize: 12, fontWeight: '800', color: colors.purple },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  miniBars: { flexDirection: 'row', alignItems: 'flex-end', height: 72, gap: 8, padding: 4 },
  miniBarWrap: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  miniBar: { width: '100%', borderRadius: 4 },
  miniBarNormal: { backgroundColor: colors.lavender },
  miniBarDays: { flexDirection: 'row', marginTop: 4 },
  miniBarDay: { flex: 1, textAlign: 'center', fontSize: 10, color: colors.textSecondary, fontWeight: '700' },
  miniBarDayToday: { color: colors.pink },
  achieveCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, alignItems: 'center', gap: 8, minWidth: 80 },
  achieveEmoji: { fontSize: 28 },
  achieveLabel: { fontSize: 10, fontWeight: '700', color: colors.textSecondary, textAlign: 'center', lineHeight: 14 },
  insightCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border },
  insightTxt: { fontSize: 13, color: colors.textPrimary, lineHeight: 20 },
});
