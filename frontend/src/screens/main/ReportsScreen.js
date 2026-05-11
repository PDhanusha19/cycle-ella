import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

export default function ReportsScreen({ navigation }) {
  const [period, setPeriod] = useState('Weekly');
  const [stats, setStats] = useState({ daysLogged: '6/7', avgCalories: '1,540', cycleLength: '28d', healthScore: '72' });
  const [topFoods, setTopFoods] = useState([
    { emoji: '🍚', name: 'Rice / String Hoppers', freq: 5, pct: 80 },
    { emoji: '🍛', name: 'Dhal Curry', freq: 4, pct: 65 },
    { emoji: '🥥', name: 'Coconut Sambol', freq: 3, pct: 45 },
  ]);
  const [symptoms, setSymptoms] = useState([
    { label: 'Bloating × 3', type: 'pink' },
    { label: 'Fatigue × 2', type: 'purple' },
    { label: 'Cravings × 2', type: 'amber' },
  ]);
  const [nextWeekTip, setNextWeekTip] = useState("You'll enter the luteal phase — increase magnesium-rich foods (dark chocolate, nuts, spinach) to manage PMS symptoms.");

  useEffect(() => {
    const load = async () => {
      try {
        const res = period === 'Weekly' 
  ? await api.get('/reports/weekly')
  : await api.get('/reports/monthly');
        if (res.data) {
          if (res.data.stats) setStats(res.data.stats);
          if (res.data.topFoods) setTopFoods(res.data.topFoods);
          if (res.data.symptoms) setSymptoms(res.data.symptoms);
          if (res.data.nextWeekTip) setNextWeekTip(res.data.nextWeekTip);
        }
      } catch (_) {}
    };
    load();
  }, [period]);

  const BADGE_STYLES = {
    pink: { bg: colors.lightPink, color: colors.pink },
    purple: { bg: colors.lavender, color: colors.purple },
    amber: { bg: colors.amberBg, color: '#b8600a' },
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Reports</Text>
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

        {/* Stats Grid */}
        <View style={s.statGrid}>
          {[
            { val: stats.daysLogged, label: 'Days logged' },
            { val: stats.avgCalories, label: 'Avg. daily kcal' },
            { val: stats.cycleLength, label: 'Cycle length' },
            { val: stats.healthScore, label: 'Health score' },
          ].map((stat, i) => (
            <View key={i} style={s.statCell}>
              <Text style={s.statVal}>{stat.val}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Most Eaten Foods */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Most Eaten Foods</Text>
          {topFoods.map((food, i) => (
            <View key={i} style={s.foodRow}>
              <Text style={{ fontSize: 22 }}>{food.emoji}</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.foodName}>{food.name}</Text>
                <View style={s.foodBarTrack}>
                  <LinearGradient colors={['#E5457A', '#9B4DB5']} style={[s.foodBarFill, { width: `${food.pct}%` }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                </View>
              </View>
              <Text style={s.foodFreq}>{food.freq}×</Text>
            </View>
          ))}
        </View>

        {/* Symptoms */}
        <View style={[s.card, { gap: 8 }]}>
          <Text style={s.cardTitle}>Symptoms This {period}</Text>
          <View style={s.badgeRow}>
            {symptoms.map((sym, i) => {
              const st = BADGE_STYLES[sym.type] || BADGE_STYLES.pink;
              return (
                <View key={i} style={[s.badge, { backgroundColor: st.bg }]}>
                  <Text style={[s.badgeTxt, { color: st.color }]}>{sym.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Next Week Tip */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Next Week Tip</Text>
          <Text style={s.tipTxt}>{nextWeekTip}</Text>
        </View>

        {/* Actions */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.primaryBtn} onPress={() => Alert.alert('Coming Soon', 'PDF download will be available soon.')} activeOpacity={0.85}>
            <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={s.primaryTxt}>⬇ Download PDF</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={s.ghostBtn} onPress={() => Alert.alert('Coming Soon', 'Share feature coming soon.')}>
            <Text style={s.ghostTxt}>Share</Text>
          </TouchableOpacity>
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
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCell: { flex: 1, minWidth: '45%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 },
  statVal: { fontSize: 24, fontWeight: '900', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontWeight: '600' },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  foodRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  foodName: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  foodBarTrack: { height: 4, backgroundColor: colors.border, borderRadius: 99, overflow: 'hidden' },
  foodBarFill: { height: '100%', borderRadius: 99 },
  foodFreq: { fontSize: 11, color: colors.textSecondary, fontWeight: '700', width: 24, textAlign: 'right' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  tipTxt: { fontSize: 13, color: colors.textPrimary, lineHeight: 20 },
  actionRow: { flexDirection: 'row', gap: 8 },
  primaryBtn: { flex: 1, borderRadius: 16, overflow: 'hidden', shadowColor: '#E5457A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 8 },
  primaryGrad: { paddingVertical: 14, alignItems: 'center', borderRadius: 16 },
  primaryTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  ghostBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 16, borderWidth: 1.5, borderColor: colors.border },
  ghostTxt: { fontSize: 14, fontWeight: '700', color: colors.purple },
});
