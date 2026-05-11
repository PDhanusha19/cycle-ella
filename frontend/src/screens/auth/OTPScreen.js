import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

export default function OTPScreen({ navigation, route }) {
  const { phone, email, resetMode, contact } = route.params || {};
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(45);
  const [loading, setLoading] = useState(false);
  const inputs = useRef([]);

  useEffect(() => {
    const t = setInterval(() => setTimer(v => v > 0 ? v - 1 : 0), 1000);
    return () => clearInterval(t);
  }, []);

  const handleChange = (val, idx) => {
    const updated = [...otp];
    updated[idx] = val.slice(-1);
    setOtp(updated);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handleKeyPress = (e, idx) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) { Alert.alert('Error', 'Enter the 6-digit code'); return; }
    setLoading(true);
    try {
      await api.post('/auth/verify-otp', { email: email || contact, otp: code });
      if (resetMode) navigation.replace('Login');
      else navigation.replace('HealthProfile');
    } catch (err) {
      Alert.alert('Verification Failed', err.response?.data?.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const padTime = (n) => String(n).padStart(2, '0');
  const displayContact = phone ? `+94 77 *** ${String(phone).slice(-4)}` : email;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.navy }} edges={['top']}>
      <LinearGradient colors={[colors.navy, colors.navyLight]} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={{ fontSize: 48 }}>📱</Text>
        <Text style={s.heroTitle}>Verify your number</Text>
        <Text style={s.heroSub}>OTP sent to {displayContact}</Text>
      </LinearGradient>

      <View style={s.sheet}>
        <Text style={s.desc}>Enter the 6-digit code we sent you</Text>

        <View style={s.otpRow}>
          {otp.map((val, idx) => (
            <TextInput
              key={idx}
              ref={r => inputs.current[idx] = r}
              style={[s.otpBox, val && s.otpBoxFilled]}
              value={val}
              onChangeText={v => handleChange(v, idx)}
              onKeyPress={e => handleKeyPress(e, idx)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        <Text style={s.resendTxt}>
          {timer > 0
            ? <>Resend OTP in <Text style={s.resendTimer}>00:{padTime(timer)}</Text></>
            : <TouchableOpacity onPress={() => setTimer(45)}><Text style={s.resendLink}>Resend OTP</Text></TouchableOpacity>
          }
        </Text>

        <TouchableOpacity style={s.primaryBtn} onPress={handleVerify} disabled={loading} activeOpacity={0.85}>
          <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Verify & Continue</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backTxt}>← Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  hero: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32, alignItems: 'center', gap: 16 },
  heroTitle: { fontSize: 26, fontWeight: '700', color: '#fff' },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  sheet: { flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, gap: 20, alignItems: 'center' },
  desc: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
  otpRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  otpBox: { width: 48, height: 56, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, borderRadius: 16, fontSize: 22, fontWeight: '800', textAlign: 'center', color: colors.textPrimary },
  otpBoxFilled: { borderColor: colors.purple, backgroundColor: colors.lavender },
  resendTxt: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  resendTimer: { color: colors.purple, fontWeight: '800' },
  resendLink: { color: colors.purple, fontWeight: '800', fontSize: 12 },
  primaryBtn: { width: '100%', borderRadius: 16, overflow: 'hidden', shadowColor: '#E5457A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 8 },
  primaryGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: 16 },
  primaryTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  backBtn: { width: '100%', paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: 16 },
  backTxt: { fontSize: 15, fontWeight: '700', color: colors.purple },
});
