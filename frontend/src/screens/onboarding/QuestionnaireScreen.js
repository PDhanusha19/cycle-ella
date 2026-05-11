import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

const QUESTIONS = [
  { q: 'Are your periods irregular or unpredictable?', cat: 'Menstrual Symptoms' },
  { q: 'Do you experience heavy bleeding during periods?', cat: 'Menstrual Symptoms' },
  { q: 'Do you have unusual hair growth on face, chest, or back?', cat: 'Hormonal Symptoms' },
  { q: 'Do you experience acne or oily skin?', cat: 'Hormonal Symptoms' },
  { q: 'Have you noticed significant hair thinning or loss?', cat: 'Hormonal Symptoms' },
  { q: 'Do you have difficulty losing weight?', cat: 'Metabolic Symptoms' },
  { q: 'Do you experience fatigue or low energy regularly?', cat: 'Metabolic Symptoms' },
  { q: 'Do you have dark patches of skin (neck, armpits)?', cat: 'Metabolic Symptoms' },
  { q: 'Do you experience mood swings or anxiety frequently?', cat: 'Mood & Wellbeing' },
  { q: 'Do you have trouble sleeping?', cat: 'Mood & Wellbeing' },
];

const OPTIONS = ['Never', 'Sometimes', 'Often', 'Always'];

export default function QuestionnaireScreen({ navigation }) {
  const [answers, setAnswers] = useState({});
  const [qIdx, setQIdx] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const q = QUESTIONS[qIdx];
  const progress = ((qIdx + 1) / QUESTIONS.length) * 100;
  const selectedAns = answers[qIdx];

  const handleNext = async () => {
    if (!selectedAns) return;
    if (qIdx < QUESTIONS.length - 1) { setQIdx(qIdx + 1); return; }
    // Calculate score
    const scoreMap = { Never: 0, Sometimes: 1, Often: 2, Always: 3 };
    const total = Object.values(answers).reduce((sum, a) => sum + (scoreMap[a] || 0), 0);
    const max = QUESTIONS.length * 3;
    const pct = (total / max) * 100;
    let risk = pct < 30 ? 'low' : pct < 60 ? 'moderate' : 'high';

    setLoading(true);
    try {
const formattedAnswers = QUESTIONS.map((q, i) => ({
  category: q.cat,
  question: q.q,
  answer: answers[i] || 'Never'
}));
const res = await api.post('/pcos/questionnaire', { answers: formattedAnswers });
risk = res.data.risk_level?.toLowerCase() || risk;
    } catch (_) {}
    setLoading(false);
    setResult(risk);
  };

  const RISK_CONFIG = {
    low: { emoji: '✅', label: 'Low Risk', color: colors.green, bg: colors.greenBg, msg: 'Your responses suggest low signs of PCOS. Continue maintaining your healthy lifestyle!' },
    moderate: { emoji: '⚠️', label: 'Moderate Risk', color: '#b8600a', bg: colors.amberBg, msg: 'Your responses suggest moderate signs of PCOS. We recommend consulting a gynecologist for a proper evaluation.' },
    high: { emoji: '🔴', label: 'High Risk', color: colors.pink, bg: colors.lightPink, msg: 'Your responses suggest significant signs of PCOS. Please consult a gynecologist as soon as possible.' },
  };

  if (result) {
    const cfg = RISK_CONFIG[result];
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
            <Text style={[s.riskMsg, { color: cfg.color }]}>{cfg.msg}</Text>
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoTxt}>💡 Early management through nutrition, lifestyle, and medical care makes a significant difference. Cycle Ella will guide you every step of the way.</Text>
          </View>
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
          <View style={s.catBadge}><Text style={s.catTxt}>{q.cat}</Text></View>
        </View>

        <Text style={s.qText}>{q.q}</Text>

        <View style={s.optionsCol}>
          {OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt}
              style={[s.ansBtn, selectedAns === opt && s.ansBtnActive]}
              onPress={() => setAnswers(a => ({ ...a, [qIdx]: opt }))}
            >
              <Text style={[s.ansTxt, selectedAns === opt && s.ansTxtActive]}>{opt}</Text>
              <View style={[s.ansCheck, selectedAns === opt && s.ansCheckActive]} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[s.primaryBtn, !selectedAns && { opacity: 0.5 }]}
          onPress={handleNext}
          disabled={!selectedAns || loading}
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
  catBadge: { backgroundColor: colors.lavender, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99 },
  catTxt: { fontSize: 11, fontWeight: '800', color: colors.purple },
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
  riskMsg: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  infoBox: { backgroundColor: colors.lavender, borderRadius: 16, padding: 16 },
  infoTxt: { fontSize: 12, color: colors.purple, fontWeight: '700', lineHeight: 20 },
  disclaimer: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', fontStyle: 'italic' },
});
