import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

const YES_NO_OPTIONS = [{ label: 'Yes', value: true }, { label: 'No', value: false }];
const yesNoDisplay = (v) => (v ? 'Yes' : 'No');

const FIELD_DEFS = {
  period_duration_days: {
    label: 'Period Duration',
    options: [
      { label: '2-3 days', value: 3 },
      { label: '4-5 days', value: 5 },
      { label: '6-7 days', value: 7 },
      { label: '8 or more days', value: 9 },
    ],
    display: (v) => `${v} day${v === 1 ? '' : 's'}`,
  },
  cycle_regularity: {
    label: 'Cycle Regularity',
    options: [{ label: 'Regular', value: 'Regular' }, { label: 'Irregular', value: 'Irregular' }],
    display: (v) => v,
  },
  weight_gain: { label: 'Unexplained Weight Gain', options: YES_NO_OPTIONS, display: yesNoDisplay },
  hair_growth: { label: 'Excess Hair Growth', options: YES_NO_OPTIONS, display: yesNoDisplay },
  skin_darkening: { label: 'Skin Darkening', options: YES_NO_OPTIONS, display: yesNoDisplay },
  hair_loss: { label: 'Hair Thinning / Loss', options: YES_NO_OPTIONS, display: yesNoDisplay },
  pimples: { label: 'Frequent Acne', options: YES_NO_OPTIONS, display: yesNoDisplay },
  fast_food: { label: 'Frequent Fast Food', options: YES_NO_OPTIONS, display: yesNoDisplay },
  regular_exercise: { label: 'Regular Exercise', options: YES_NO_OPTIONS, display: yesNoDisplay },
};

const FIELD_ORDER = [
  'period_duration_days', 'cycle_regularity', 'weight_gain', 'hair_growth',
  'skin_darkening', 'hair_loss', 'pimples', 'fast_food', 'regular_exercise',
];

// The screening model reports its top coefficients using the raw column
// names of the training dataset. Map all 13 to readable labels; an
// unmapped name falls back to the raw string rather than disappearing.
const FACTOR_LABELS = {
  'Age (yrs)': 'Age',
  'Weight (Kg)': 'Weight',
  'Height(Cm)': 'Height',
  'BMI': 'BMI',
  'Cycle(R/I)': 'Cycle regularity',
  'Cycle length(days)': 'Period duration',
  'Weight gain(Y/N)': 'Unexplained weight gain',
  'hair growth(Y/N)': 'Excess hair growth',
  'Skin darkening (Y/N)': 'Skin darkening',
  'Hair loss(Y/N)': 'Hair thinning / loss',
  'Pimples(Y/N)': 'Frequent acne',
  'Fast food (Y/N)': 'Frequent fast food',
  'Reg.Exercise(Y/N)': 'Regular exercise',
};

const factorLabel = (raw) => FACTOR_LABELS[raw] || raw;

const RISK_CONFIG = {
  low: { emoji: '✅', label: 'Low Risk', color: colors.green, bg: colors.greenBg },
  medium: { emoji: '⚠️', label: 'Medium Risk', color: '#b8600a', bg: colors.amberBg },
  moderate: { emoji: '⚠️', label: 'Medium Risk', color: '#b8600a', bg: colors.amberBg },
  high: { emoji: '🔴', label: 'High Risk', color: colors.pink, bg: colors.lightPink },
};

