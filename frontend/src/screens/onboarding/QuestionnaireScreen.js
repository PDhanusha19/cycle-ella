import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

// These 9 questions map directly to what the trained PCOS model needs.
// (Age, weight, and height are already collected earlier in onboarding,
// so we don't ask for them again here.)
const QUESTIONS = [
  {
    key: 'cycle_regularity',
    q: 'Are your periods regular or irregular?',
    options: [
      { label: 'Regular', value: 'Regular' },
      { label: 'Irregular', value: 'Irregular' },
    ],
  },
  {
    key: 'period_duration_days',
    q: 'How many days does your period usually last?',
    options: [
      { label: '2-3 days', value: 3 },
      { label: '4-5 days', value: 5 },
      { label: '6-7 days', value: 7 },
      { label: '8 or more days', value: 9 },
    ],
  },
  {
    key: 'weight_gain',
    q: 'Have you noticed unexplained weight gain recently?',
    options: [{ label: 'Yes', value: true }, { label: 'No', value: false }],
  },
  {
    key: 'hair_growth',
    q: 'Do you have excess hair growth on your face, chest, or back?',
    options: [{ label: 'Yes', value: true }, { label: 'No', value: false }],
  },
  {
    key: 'skin_darkening',
    q: 'Have you noticed dark patches of skin on your neck, armpits, or groin?',
    options: [{ label: 'Yes', value: true }, { label: 'No', value: false }],
  },
  {
    key: 'hair_loss',
    q: 'Have you experienced noticeable hair thinning or hair loss?',
    options: [{ label: 'Yes', value: true }, { label: 'No', value: false }],
  },
  {
    key: 'pimples',
    q: 'Do you frequently get acne or pimples?',
    options: [{ label: 'Yes', value: true }, { label: 'No', value: false }],
  },
  {
    key: 'fast_food',
    q: 'Do you eat fast food or fried food often (3+ times a week)?',
    options: [{ label: 'Yes', value: true }, { label: 'No', value: false }],
  },
  {
    key: 'regular_exercise',
    q: 'Do you exercise regularly (at least 2-3 times a week)?',
    options: [{ label: 'Yes', value: true }, { label: 'No', value: false }],
  },
];

export default function QuestionnaireScreen({ navigation }) {
  const [answers, setAnswers] = useState({});
  const [qIdx, setQIdx] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const q = QUESTIONS[qIdx];
  const progress = ((qIdx + 1) / QUESTIONS.length) * 100;
  const selectedValue = answers[q.key];

  const isSelected = (optionValue) => selectedValue === optionValue;

  const handleNext = async () => {
    if (selectedValue === undefined) return;
    if (qIdx < QUESTIONS.length - 1) { setQIdx(qIdx + 1); return; }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.post('/pcos/assessment', answers);
      setResult({
        risk_level: (res.data.risk_level || 'Medium').toLowerCase(),
        probability: res.data.pcos_probability_percent,
        description: res.data.description,
        top_factors: res.data.top_contributing_factors || [],
      });
    } catch (err) {
      const backendMsg = err?.response?.data?.message;
      setErrorMsg(backendMsg || 'Something went wrong while calculating your risk. Please try again.');
    }
    setLoading(false);
  };

  const RISK_CONFIG = {
    low: { emoji: '✅', label: 'Low Risk', color: colors.green, bg: colors.greenBg },
    medium: { emoji: '⚠️', label: 'Medium Risk', color: '#b8600a', bg: colors.amberBg },
    moderate: { emoji: '⚠️', label: 'Medium Risk', color: '#b8600a', bg: colors.amberBg },
    high: { emoji: '🔴', label: 'High Risk', color: colors.pink, bg: colors.lightPink },
  };

  if (errorMsg) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <View style={s.header}>
          <Text style={s.headerTitle}>PCOS Assessment</Text>
          <Text style={s.stepLabel}>Step 3 of 4</Text>
        </View>
        <ScrollView contentContainerStyle={[s.scroll, { alignItems: 'center' }]}>
          <View style={[s.riskCard, { backgroundColor: colors.amberBg }]}>
            <Text style={{ fontSize: 40 }}>⚠️</Text>
            <Text style={[s.riskMsg, { color: '#b8600a' }]}>{errorMsg}</Text>
          </View>
          <TouchableOpacity style={s.primaryBtn} onPress={() => setErrorMsg(null)} activeOpacity={0.85}>
            <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={s.primaryTxt}>Try Again</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (result) {
    const cfg = RISK_CONFIG[result.risk_level] || RISK_CONFIG.medium;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <View style={s.header}>
          <Text style={s.headerTitle}>PCOS Assessment</Text>
          <Text style={s.stepLabel}>Step 3 of 4</Text>
        </View>
        <ScrollView contentContainerStyle={[s.scroll, { alignItems: 'center' }]}>
          <View style={[s.riskCard, { backgroundColor: cfg.bg }]}>
            <Text style={{ fontSize: 48 }}>{cfg.emoji}</Text>
            <Text style={[s.riskLabel, { color: cfg.color }]}>{cfg.label}</Text>
            {result.probability !== undefined && (
              <Text style={[s.riskPct, { color: cfg.color }]}>{result.probability}% probability</Text>
            )}
            <Text style={[s.riskMsg, { color: cfg.color }]}>{result.description}</Text>
          </View>

          {result.top_factors.length > 0 && (
            <View style={s.infoBox}>
              <Text style={s.infoTxt}>
                💡 The biggest contributing factors in your answers: {result.top_factors.join(', ')}
              </Text>
            </View>
          )}

          <Text style={s.disclaimer}>⚕️ This is a risk indicator, not a medical diagnosis.</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => navigation.navigate('PeriodHistory')} activeOpacity={0.85}>
            <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={s.primaryTxt}>Continue Setup</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => qIdx > 0 ? setQIdx(qIdx - 1) : navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>PCOS Assessment</Text>
        <Text style={s.stepLabel}>Step 3 of 4</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.stepBar}>
          {[0, 1, 2].map(i => <View key={i} style={[s.stepSeg, s.stepSegDone]} />)}
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
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>{qIdx === QUESTIONS.length - 1 ? 'See Results →' : 'Next Question →'}</Text>}
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
  riskCard: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 12, width: '100%' },
  riskLabel: { fontSize: 22, fontWeight: '900' },
  riskPct: { fontSize: 14, fontWeight: '700' },
  riskMsg: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  infoBox: { backgroundColor: colors.lavender, borderRadius: 16, padding: 16 },
  infoTxt: { fontSize: 12, color: colors.purple, fontWeight: '700', lineHeight: 20 },
  disclaimer: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', fontStyle: 'italic' },
});