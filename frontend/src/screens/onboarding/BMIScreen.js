import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

function getBMILabel(bmi) {
  if (bmi < 18.5) return { label: 'Underweight', color: colors.blue };
  if (bmi < 25) return { label: 'Normal Weight', color: colors.green };
  if (bmi < 30) return { label: 'Overweight', color: colors.amber };
  return { label: 'Obese', color: colors.pink };
}

export default function BMIScreen({ navigation }) {
  const [weight, setWeight] = useState('62');
  const [height, setHeight] = useState('162');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [heightUnit, setHeightUnit] = useState('cm');
  const [loading, setLoading] = useState(false);

  const weightKg = weightUnit === 'kg' ? parseFloat(weight) : parseFloat(weight) * 0.453592;
  const heightM = heightUnit === 'cm' ? parseFloat(height) / 100 : parseFloat(height) * 0.3048;
  const bmi = heightM > 0 ? (weightKg / (heightM * heightM)).toFixed(1) : 0;
  const { label: bmiLabel, color: bmiColor } = getBMILabel(parseFloat(bmi));

  const handleNext = async () => {
    setLoading(true);
    try {
    await api.post('/profile/measurements', { weight: weightKg.toFixed(1), height: (heightM * 100).toFixed(1) });
    } catch (_) {}
    setLoading(false);
    navigation.navigate('Questionnaire');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Measurements</Text>
        <Text style={s.stepLabel}>Step 2 of 4</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.stepBar}>
          {[0, 1].map(i => <View key={i} style={[s.stepSeg, s.stepSegDone]} />)}
          {[2, 3].map(i => <View key={i} style={s.stepSeg} />)}
        </View>

        <View style={s.field}>
          <Text style={s.label}>CURRENT WEIGHT</Text>
          <View style={s.row}>
            <TextInput style={[s.input, { flex: 1 }]} value={weight} onChangeText={setWeight} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
            <View style={s.unitToggle}>
              {['kg', 'lbs'].map(u => (
                <TouchableOpacity key={u} style={[s.unitBtn, weightUnit === u && s.unitBtnActive]} onPress={() => setWeightUnit(u)}>
                  <Text style={[s.unitTxt, weightUnit === u && s.unitTxtActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Text style={s.hint}>⏰ Update this every month — reminder will be set</Text>
        </View>

        <View style={s.field}>
          <Text style={s.label}>HEIGHT</Text>
          <View style={s.row}>
            <TextInput style={[s.input, { flex: 1 }]} value={height} onChangeText={setHeight} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
            <View style={s.unitToggle}>
              {['cm', 'ft'].map(u => (
                <TouchableOpacity key={u} style={[s.unitBtn, heightUnit === u && s.unitBtnActive]} onPress={() => setHeightUnit(u)}>
                  <Text style={[s.unitTxt, heightUnit === u && s.unitTxtActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Text style={s.hint}>⏰ Update every 3 months — reminder will be set</Text>
        </View>

        <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.bmiCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={[s.bmiLabelBadge]}>
            <Text style={s.bmiLabelTxt}>Your BMI</Text>
          </View>
          <Text style={s.bmiNum}>{bmi}</Text>
          <View style={[s.bmiLabelBadge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Text style={s.bmiLabelTxt}>{bmiLabel}</Text>
          </View>
          <Text style={s.bmiDesc}>A healthy range is 18.5 – 24.9. For PCOS, maintaining a healthy BMI helps regulate hormones and improves treatment outcomes.</Text>
        </LinearGradient>

        <View style={s.infoBox}>
          <Text>📏</Text>
          <Text style={s.infoTxt}>Last updated: Today · Next weight update due: Jun 4</Text>
        </View>

        <TouchableOpacity style={s.primaryBtn} onPress={handleNext} disabled={loading} activeOpacity={0.85}>
          <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Next</Text>}
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={s.ghostBtn} onPress={() => navigation.goBack()}>
          <Text style={s.ghostTxt}>← Back</Text>
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
  field: { gap: 8 },
  label: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { padding: 16, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  unitToggle: { flexDirection: 'row', backgroundColor: colors.lavender, borderRadius: 12, overflow: 'hidden' },
  unitBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  unitBtnActive: { backgroundColor: colors.purple },
  unitTxt: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  unitTxtActive: { color: '#fff' },
  hint: { fontSize: 11, color: colors.textSecondary },
  bmiCard: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 12 },
  bmiLabelBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 4, borderRadius: 99 },
  bmiLabelTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  bmiNum: { fontSize: 48, fontWeight: '900', color: '#fff' },
  bmiDesc: { fontSize: 12, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 18 },
  infoBox: { backgroundColor: colors.lavender, borderRadius: 16, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
  infoTxt: { flex: 1, fontSize: 11, color: colors.purple, fontWeight: '600' },
  primaryBtn: { borderRadius: 16, overflow: 'hidden', shadowColor: '#E5457A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 8 },
  primaryGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: 16 },
  primaryTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ghostBtn: { paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: 16 },
  ghostTxt: { fontSize: 15, fontWeight: '700', color: colors.purple },
});
