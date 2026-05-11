import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

export default function SignUpScreen({ navigation }) {
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', password: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSignUp = async () => {
    if (!form.fullName || !form.phone || !form.email || !form.password) {
      Alert.alert('Error', 'Please fill all required fields'); return;
    }
    if (form.password !== form.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match'); return;
    }
    if (form.password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters'); return;
    }
    setLoading(true);
    try {
      await api.post('/auth/signup', {
        full_name: form.fullName,
        phone: form.phone,
        email: form.email,
        password: form.password
      });
      navigation.navigate('OTP', { phone: form.phone, email: form.email });
    } catch (err) {
      Alert.alert('Sign Up Failed', err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.navy }} edges={['top']}>
      <LinearGradient colors={[colors.navy, colors.navyLight]} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={s.heroTitle}>Create Account</Text>
        <Text style={s.heroSub}>Join Cycle Ella today 🌸</Text>
      </LinearGradient>
      <ScrollView style={s.sheet} contentContainerStyle={s.sheetInner} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.field}>
          <Text style={s.label}>FULL NAME</Text>
          <TextInput style={s.input} placeholder="e.g. Kavya Perera" placeholderTextColor={colors.textSecondary} value={form.fullName} onChangeText={v => set('fullName', v)} />
        </View>
        <View style={s.field}>
          <Text style={s.label}>PHONE NUMBER</Text>
          <TextInput style={s.input} placeholder="+94 77 123 4567" placeholderTextColor={colors.textSecondary} value={form.phone} onChangeText={v => set('phone', v)} keyboardType="phone-pad" />
        </View>
        <View style={s.field}>
          <Text style={s.label}>EMAIL ADDRESS</Text>
          <TextInput style={s.input} placeholder="you@email.com" placeholderTextColor={colors.textSecondary} value={form.email} onChangeText={v => set('email', v)} autoCapitalize="none" keyboardType="email-address" />
        </View>
        <View style={s.field}>
          <Text style={s.label}>PASSWORD</Text>
          <View style={s.pwWrap}>
            <TextInput style={[s.input, { paddingRight: 48 }]} placeholder="Min 8 characters" placeholderTextColor={colors.textSecondary} value={form.password} onChangeText={v => set('password', v)} secureTextEntry={!showPw} />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPw(!showPw)}>
              <Text style={{ fontSize: 18 }}>{showPw ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={s.field}>
          <Text style={s.label}>CONFIRM PASSWORD</Text>
          <TextInput style={s.input} placeholder="Repeat password" placeholderTextColor={colors.textSecondary} value={form.confirmPassword} onChangeText={v => set('confirmPassword', v)} secureTextEntry />
        </View>
        <TouchableOpacity style={s.primaryBtn} onPress={handleSignUp} disabled={loading} activeOpacity={0.85}>
          <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Create Account</Text>}
          </LinearGradient>
        </TouchableOpacity>
        <View style={s.loginRow}>
          <Text style={s.loginTxt}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={s.loginLink}>Log In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  hero: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32, alignItems: 'center', gap: 8 },
  heroTitle: { fontSize: 26, fontWeight: '700', color: '#fff' },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  sheet: { flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  sheetInner: { padding: 24, gap: 12 },
  field: { gap: 8 },
  label: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { width: '100%', padding: 16, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  pwWrap: { position: 'relative' },
  eyeBtn: { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' },
  primaryBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 4, shadowColor: '#E5457A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 8 },
  primaryGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: 16 },
  primaryTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  loginTxt: { fontSize: 12, color: colors.textSecondary },
  loginLink: { fontSize: 12, color: colors.purple, fontWeight: '800' },
});