import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

// Age and weight/height are already collected earlier in onboarding.
// cycle_regularity and period_duration_days are only asked here when
// there isn't enough tracked period data yet to auto-fill them (see the
// resolving effect below) — auto-filled values are still shown, and
// overridable, on the Review screen that follows this one.
const BASE_QUESTIONS = [
  { key: 'weight_gain', q: 'Have you noticed unexplained weight gain recently?', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
  { key: 'hair_growth', q: 'Do you have excess hair growth on your face, chest, or back?', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
  { key: 'skin_darkening', q: 'Have you noticed dark patches of skin on your neck, armpits, or groin?', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
  { key: 'hair_loss', q: 'Have you experienced noticeable hair thinning or hair loss?', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
  { key: 'pimples', q: 'Do you frequently get acne or pimples?', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
  { key: 'fast_food', q: 'Do you eat fast food or fried food often (3+ times a week)?', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
  { key: 'regular_exercise', q: 'Do you exercise regularly (at least 2-3 times a week)?', options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] },
];

const BLEED_QUESTION = {
  key: 'period_duration_days',
  q: 'How many days does your period usually last?',
  options: [
    { label: '2-3 days', value: 3 },
    { label: '4-5 days', value: 5 },
    { label: '6-7 days', value: 7 },
    { label: '8 or more days', value: 9 },
  ],
};

const REGULARITY_QUESTION = {
  key: 'cycle_regularity',
  q: 'Are your periods usually regular or irregular?',
  options: [
    { label: 'Regular — consistent timing', value: 'Regular' },
    { label: 'Irregular — timing varies a lot', value: 'Irregular' },
  ],
};

export default function QuestionnaireScreen({ navigation }) {
  const [resolving, setResolving] = useState(true);
  const [trackedRegularity, setTrackedRegularity] = useState(null); // { value, source: 'tracked' } | null
  const [trackedBleedDuration, setTrackedBleedDuration] = useState(null);
  const [answers, setAnswers] = useState({});
  const [qIdx, setQIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/period/regularity').catch(() => null),
      api.get('/period/summary').catch(() => null),
    ]).then(([regRes, sumRes]) => {
      const status = regRes?.data?.status;
      if (status === 'Regular' || status === 'Irregular') {
        setTrackedRegularity({ value: status, source: 'tracked' });
      }
      const hasEnough = sumRes?.data?.hasEnoughForPersonalization;
      const avgBleed = sumRes?.data?.avgBleedDurationDays;
      if (hasEnough && avgBleed) {
        setTrackedBleedDuration({ value: Math.round(avgBleed), source: 'tracked' });
      }
      setResolving(false);
    });
  }, []);

  const QUESTIONS = useMemo(() => {
    const list = [];
    if (!trackedBleedDuration) list.push(BLEED_QUESTION);
    list.push(...BASE_QUESTIONS);
    if (!trackedRegularity) list.push(REGULARITY_QUESTION);
    return list;
  }, [trackedRegularity, trackedBleedDuration]);

  if (resolving) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <View style={s.header}>
          <Text style={s.headerTitle}>PCOS Assessment</Text>
          <Text style={s.stepLabel}>Step 4 of 5</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.pink} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const q = QUESTIONS[qIdx];
  const progress = ((qIdx + 1) / QUESTIONS.length) * 100;
  const selectedValue = answers[q.key];

  const isSelected = (optionValue) => selectedValue === optionValue;

  const handleNext = () => {
    if (selectedValue === undefined) return;
    if (qIdx < QUESTIONS.length - 1) { setQIdx(qIdx + 1); return; }

    setLoading(true);
    const finalAnswers = { ...answers };
    const provenance = {};

    if (trackedBleedDuration) {
      finalAnswers.period_duration_days = trackedBleedDuration.value;
      provenance.period_duration_days = 'tracked';
    } else {
      provenance.period_duration_days = 'self_reported';
    }

    if (trackedRegularity) {
      finalAnswers.cycle_regularity = trackedRegularity.value;
      provenance.cycle_regularity = 'tracked';
    } else {
      provenance.cycle_regularity = 'self_reported';
    }

    navigation.navigate('ReviewAssessment', { answers: finalAnswers, provenance });
    setLoading(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => qIdx > 0 ? setQIdx(qIdx - 1) : navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>PCOS Assessment</Text>
        <Text style={s.stepLabel}>Step 4 of 5</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.stepBar}>
          {[0, 1, 2, 3].map(i => <View key={i} style={[s.stepSeg, s.stepSegDone]} />)}
          <View style={s.stepSeg} />
        </View>

        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={s.progressMeta}>
          <Text style={s.progressCount}>Q{qIdx + 1} of {QUESTIONS.length}</Text>
        </View>

        <Text style={s.qText}>{q.q}</Text>

        <View style={s.optionsCol}>
          {q.options.map(opt => (
            <TouchableOpacity
              key={opt.label}
              style={[s.ansBtn, isSelected(opt.value) && s.ansBtnActive]}
              onPress={() => setAnswers(a => ({ ...a, [q.key]: opt.value }))}
            >
              <Text style={[s.ansTxt, isSelected(opt.value) && s.ansTxtActive]}>{opt.label}</Text>
              <View style={[s.ansCheck, isSelected(opt.value) && s.ansCheckActive]} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[s.primaryBtn, selectedValue === undefined && { opacity: 0.5 }]}
          onPress={handleNext}
          disabled={selectedValue === undefined || loading}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>{qIdx === QUESTIONS.length - 1 ? 'Review Answers →' : 'Next Question →'}</Text>}
          </LinearGradient>
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
  progressBar: { height: 6, backgroundColor: colors.border, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.pink, borderRadius: 99 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressCount: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  qText: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, lineHeight: 26 },
  optionsCol: { gap: 8 },
  ansBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  ansBtnActive: { borderColor: colors.purple, backgroundColor: colors.lavender },
  ansTxt: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  ansTxtActive: { color: colors.purple, fontWeight: '800' },
  ansCheck: { width: 20, height: 20, borderRadius: 99, borderWidth: 2, borderColor: colors.border },
  ansCheckActive: { borderColor: colors.purple, backgroundColor: colors.purple },
  primaryBtn: { borderRadius: 16, overflow: 'hidden', shadowColor: '#E5457A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 8 },
  primaryGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: 16 },
  primaryTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
