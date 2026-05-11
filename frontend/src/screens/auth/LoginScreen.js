import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../theme/colors';
import api from '../../api/api';
import useStore from '../../store/useStore';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const setToken = useStore((s) => s.setToken);
  const setUser = useStore((s) => s.setUser);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Error', 'Please fill all fields'); return; }
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      setToken(token);
      setUser(user);
      navigation.replace('Main');
    } catch (err) {
      Alert.alert('Login Failed', err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.navy }} edges={['top']}>
      <LinearGradient colors={[colors.navy, colors.navyLight]} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={s.logoBox}>
          <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.logoGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={s.logoE}>E</Text>
          </LinearGradient>
        </View>
        <Text style={s.heroTitle}>Welcome back</Text>
        <Text style={s.heroSub}>Sign in to your Cycle Ella account</Text>
      </LinearGradient>

      <ScrollView style={s.sheet} contentContainerStyle={s.sheetInner} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.field}>
          <Text style={s.label}>EMAIL OR USERNAME</Text>
          <TextInput style={s.input} placeholder="kavya@email.com" placeholderTextColor={colors.textSecondary} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        </View>

        <View style={s.field}>
          <Text style={s.label}>PASSWORD</Text>
          <View style={s.pwWrap}>
            <TextInput style={[s.input, { paddingRight: 48 }]} placeholder="Enter your password" placeholderTextColor={colors.textSecondary} value={password} onChangeText={setPassword} secureTextEntry={!showPw} />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPw(!showPw)}>
              <Text style={{ fontSize: 18 }}>{showPw ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={{ alignSelf: 'flex-end' }} onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={s.forgotTxt}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.primaryBtn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
          <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Sign In</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <View style={s.divider}><View style={s.dividerLine} /><Text style={s.dividerTxt}>or</Text><View style={s.dividerLine} /></View>

        <View style={s.signupRow}>
          <Text style={s.signupTxt}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text style={s.signupLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  hero: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 40, alignItems: 'center', gap: 16 },
  logoBox: { width: 64, height: 64, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  logoGrad: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoE: { fontSize: 24, fontWeight: '900', color: '#fff' },
  heroTitle: { fontSize: 26, fontWeight: '700', color: '#fff' },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  sheet: { flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -2 },
  sheetInner: { padding: 24, gap: 16 },
  field: { gap: 8 },
  label: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { width: '100%', padding: 16, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  pwWrap: { position: 'relative' },
  eyeBtn: { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' },
  forgotTxt: { color: colors.pink, fontWeight: '800', fontSize: 12 },
  primaryBtn: { borderRadius: 16, overflow: 'hidden', shadowColor: '#E5457A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 8 },
  primaryGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: 16 },
  primaryTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerTxt: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  signupTxt: { fontSize: 12, color: colors.textSecondary },
  signupLink: { fontSize: 12, color: colors.purple, fontWeight: '800' },
});
