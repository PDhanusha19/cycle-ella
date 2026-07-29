import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

const BMI_RANGES = [
  { label: 'Underweight', min: 10, max: 18.5, color: '#3B9EFF', bg: '#DFF0FF' },
  { label: 'Normal',      min: 18.5, max: 25,  color: '#2ECC8E', bg: '#D4F5E9' },
  { label: 'Overweight',  min: 25,   max: 30,  color: '#F5A623', bg: '#FFF3D4' },
  { label: 'Obese',       min: 30,   max: 45,  color: '#E5457A', bg: '#FDE8F0' },
];

const BMI_MIN = 10;
const BMI_MAX = 45;
const BMI_TOTAL = BMI_MAX - BMI_MIN;

function getBMIInfo(bmi) {
  return BMI_RANGES.find(r => bmi < r.max) || BMI_RANGES[3];
}

function getPointerPercent(bmi) {
  const clamped = Math.min(Math.max(bmi, BMI_MIN), BMI_MAX);
  return ((clamped - BMI_MIN) / BMI_TOTAL) * 100;
}

function BMIGauge({ bmi }) {
  const animVal = useRef(new Animated.Value(0)).current;
  const pct = getPointerPercent(parseFloat(bmi) || 0);
  const info = getBMIInfo(parseFloat(bmi) || 0);

  useEffect(() => {
    Animated.spring(animVal, {
      toValue: pct,
      useNativeDriver: false,
      friction: 8,
    }).start();
  }, [pct]);

  const segWidths = BMI_RANGES.map(r => ((r.max - r.min) / BMI_TOTAL) * 100);

  return (
    <View style={g.wrap}>
      <Text style={g.title}>BMI Indicator</Text>

      {/* Gauge bar */}
      <View style={g.barWrap}>
        {/* Colored segments */}
        <View style={g.barRow}>
          {BMI_RANGES.map((range, i) => (
            <View
              key={i}
              style={[
                g.seg,
                { flex: range.max - range.min, backgroundColor: range.color },
                i === 0 && g.segLeft,
                i === BMI_RANGES.length - 1 && g.segRight,
              ]}
            />
          ))}
        </View>

        {/* Pointer */}
        <Animated.View
          style={[
            g.pointer,
            {
              left: animVal.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        >
          <View style={[g.pointerArrow, { borderBottomColor: info.color }]} />
          <View style={[g.pointerDot, { backgroundColor: info.color }]} />
        </Animated.View>
      </View>

      {/* Labels */}
      <View style={g.labelsRow}>
        {BMI_RANGES.map((r, i) => (
          <View key={i} style={[g.labelCell, { flex: r.max - r.min }]}>
            <Text style={[g.labelTxt, { color: r.color }]}>{r.label}</Text>
            <Text style={g.labelNum}>{r.min}</Text>
          </View>
        ))}
        <Text style={[g.labelNum, { position: 'absolute', right: 0, bottom: 0 }]}>
          {BMI_RANGES[BMI_RANGES.length - 1].max}
        </Text>
      </View>

      {/* Result badge */}
      <View style={[g.badge, { backgroundColor: info.bg }]}>
        <View style={[g.badgeDot, { backgroundColor: info.color }]} />
        <Text style={[g.badgeTxt, { color: info.color }]}>
          Your BMI {bmi} — {info.label}
        </Text>
      </View>

      {/* Tip */}
      <Text style={g.tip}>
        {info.label === 'Normal'
          ? '✅ Great! Maintain your healthy weight to help manage PCOS symptoms.'
          : info.label === 'Underweight'
          ? '⚠️ Being underweight can affect your hormones. Try to gain weight gradually.'
          : info.label === 'Overweight'
          ? '⚠️ Losing 5-10% body weight can significantly improve PCOS symptoms.'
          : '⚠️ Managing your weight through diet and exercise helps control PCOS.'}
      </Text>
    </View>
  );
}

export default function BMIScreen({ navigation }) {
  const [weight, setWeight] = useState('62');
  const [height, setHeight] = useState('162');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [heightUnit, setHeightUnit] = useState('cm');
  const [loading, setLoading] = useState(false);

  const weightKg = weightUnit === 'kg' ? parseFloat(weight || 0) : parseFloat(weight || 0) * 0.453592;
  const heightM = heightUnit === 'cm' ? parseFloat(height || 0) / 100 : parseFloat(height || 0) * 0.3048;
  const bmi = heightM > 0 ? (weightKg / (heightM * heightM)).toFixed(1) : '0.0';

  const handleNext = async () => {
    setLoading(true);
    try {
      await api.post('/profile/measurements', {
        weight: weightKg.toFixed(1),
        height: (heightM * 100).toFixed(1),
      });
    } catch (_) {}
    setLoading(false);
    navigation.navigate('PeriodHistory');
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

        {/* Weight */}
        <View style={s.field}>
          <Text style={s.label}>CURRENT WEIGHT</Text>
          <View style={s.row}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
              placeholderTextColor={colors.textSecondary}
            />
            <View style={s.unitToggle}>
              {['kg', 'lbs'].map(u => (
                <TouchableOpacity key={u} style={[s.unitBtn, weightUnit === u && s.unitBtnActive]} onPress={() => setWeightUnit(u)}>
                  <Text style={[s.unitTxt, weightUnit === u && s.unitTxtActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Text style={s.hint}>⏰ Please update this every month</Text>
        </View>

        {/* Height */}
        <View style={s.field}>
          <Text style={s.label}>HEIGHT</Text>
          <View style={s.row}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={height}
              onChangeText={setHeight}
              keyboardType="numeric"
              placeholderTextColor={colors.textSecondary}
            />
            <View style={s.unitToggle}>
              {['cm', 'ft'].map(u => (
                <TouchableOpacity key={u} style={[s.unitBtn, heightUnit === u && s.unitBtnActive]} onPress={() => setHeightUnit(u)}>
                  <Text style={[s.unitTxt, heightUnit === u && s.unitTxtActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Text style={s.hint}>⏰ Please update every 3 months</Text>
        </View>

        {/* BMI Gauge */}
        <BMIGauge bmi={bmi} />

        <TouchableOpacity style={s.primaryBtn} onPress={handleNext} disabled={loading} activeOpacity={0.85}>
          <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Next →</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={s.ghostBtn} onPress={() => navigation.goBack()}>
          <Text style={s.ghostTxt}>← Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const g = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, gap: 14, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  barWrap: { position: 'relative', marginTop: 16 },
  barRow: { flexDirection: 'row', height: 14, borderRadius: 99, overflow: 'hidden' },
  seg: { height: '100%' },
  segLeft: { borderTopLeftRadius: 99, borderBottomLeftRadius: 99 },
  segRight: { borderTopRightRadius: 99, borderBottomRightRadius: 99 },
  pointer: { position: 'absolute', top: -10, alignItems: 'center', marginLeft: -8 },
  pointerArrow: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#E5457A' },
  pointerDot: { width: 12, height: 12, borderRadius: 6, marginTop: 2, borderWidth: 2, borderColor: '#fff' },
  labelsRow: { flexDirection: 'row', marginTop: 8, position: 'relative' },
  labelCell: { alignItems: 'flex-start' },
  labelTxt: { fontSize: 9, fontWeight: '800' },
  labelNum: { fontSize: 9, color: colors.textSecondary, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 99, alignSelf: 'center' },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeTxt: { fontSize: 13, fontWeight: '800' },
  tip: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, textAlign: 'center' },
});

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
  primaryBtn: { borderRadius: 16, overflow: 'hidden', shadowColor: '#E5457A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 8 },
  primaryGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: 16 },
  primaryTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ghostBtn: { paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: 16 },
  ghostTxt: { fontSize: 15, fontWeight: '700', color: colors.purple },
});