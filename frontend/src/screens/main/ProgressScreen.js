import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

const { width } = Dimensions.get('window');
const CALORIE_GOAL = 1800;

const ACHIEVEMENTS = [
  { emoji: '🔥', label: '7-day streak!' },
  { emoji: '📝', label: 'First log' },
  { emoji: '⚖️', label: 'BMI updated' },
  { emoji: '📋', label: 'Assessment done' },
  { emoji: '💧', label: 'Hydration goal' },
];

// ── Styles defined FIRST so components can use them ──
const c = StyleSheet.create({
  chartWrap: { flexDirection: 'row', height: 130, gap: 4 },
  yAxis: { width: 32, justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 20 },
  axisLabel: { fontSize: 9, color: colors.textSecondary },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.border },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  bmiLabel: { position: 'absolute', backgroundColor: colors.purple, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  bmiLabelTxt: { fontSize: 10, color: '#fff', fontWeight: '800' },
  xAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  xLabel: { fontSize: 8, color: colors.textSecondary, flex: 1, textAlign: 'center' },
  barChartWrap: { flexDirection: 'row', height: 130, alignItems: 'flex-end', gap: 6, paddingTop: 24 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', borderRadius: 6, overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 6 },
  barPast: { backgroundColor: colors.lavender },
  barEmpty: { backgroundColor: colors.border },
  barDay: { fontSize: 9, color: colors.textSecondary, fontWeight: '700' },
  barDayToday: { color: colors.pink },
  barCalTxt: { fontSize: 8, color: colors.textSecondary, textAlign: 'center' },
});

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
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  chartTitle: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  bmiBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  bmiBadgeTxt: { fontSize: 11, fontWeight: '800' },
  goalBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  goalDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.pink },
  goalTxt: { fontSize: 10, color: colors.textSecondary, fontWeight: '700' },
  emptyCard: { alignItems: 'center', paddingVertical: 20, gap: 4 },
  emptyEmoji: { fontSize: 32 },
  emptyTxt: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  emptySub: { fontSize: 11, color: colors.textSecondary, textAlign: 'center' },
  achieveCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, alignItems: 'center', gap: 8, minWidth: 80 },
  achieveEmoji: { fontSize: 28 },
  achieveLabel: { fontSize: 10, fontWeight: '700', color: colors.textSecondary, textAlign: 'center', lineHeight: 14 },
  insightCard: { borderRadius: 20, overflow: 'hidden' },
  insightGrad: { flexDirection: 'row', padding: 16, gap: 12, alignItems: 'flex-start', borderRadius: 20 },
  insightEmoji: { fontSize: 24 },
  insightTxt: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 20 },
});

