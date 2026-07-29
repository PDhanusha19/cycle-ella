import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { colors } from '../../theme/colors';
import api from '../../api/api';

const TIP_ICONS = {
  cycle: { emoji: '🌀', label: 'Cycle Phase Tip', bg: colors.lightPink },
  weather: { emoji: '⛅', label: 'Weather Tip', bg: '#DFF5FF' },
  food: { emoji: '🍽️', label: 'Food Analysis', bg: colors.greenBg },
  exercise: { emoji: '🏃', label: 'Exercise Tip', bg: colors.lavender },
};

export default function TipsScreen({ navigation }) {
  const [tips, setTips] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pastDates, setPastDates] = useState([]);

  useEffect(() => { loadTips(); }, []);

  const loadTips = async () => {
    setLoading(true);
    try {
      let lat = 6.9271;
      let lon = 79.8612;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = location.coords.latitude;
        lon = location.coords.longitude;
      }
      const res = await api.get('/tips/generate', { params: { lat, lon } });
      setTips(res.data);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <ActivityIndicator size="large" color={colors.pink} />
        <Text style={{ marginTop: 12, color: colors.textSecondary, fontWeight: '600' }}>Generating your tips... 🌸</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Personalized Tips</Text>
        <TouchableOpacity onPress={loadTips}>
          <Text style={{ fontSize: 20 }}>🔄</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.metaRow}>
          <Text style={s.metaSub}>Based on your cycle, food logs & weather</Text>
          <Text style={s.metaDate}>Updated {formatDate()}</Text>
        </View>

        {/* Cycle Phase Tip */}
        {tips?.cycle_tip && (
          <View style={s.tipCard}>
            <View style={s.tipHeader}>
              <View style={[s.tipIcon, { backgroundColor: TIP_ICONS.cycle.bg }]}>
                <Text style={{ fontSize: 20 }}>{TIP_ICONS.cycle.emoji}</Text>
              </View>
              <View>
                <Text style={s.tipTitle}>{TIP_ICONS.cycle.label}</Text>
                <Text style={s.tipSub}>{tips.cycle_tip.phase} — Day {tips.cycle_tip.day}</Text>
              </View>
            </View>
            <Text style={s.tipBody}>{tips.cycle_tip.tip}</Text>
            {tips.cycle_tip.foods?.length > 0 && (
              <View style={s.highlight}>
                <Text style={s.highlightTxt}>✅ Eat: {tips.cycle_tip.foods.slice(0, 3).join(', ')}</Text>
              </View>
            )}
            {tips.cycle_tip.exercise && (
              <View style={[s.highlight, { backgroundColor: '#DFF5FF' }]}>
                <Text style={[s.highlightTxt, { color: '#1565c0' }]}>💪 {tips.cycle_tip.exercise}</Text>
              </View>
            )}
          </View>
        )}

        {/* Weather Tip */}
        {tips?.weather_tip && (
          <View style={s.tipCard}>
            <View style={s.tipHeader}>
              <View style={[s.tipIcon, { backgroundColor: TIP_ICONS.weather.bg }]}>
                <Text style={{ fontSize: 20 }}>{TIP_ICONS.weather.emoji}</Text>
              </View>
              <View>
                <Text style={s.tipTitle}>{TIP_ICONS.weather.label}</Text>
                <Text style={s.tipSub}>{tips.weather_tip.weather?.condition} · {Math.round(tips.weather_tip.weather?.temp || 30)}°C</Text>
              </View>
            </View>
            <Text style={s.tipBody}>{tips.weather_tip.tip}</Text>
          </View>
        )}

        {/* Food Analysis Tips */}
        {tips?.food_tip && (
          <View style={s.tipCard}>
            <View style={s.tipHeader}>
              <View style={[s.tipIcon, { backgroundColor: TIP_ICONS.food.bg }]}>
                <Text style={{ fontSize: 20 }}>{TIP_ICONS.food.emoji}</Text>
              </View>
              <View>
                <Text style={s.tipTitle}>{TIP_ICONS.food.label}</Text>
                <Text style={s.tipSub}>Based on today's log</Text>
              </View>
            </View>
            {tips.food_tip.tips?.map((tip, i) => (
              <View key={i} style={[s.highlight, tip.includes('⚠️') ? { backgroundColor: colors.lightPink } : {}]}>
                <Text style={[s.highlightTxt, tip.includes('⚠️') ? { color: colors.pink } : {}]}>{tip}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Exercise Tip */}
        {tips?.exercise_tip && (
          <View style={s.tipCard}>
            <View style={s.tipHeader}>
              <View style={[s.tipIcon, { backgroundColor: TIP_ICONS.exercise.bg }]}>
                <Text style={{ fontSize: 20 }}>{TIP_ICONS.exercise.emoji}</Text>
              </View>
              <View>
                <Text style={s.tipTitle}>{TIP_ICONS.exercise.label}</Text>
                <Text style={s.tipSub}>Daily recommendation</Text>
              </View>
            </View>
            <Text style={s.tipBody}>{tips.exercise_tip.tip}</Text>
          </View>
        )}

        <Text style={s.sectionTitle}>Past Tips</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={s.dateRow}>
            {['Today', 'Yesterday', '2 days ago', '3 days ago'].map((d, i) => (
              <TouchableOpacity key={i} style={[s.dateChip, i === 0 && s.dateChipActive]}>
                <Text style={[s.dateChipTxt, i === 0 && s.dateChipTxtActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingHorizontal: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: colors.purple, fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  scroll: { padding: 16, gap: 14 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaSub: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', flex: 1 },
  metaDate: { fontSize: 11, color: colors.purple, fontWeight: '800' },
  tipCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 10 },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tipTitle: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  tipSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  tipBody: { fontSize: 13, color: colors.textPrimary, lineHeight: 22 },
  highlight: { backgroundColor: colors.lavender, borderRadius: 12, padding: 12 },
  highlightTxt: { fontSize: 13, fontWeight: '700', color: colors.purple, lineHeight: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
  dateRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  dateChip: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  dateChipActive: { backgroundColor: colors.lavender, borderColor: colors.purple },
  dateChipTxt: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  dateChipTxtActive: { color: colors.purple },
});