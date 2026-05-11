import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!email) { Alert.alert('Error', 'Please enter your email'); return; }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      Alert.alert('Success', 'Reset code sent to your email!');
      navigation.navigate('OTP', { email, resetMode: true });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.navy }} edges={['top']}>
      <LinearGradient colors={[colors.navy, colors.navyLight]} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={{ fontSize: 48 }}>🔑</Text>
        <Text style={s.heroTitle}>Forgot Password?</Text>
        <Text style={s.heroSub}>No worries, we'll send a reset code</Text>
      </LinearGradient>

      <View style={s.sheet}>
        <View style={s.infoBox}>
          <Text style={s.infoTxt}>Enter your registered email and we'll send you a one-time code to reset your password.</Text>
        </View>

        <View style={s.field}>
          <Text style={s.label}>EMAIL ADDRESS</Text>
          <TextInput
            style={s.input}
            placeholder="kavya@email.com"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <TouchableOpacity style={s.primaryBtn} onPress={handleSend} disabled={loading} activeOpacity={0.85}>
          <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Send Reset Code</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backTxt}>← Back to Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  hero: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32, alignItems: 'center', gap: 16 },
  heroTitle: { fontSize: 26, fontWeight: '700', color: '#fff' },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  sheet: { flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, gap: 16 },
  infoBox: { backgroundColor: colors.lavender, borderRadius: 16, padding: 16 },
  infoTxt: { fontSize: 13, fontWeight: '600', color: colors.purple, lineHeight: 20, textAlign: 'center' },
  field: { gap: 8 },
  label: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { width: '100%', padding: 16, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  primaryBtn: { borderRadius: 16, overflow: 'hidden', shadowColor: '#E5457A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 8 },
  primaryGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: 16 },
  primaryTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  backBtn: { paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: 16 },
  backTxt: { fontSize: 15, fontWeight: '700', color: colors.purple },
});