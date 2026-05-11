import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';
import useStore from '../../store/useStore';

const CATEGORIES = ['PCOS Basics', 'Nutrition', 'Cycle & Hormones', 'Symptoms'];
const PRESETS = {
  'PCOS Basics': ['What is PCOS?', 'How is PCOS diagnosed?', 'Can PCOS be cured?', 'Does PCOS affect fertility?'],
  'Nutrition': ['What foods help with PCOS?', 'Should I avoid sugar with PCOS?', 'Is a low-carb diet good for PCOS?', 'What supplements help with PCOS?'],
  'Cycle & Hormones': ['Why is my period irregular?', 'What is LH surge?', 'How does PCOS affect hormones?', 'What are cycle phases?'],
  'Symptoms': ['What causes PCOS hair loss?', 'Why do I have acne with PCOS?', 'What causes PCOS bloating?', 'How to manage PCOS fatigue?'],
};

const BOT_RESPONSES = {
  'What is PCOS?': 'PCOS (Polycystic Ovary Syndrome) is a hormonal disorder common among women of reproductive age. It affects how the ovaries work and involves irregular periods, excess androgen (male hormones), and polycystic ovaries.\n\nAround 1 in 10 women of childbearing age have PCOS.',
  'How is PCOS diagnosed?': 'PCOS is diagnosed using the Rotterdam criteria — you need at least 2 of the following:\n• Irregular or absent periods\n• High levels of androgens (blood test or signs)\n• Polycystic ovaries on ultrasound\n\nYour doctor will also rule out other conditions.',
};

export default function ChatbotScreen({ navigation }) {
  const user = useStore((s) => s.user);
  const [activeCategory, setActiveCategory] = useState('PCOS Basics');
  const [messages, setMessages] = useState([
    { type: 'bot', text: `Hi ${user?.full_name?.split(' ')[0] || 'there'}! 👋 I'm here to help with PCOS and health questions. Tap a question above or type your own below.`, source: 'Based on general health guidelines. Always consult a doctor for personal advice.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    const userMsg = { type: 'user', text: text.trim() };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setLoading(true);

    try {
      let botText = BOT_RESPONSES[text.trim()];
      let source = 'Based on general health guidelines. Always consult a doctor for personal advice.';
      if (!botText) {
        const res = await api.post('/ai/chat', { message: text.trim(), category: activeCategory });
        botText = res.data?.reply || "I'm not sure about that. Please consult your healthcare provider for personalized advice.";
        source = res.data?.source || source;
      }
      setMessages(m => [...m, { type: 'bot', text: botText, source }]);
    } catch (_) {
      setMessages(m => [...m, { type: 'bot', text: "I'm having trouble connecting right now. Please try again later.", source: '' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <LinearGradient colors={[colors.navy, colors.navyLight]} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle}>FAQ Chatbot 💬</Text>
          <Text style={s.heroSub}>Ask anything about PCOS, nutrition, or your cycle</Text>
        </View>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catBar} contentContainerStyle={s.catBarContent}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[s.catBtn, activeCategory === cat && s.catBtnActive]}
            onPress={() => setActiveCategory(cat)}
          >
            {activeCategory === cat ? (
              <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.catBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Text style={[s.catTxt, s.catTxtActive]}>{cat}</Text>
              </LinearGradient>
            ) : (
              <Text style={s.catTxt}>{cat}</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <ScrollView ref={scrollRef} style={s.chatArea} contentContainerStyle={s.chatContent} showsVerticalScrollIndicator={false}>
          {messages.length === 1 && (
            <View style={s.presetsWrap}>
              <Text style={s.presetsLabel}>Preset questions</Text>
              {(PRESETS[activeCategory] || []).map((q, i) => (
                <TouchableOpacity key={i} style={s.presetBtn} onPress={() => sendMessage(q)}>
                  <Text style={s.presetTxt}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {messages.map((msg, i) => (
            <View key={i} style={[s.bubbleWrap, msg.type === 'user' && s.bubbleWrapUser]}>
              <View style={msg.type === 'bot' ? s.botBubble : null}>
                {msg.type === 'user' ? (
                  <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.userBubble} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Text style={s.userBubbleTxt}>{msg.text}</Text>
                  </LinearGradient>
                ) : (
                  <>
                    <Text style={s.botBubbleTxt}>{msg.text}</Text>
                    {msg.source ? <Text style={s.sourceNote}>{msg.source}</Text> : null}
                  </>
                )}
              </View>
            </View>
          ))}
          {loading && (
            <View style={s.bubbleWrap}>
              <View style={s.botBubble}>
                <ActivityIndicator color={colors.purple} size="small" />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={s.inputBar}>
          <TextInput
            style={s.inputField}
            placeholder="Type your question..."
            placeholderTextColor={colors.textSecondary}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => sendMessage(input)}
            returnKeyType="send"
          />
          <TouchableOpacity style={s.sendBtn} onPress={() => sendMessage(input)} disabled={!input.trim()}>
            <View style={[s.sendBtnInner, !input.trim() && { opacity: 0.5 }]}>
              <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.sendBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Text style={{ fontSize: 16, color: '#fff' }}>→</Text>
              </LinearGradient>
            </View>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: '#fff', fontWeight: '700' },
  heroTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  heroSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  catBar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, maxHeight: 52, flexGrow: 0 },
  catBarContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  catBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  catBtnActive: { borderColor: 'transparent' },
  catBtnGrad: { borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8, margin: -16 },
  catTxt: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, whiteSpace: 'nowrap' },
  catTxtActive: { color: '#fff' },
  chatArea: { flex: 1, backgroundColor: colors.bg },
  chatContent: { padding: 16, gap: 12 },
  presetsWrap: { gap: 8 },
  presetsLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '700', textAlign: 'center' },
  presetBtn: { padding: 14, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16 },
  presetTxt: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  bubbleWrap: { alignItems: 'flex-start' },
  bubbleWrapUser: { alignItems: 'flex-end' },
  botBubble: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, borderBottomLeftRadius: 4, padding: 14, maxWidth: '86%' },
  botBubbleTxt: { fontSize: 13, color: colors.textPrimary, lineHeight: 20 },
  userBubble: { borderRadius: 20, borderBottomRightRadius: 4, padding: 14, maxWidth: '86%' },
  userBubbleTxt: { fontSize: 13, color: '#fff', lineHeight: 20 },
  sourceNote: { fontSize: 10, color: colors.textSecondary, marginTop: 8, fontStyle: 'italic' },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, paddingHorizontal: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  inputField: { flex: 1, padding: 12, paddingHorizontal: 16, borderWidth: 1.5, borderColor: colors.border, borderRadius: 99, fontSize: 13, color: colors.textPrimary },
  sendBtn: {},
  sendBtnInner: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  sendBtnGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