export default function ReviewAssessmentScreen({ navigation, route }) {
  const [answers, setAnswers] = useState(route.params?.answers || {});
  const [provenance, setProvenance] = useState(route.params?.provenance || {});
  const [expandedField, setExpandedField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [result, setResult] = useState(null);

  const overrideField = (key, value) => {
    setAnswers(a => ({ ...a, [key]: value }));
    setProvenance(p => ({ ...p, [key]: 'self_reported' }));
    setExpandedField(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.post('/pcos/assessment', {
        ...answers,
        cycle_regularity_source: provenance.cycle_regularity || 'self_reported',
        period_duration_days_source: provenance.period_duration_days || 'self_reported',
      });
      setResult({
        risk_level: (res.data.risk_level || 'Medium').toLowerCase(),
        probability: res.data.pcos_probability_percent,
        description: res.data.description,
        top_factors: res.data.top_contributing_factors || [],
      });
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || 'Something went wrong while calculating your risk. Please try again.');
    }
    setLoading(false);
  };

  if (errorMsg) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <View style={s.header}>
          <Text style={s.headerTitle}>PCOS Assessment</Text>
          <Text style={s.stepLabel}>Step 5 of 5</Text>
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
          <Text style={s.stepLabel}>Step 5 of 5</Text>
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
            <View style={s.factorsCard}>
              <Text style={s.factorsHeading}>Main factors the screening model considers</Text>
              {result.top_factors.map((raw, i) => (
                <View key={`${raw}-${i}`} style={s.factorRow}>
                  <Text style={s.factorBullet}>•</Text>
                  <Text style={s.factorTxt}>{factorLabel(raw)}</Text>
                </View>
              ))}
              <Text style={s.factorsNote}>
                These are general model factors, not a personal diagnosis.
              </Text>
            </View>
          )}

          <Text style={s.disclaimer}>⚕️ This is a risk indicator, not a medical diagnosis.</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => {
            // Best-effort — a failed reminder setup shouldn't block onboarding.
            api.post('/reminders/setup-defaults').catch(() => {});
            navigation.replace('Main');
          }} activeOpacity={0.85}>
            <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={s.primaryTxt}>Continue</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Review Your Answers</Text>
        <Text style={s.stepLabel}>Step 5 of 5</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.stepBar}>
          {[0, 1, 2, 3, 4].map(i => <View key={i} style={[s.stepSeg, s.stepSegDone]} />)}
        </View>

        <Text style={s.hint}>Double-check everything below before we calculate your result. Tap any answer to change it.</Text>

        <View style={s.card}>
          {FIELD_ORDER.map((key, i) => {
            const def = FIELD_DEFS[key];
            const value = answers[key];
            const isTracked = provenance[key] === 'tracked';
            const expanded = expandedField === key;
            return (
              <View key={key} style={[s.row, i === FIELD_ORDER.length - 1 && s.rowLast]}>
                <TouchableOpacity style={s.rowHeader} onPress={() => setExpandedField(expanded ? null : key)} activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowLabel}>{def.label}</Text>
                    <Text style={s.rowValue}>{def.display(value)}</Text>
                    {isTracked && (
                      <View style={s.trackedBadge}>
                        <Text style={s.trackedBadgeTxt}>Tracked from your logged periods</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.rowChevron}>{expanded ? '▲' : '✎'}</Text>
                </TouchableOpacity>
                {expanded && (
                  <View style={s.optionsRow}>
                    {def.options.map(opt => (
                      <TouchableOpacity
                        key={opt.label}
                        style={[s.optBtn, value === opt.value && s.optBtnActive]}
                        onPress={() => overrideField(key, opt.value)}
                      >
                        <Text style={[s.optTxt, value === opt.value && s.optTxtActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={s.primaryBtn} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
          <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Submit Assessment →</Text>}
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
  hint: { fontSize: 12, color: colors.textSecondary, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, overflow: 'hidden' },
  row: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLast: { borderBottomWidth: 0 },
  rowHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 8 },
  rowLabel: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  rowValue: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  rowChevron: { fontSize: 14, color: colors.purple, marginTop: 2 },
  trackedBadge: { alignSelf: 'flex-start', backgroundColor: colors.lavender, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6 },
  trackedBadgeTxt: { fontSize: 9, fontWeight: '800', color: colors.purple },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
  optBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg },
  optBtnActive: { borderColor: colors.purple, backgroundColor: colors.lavender },
  optTxt: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  optTxtActive: { color: colors.purple },
  primaryBtn: { borderRadius: 16, overflow: 'hidden', shadowColor: '#E5457A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 8 },
  primaryGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: 16 },
  primaryTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  riskCard: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 12, width: '100%' },
  riskLabel: { fontSize: 22, fontWeight: '900' },
  riskPct: { fontSize: 14, fontWeight: '700' },
  riskMsg: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  infoBox: { backgroundColor: colors.lavender, borderRadius: 16, padding: 16 },
  factorsCard: { width: '100%', backgroundColor: colors.lavender, borderRadius: 16, padding: 16, gap: 6 },
  factorsHeading: { fontSize: 12, fontWeight: '800', color: colors.purple, marginBottom: 2 },
  factorRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  factorBullet: { fontSize: 12, color: colors.purple, fontWeight: '800', lineHeight: 20 },
  factorTxt: { flex: 1, fontSize: 13, color: colors.textPrimary, fontWeight: '600', lineHeight: 20 },
  factorsNote: { fontSize: 11, color: colors.textSecondary, fontStyle: 'italic', lineHeight: 18, marginTop: 4 },
  infoTxt: { fontSize: 12, color: colors.purple, fontWeight: '700', lineHeight: 20 },
  disclaimer: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', fontStyle: 'italic' },
});