// ── BMI Line Chart ────────────────────────────────────
function BMIChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <View style={s.emptyCard}>
        <Text style={s.emptyEmoji}>📏</Text>
        <Text style={s.emptyTxt}>No BMI data yet</Text>
        <Text style={s.emptySub}>Update measurements to see your BMI trend</Text>
      </View>
    );
  }

  const chartH = 100;
  const chartW = width - 120;
  const bmis = data.map(d => parseFloat(d.bmi));
  const minBMI = Math.max(Math.min(...bmis) - 1, 10);
  const maxBMI = Math.min(Math.max(...bmis) + 1, 45);
  const range = maxBMI - minBMI || 1;

  const getY = (bmi) => chartH - ((parseFloat(bmi) - minBMI) / range) * chartH;
  const getX = (idx) => (idx / Math.max(data.length - 1, 1)) * chartW;

  return (
    <View style={c.chartWrap}>
      <View style={c.yAxis}>
        <Text style={c.axisLabel}>{maxBMI.toFixed(1)}</Text>
        <Text style={c.axisLabel}>{((maxBMI + minBMI) / 2).toFixed(1)}</Text>
        <Text style={c.axisLabel}>{minBMI.toFixed(1)}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <View style={[c.gridLine, { top: 0 }]} />
        <View style={[c.gridLine, { top: chartH / 2 }]} />
        <View style={[c.gridLine, { top: chartH }]} />

        <View style={{ height: chartH, position: 'relative' }}>
          {data.map((d, idx) => {
            const x = getX(idx);
            const y = getY(d.bmi);
            const isLast = idx === data.length - 1;
            return (
              <View key={idx}>
                <View style={[c.dot, {
                  left: x - 5,
                  top: y - 5,
                  backgroundColor: isLast ? colors.pink : colors.purple,
                }]} />
                {isLast && (
                  <View style={[c.bmiLabel, { left: x - 16, top: y - 26 }]}>
                    <Text style={c.bmiLabelTxt}>{parseFloat(d.bmi).toFixed(1)}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={c.xAxis}>
          {data.map((d, idx) => (
            <Text key={idx} style={c.xLabel} numberOfLines={1}>
              {new Date(d.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

// ── Calorie Bar Chart ─────────────────────────────────
function CalorieChart({ data }) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const weekData = Array(7).fill(0).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - idx));
    const dateStr = d.toISOString().split('T')[0];
    const found = data?.find(item => item.date?.startsWith(dateStr));
    return {
      day: days[d.getDay()],
      calories: found ? Math.round(parseFloat(found.total_calories)) : 0,
      isToday: idx === 6,
    };
  });

  const maxCal = Math.max(...weekData.map(d => d.calories), CALORIE_GOAL);

  return (
    <View style={c.barChartWrap}>
      {weekData.map((item, idx) => {
        const pct = maxCal > 0 ? (item.calories / maxCal) * 100 : 0;
        return (
          <View key={idx} style={c.barCol}>
            <Text style={c.barCalTxt}>{item.calories > 0 ? `${item.calories}` : ''}</Text>
            <View style={c.barTrack}>
              {item.calories > 0 ? (
                item.isToday ? (
                  <LinearGradient
                    colors={['#E5457A', '#9B4DB5']}
                    style={[c.bar, { height: `${pct}%` }]}
                    start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }}
                  />
                ) : (
                  <View style={[c.bar, c.barPast, { height: `${pct}%` }]} />
                )
              ) : (
                <View style={[c.bar, c.barEmpty, { height: '4%' }]} />
              )}
            </View>
            <Text style={[c.barDay, item.isToday && c.barDayToday]}>{item.day}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────
export default function ProgressScreen({ navigation }) {
  const [period, setPeriod] = useState('Weekly');
  const [bmiHistory, setBmiHistory] = useState([]);
  const [weeklyCalories, setWeeklyCalories] = useState([]);

  const BREAKDOWN = [
    { label: 'Nutrition', pct: weeklyCalories.length > 0 ? 78 : 30 },
    { label: 'Cycle tracking', pct: 65 },
    { label: 'BMI tracked', pct: bmiHistory.length > 0 ? 90 : 20 },
    { label: 'Consistency', pct: weeklyCalories.length > 0 ? 85 : 40 },
  ];

  const score = Math.round(BREAKDOWN.reduce((a, b) => a + b.pct, 0) / BREAKDOWN.length);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const bmiRes = await api.get('/profile/bmi-history');
      setBmiHistory(bmiRes.data || []);
    } catch (_) {}
    try {
      const calRes = await api.get('/food/weekly-calories');
      setWeeklyCalories(calRes.data || []);
    } catch (_) {}
  };

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
        <View style={s.tabToggle}>
          {['Weekly', 'Monthly'].map(t => (
            <TouchableOpacity key={t} style={[s.tabBtn, period === t && s.tabBtnActive]} onPress={() => setPeriod(t)}>
              <Text style={[s.tabTxt, period === t && s.tabTxtActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Health Score */}
        <View style={[s.card, { alignItems: 'center', paddingVertical: 24, gap: 16 }]}>
          <View style={s.gaugeWrap}>
            <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.gaugeRing} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={s.gaugeInner}>
                <Text style={s.gaugeNum}>{score}</Text>
                <Text style={s.gaugeMax}>/100</Text>
              </View>
            </LinearGradient>
          </View>
          <Text style={s.trendTxt}>Health Score · Based on your activity</Text>
          <View style={{ width: '100%', gap: 4 }}>
            {BREAKDOWN.map((item, idx) => (
              <View key={idx} style={s.breakdownRow}>
                <Text style={s.breakdownLabel}>{item.label}</Text>
                <View style={s.breakdownTrack}>
                  <LinearGradient colors={['#E5457A', '#9B4DB5']} style={[s.breakdownFill, { width: `${item.pct}%` }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                </View>
                <Text style={s.breakdownPct}>{item.pct}%</Text>
              </View>
            ))}
          </View>
        </View>

        {/* BMI Trend */}
        <Text style={s.sectionTitle}>📈 BMI Trend</Text>
        <View style={s.card}>
          <View style={s.chartHeader}>
            <Text style={s.chartTitle}>Your BMI over time</Text>
            {bmiHistory.length > 0 && (
              <View style={[s.bmiBadge, { backgroundColor: parseFloat(bmiHistory[0]?.bmi) < 25 ? colors.greenBg : colors.lightPink }]}>
                <Text style={[s.bmiBadgeTxt, { color: parseFloat(bmiHistory[0]?.bmi) < 25 ? '#1a8a5c' : colors.pink }]}>
                  Latest: {parseFloat(bmiHistory[0]?.bmi).toFixed(1)}
                </Text>
              </View>
            )}
          </View>
          <BMIChart data={[...bmiHistory].reverse()} />
        </View>

        {/* Calorie Chart */}
        <Text style={s.sectionTitle}>🍽️ Calorie Intake This Week</Text>
        <View style={s.card}>
          <View style={s.chartHeader}>
            <Text style={s.chartTitle}>Daily calories vs {CALORIE_GOAL} goal</Text>
            <View style={s.goalBadge}>
              <View style={s.goalDot} />
              <Text style={s.goalTxt}>Goal: {CALORIE_GOAL}</Text>
            </View>
          </View>
          <CalorieChart data={weeklyCalories} />
        </View>

        {/* Achievements */}
        <Text style={s.sectionTitle}>🏆 Achievements</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
          {ACHIEVEMENTS.map((a, idx) => (
            <View key={idx} style={s.achieveCard}>
              <Text style={s.achieveEmoji}>{a.emoji}</Text>
              <Text style={s.achieveLabel}>{a.label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* AI Insight */}
        <Text style={s.sectionTitle}>🤖 AI Insight</Text>
        <View style={s.insightCard}>
          <LinearGradient colors={[colors.navy, colors.navyLight]} style={s.insightGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={s.insightEmoji}>💡</Text>
            <Text style={s.insightTxt}>
              {weeklyCalories.length > 0
                ? `You logged food ${weeklyCalories.length} out of 7 days this week! ${bmiHistory.length > 1 ? `Your BMI changed from ${parseFloat(bmiHistory[bmiHistory.length - 1]?.bmi).toFixed(1)} to ${parseFloat(bmiHistory[0]?.bmi).toFixed(1)}.` : ''} Keep tracking consistently!`
                : 'Start logging your meals to get personalized AI insights about your PCOS nutrition journey! 🌸'}
            </Text>
          </LinearGradient>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}