import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';

const { width } = Dimensions.get('window');

const SLIDES = [
  { emoji: '🌸', title: 'Track your cycle,\nunderstand your body', body: 'Monitor your menstrual cycle, detect cycle phases, and understand what your body is telling you every day.' },
  { emoji: '🥗', title: 'Personalized nutrition\nfor your PCOS', body: 'Get AI-powered food recommendations based on your cycle phase, budget, and Sri Lankan meals you already love.' },
  { emoji: '💡', title: 'Smart health tips\nevery single day', body: 'Receive daily tips based on your cycle, food logs, and weather — all tailored to your unique health profile.' },
  { emoji: '👩‍⚕️', title: 'Connect with\ngynecologists near you', body: 'Browse a curated directory of PCOS specialists in Sri Lanka and book appointments with ease.' },
];

export default function OnboardingScreen({ navigation }) {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  return (
    <View style={s.root}>
      <TouchableOpacity style={s.skip} onPress={() => navigation.navigate('Login')}>
        <Text style={s.skipTxt}>Skip</Text>
      </TouchableOpacity>

      <View style={s.visual}>
        <Text style={s.emoji}>{slide.emoji}</Text>
      </View>

      <View style={s.textBlock}>
        <Text style={s.heading}>{slide.title}</Text>
        <Text style={s.body}>{slide.body}</Text>
      </View>

      <View style={s.footer}>
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, i === idx && s.dotActive]} />
          ))}
        </View>

        <TouchableOpacity
          style={s.nextBtn}
          onPress={() => isLast ? navigation.navigate('Login') : setIdx(idx + 1)}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.nextGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={s.nextTxt}>{isLast ? 'Get Started →' : 'Next →'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy },
  skip: { position: 'absolute', top: 20, right: 24, zIndex: 10 },
  skipTxt: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
  visual: { flex: 1, margin: 40, marginBottom: 0, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 72 },
  textBlock: { padding: 40, paddingTop: 32, gap: 12 },
  heading: { fontSize: 26, fontWeight: '700', color: '#fff', lineHeight: 34 },
  body: { fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 24 },
  footer: { paddingHorizontal: 24, paddingBottom: 40, gap: 16 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive: { width: 24, backgroundColor: colors.pink },
  nextBtn: { borderRadius: 16, overflow: 'hidden', shadowColor: '#E5457A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 8 },
  nextGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: 16 },
  nextTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
