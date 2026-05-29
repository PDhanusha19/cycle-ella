import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import useStore from '../../store/useStore';

export default function SplashScreen({ navigation }) {
  const isLoggedIn = useStore((s) => s.isLoggedIn);
  const r1 = useRef(new Animated.Value(1)).current;
  const r2 = useRef(new Animated.Value(1)).current;
  const r3 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isLoggedIn) { navigation.replace('Main'); return; }
    [r1, r2, r3].forEach((r, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.timing(r, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
          Animated.timing(r, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    });
  }, [isLoggedIn]);

  return (
    <View style={s.root}>
      {[r1, r2, r3].map((r, i) => (
        <Animated.View
          key={i}
          style={[s.ring, { width: 180 + i * 100, height: 180 + i * 100, transform: [{ scale: r }] }]}
        />
      ))}

      <View style={s.logoBox}>
        <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.logoGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={s.logoE}>E</Text>
        </LinearGradient>
      </View>

      <Text style={s.title}>Cycle Ella</Text>
   
   
      <Text style={s.sub}>Your PCOS companion,{'\n'}personalized for you 🌸</Text>

      <TouchableOpacity style={s.primary} onPress={() => navigation.navigate('Onboarding')} activeOpacity={0.85}>
        <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={s.primaryTxt}>Get Started</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={s.ghost} onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
        <Text style={s.ghostTxt}>I have an account</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 48, overflow: 'hidden' },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(229,69,122,0.15)' },
  logoBox: { width: 96, height: 96, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', zIndex: 2, shadowColor: '#E5457A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 40, elevation: 8 },
  logoGrad: { width: 72, height: 72, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  logoE: { fontSize: 38, fontWeight: '900', color: '#fff' },
  title: { fontSize: 32, fontWeight: '700', color: '#fff', textAlign: 'center', zIndex: 2 },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 24, zIndex: 2 },
  primary: { width: '100%', borderRadius: 16, overflow: 'hidden', zIndex: 2, shadowColor: '#E5457A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 8 },
  primaryGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: 16 },
  primaryTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ghost: { width: '100%', paddingVertical: 16, alignItems: 'center', borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', zIndex: 2 },
  ghostTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '700' },
});
