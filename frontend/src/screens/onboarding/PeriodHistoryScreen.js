import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getLastMonths(n) {
  const now = new Date();
  const months = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.getMonth() + 1, year: d.getFullYear(), label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
  }
  return months;
}

export default function PeriodHistoryScreen({ navigation }) {
  const recentMonths = getLastMonths(3);
  const [entries, setEntries] = useState(recentMonths.map((m, i) => ({ ...m, enabled: i < 2, duration: i === 0 ? '5' : '4', day: '' })));
  const [cycleLength, setCycleLength] = useState('28');
  const [loading, setLoading] = useState(false);

  const updateEntry = (idx, key, val) => {
    const updated = [...entries];
    updated[idx] = { ...updated[idx], [key]: val };
    setEntries(updated);
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const logs = entries.filter(e => e.enabled && e.duration).map(e => {
        const day = parseInt(e.day);
        return {
          month: e.month,
          year: e.year,
          duration_days: parseInt(e.duration),
          day: Number.isInteger(day) && day >= 1 && day <= 31 ? day : undefined,
        };
      });
      await api.post('/period/history', {
        periods: logs,
        avg_cycle_length: parseInt(cycleLength),
      });
    } catch (_) {}
    setLoading(false);
    navigation.navigate('Questionnaire');
  };

  const handleSkip = () => navigation.navigate('Questionnaire');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Period History</Text>
        <Text style={s.stepLabel}>Step 3 of 4</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.stepBar}>
          {[0, 1, 2].map(i => <View key={i} style={[s.stepSeg, s.stepSegDone]} />)}
          <View style={s.stepSeg} />
        </View>

        <Text style={s.hint}>Help us understand your cycle history. Approximate info is fine — but if you remember the exact day a period started, add it and we'll figure out your regularity automatically instead of asking.</Text>

        {entries.map((entry, idx) => (
          <View key={idx} style={[s.entryCard, !entry.enabled && { opacity: 0.45 }]}>
            <View style={s.entryHeader}>
              <Text style={s.entryMonth}>{entry.label}</Text>
              <View style={s.entryToggleRow}>
                <Text style={s.skipLabel}>Skip</Text>
                <Switch
                  value={entry.enabled}
                  onValueChange={v => updateEntry(idx, 'enabled', v)}
                  thumbColor={entry.enabled ? '#fff' : '#ccc'}
                  trackColor={{ false: colors.border, true: colors.pink }}
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.label}>DURATION (DAYS)</Text>
                <TextInput
                  style={s.input}
                  value={entry.duration}
                  onChangeText={v => updateEntry(idx, 'duration', v)}
                  keyboardType="numeric"
                  editable={entry.enabled}
                  placeholder="–"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.label}>STARTED ON (OPTIONAL)</Text>
                <TextInput
                  style={s.input}
                  value={entry.day}
                  onChangeText={v => updateEntry(idx, 'day', v)}
                  keyboardType="numeric"
                  editable={entry.enabled}
                  placeholder="Day 1-31"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>
          </View>
        ))}

        <View style={s.field}>
          <Text style={s.label}>AVERAGE CYCLE LENGTH (DAYS)</Text>
          <Text style={s.hint}>Only used if you didn't add exact start days above — otherwise we calculate this for you.</Text>
          <TextInput style={s.input} value={cycleLength} onChangeText={setCycleLength} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
        </View>

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
  entryCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 16, gap: 12 },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryMonth: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  entryToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skipLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  field: { gap: 8 },
  label: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { padding: 16, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  primaryBtn: { borderRadius: 16, overflow: 'hidden', shadowColor: '#E5457A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 8 },
  primaryGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: 16 },
  primaryTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  skipBtn: { paddingVertical: 16, alignItems: 'center' },
  skipBtnTxt: { fontSize: 15, color: colors.textSecondary, fontWeight: '700' },
});
