import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

const STEP_BAR = ['Health Profile', 'BMI', 'PCOS', 'History'];

function OptionGroup({ question, options, selected, onSelect }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.qTxt}>{question}</Text>
      <View style={s.optRow}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt}
            style={[s.optBtn, selected === opt && s.optBtnActive]}
            onPress={() => onSelect(opt)}
          >
            <Text style={[s.optTxt, selected === opt && s.optTxtActive]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function HealthProfileScreen({ navigation }) {
  const [diabetes, setDiabetes] = useState('None');
  const [cholesterol, setCholesterol] = useState('Not sure');
  const [bloodPressure, setBloodPressure] = useState('No');
  const [language, setLanguage] = useState('English');
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    setLoading(true);
    try {
     await api.post('/profile/health', { diabetes, cholesterol, blood_pressure: bloodPressure, language });
    } catch (_) {}
    setLoading(false);
    navigation.navigate('BMI');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Health Profile</Text>
        <Text style={s.stepLabel}>Step 1 of 4</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.stepBar}>
          {STEP_BAR.map((_, i) => (
            <View key={i} style={[s.stepSeg, i === 0 && s.stepSegDone]} />
          ))}
        </View>

        <Text style={s.hint}>This helps us personalize your experience. All fields can be updated anytime from Settings.</Text>

        <View style={s.card}>
          <Text style={s.sectionTitle}>MEDICAL CONDITIONS</Text>
          <OptionGroup question="Do you have diabetes?" options={['None', 'Pre-diabetic', 'Diet-controlled', 'Insulin-dependent']} selected={diabetes} onSelect={setDiabetes} />
          <Text style={s.hintTxt}>Diet-controlled = managed through food/exercise only. Insulin-dependent = takes insulin or diabetes medication.</Text>
          <OptionGroup question="High cholesterol?" options={['Yes', 'No', 'Not sure']} selected={cholesterol} onSelect={setCholesterol} />
          <OptionGroup question="High blood pressure?" options={['Yes', 'No', 'Not sure']} selected={bloodPressure} onSelect={setBloodPressure} />
        </View>

        <View style={s.infoBox}>
          <Text>🔒</Text>
          <Text style={s.infoTxt}>Your health data is private and stored securely. It is never shared with third parties.</Text>
        </View>

        <TouchableOpacity style={s.primaryBtn} onPress={handleNext} disabled={loading} activeOpacity={0.85}>
          <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Next</Text>}
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={s.skipBtn} onPress={() => navigation.navigate('BMI')}>
          <Text style={s.skipTxt}>Skip for now</Text>
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
  stepBar: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  stepSeg: { flex: 1, height: 4, borderRadius: 99, backgroundColor: colors.border },
  stepSegDone: { backgroundColor: colors.pink },
  hint: { fontSize: 12, color: colors.textSecondary, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  qTxt: { fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  hintTxt: { fontSize: 10.5, color: colors.textSecondary, marginTop: -6, marginBottom: 12, lineHeight: 15 },
  optRow: { flexDirection: 'row', gap: 8 },
  optBtn: { flex: 1, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.surface },
  optBtnActive: { backgroundColor: colors.lavender, borderColor: colors.purple },
  optTxt: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  optTxtActive: { color: colors.purple, fontWeight: '800' },
  infoBox: { backgroundColor: colors.lavender, borderRadius: 16, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  infoTxt: { flex: 1, fontSize: 11, color: colors.purple, fontWeight: '600', lineHeight: 18 },
  primaryBtn: { borderRadius: 16, overflow: 'hidden', shadowColor: '#E5457A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 8 },
  primaryGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: 16 },
  primaryTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  skipBtn: { paddingVertical: 16, alignItems: 'center' },
  skipTxt: { fontSize: 15, color: colors.textSecondary, fontWeight: '700' },
});