import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';
import useStore from '../../store/useStore';

const SUGGESTIONS = [
  'What is PCOS?',
  'Foods to avoid with PCOS',
  'Why is my period irregular?',
  'Best exercises for PCOS',
];

export default function ChatbotScreen({ navigation }) {
  const user = useStore((s) => s.user);
  const [messages, setMessages] = useState([
    {
      type: 'bot',
      text: `Hi ${user?.full_name?.split(' ')[0] || 'there'}! 👋 I can answer questions about PCOS, nutrition, and your cycle. What would you like to know?`,
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg) return;

    setMessages(m => [...m, { type: 'user', text: msg }]);
    setInput('');
    setLoading(true);
    setShowSuggestions(false);

    try {
      const words = msg.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(' ')
        .filter(w => w.length >= 3)
        .sort((a, b) => b.length - a.length);

      const searchTerms = words.length > 0 ? words : [msg];
      let botText = '';
      let faqId = null;

      for (const term of searchTerms) {
        const res = await api.get(`/faq/search?q=${encodeURIComponent(term)}`);
        if (res.data?.length > 0) {
          botText = res.data[0].answer;
          faqId = res.data[0].id;
          break;
        }
      }

      if (!botText) {
        botText = "I don't have specific information about that. For personalized advice, please consult your gynecologist. You can find one in the Gyno Directory! 👩‍⚕️";
      }

      setMessages(m => [...m, {
        type: 'bot',
        text: botText,
        faqId,
        source: faqId ? '⚕️ Based on general health guidelines. Always consult your doctor.' : ''
      }]);

} catch (err) {
  setMessages(m => [...m, {
    type: 'bot',
    text: `Error: ${err?.response?.data?.message || err?.message || 'Unknown error'}`
  }]);

    } finally {
      setLoading(false);
    }
  };

  const markHelpful = async (faqId) => {
    if (!faqId) return;
    try {
      await api.put(`/faq/helpful/${faqId}`);
      setMessages(m => m.map(msg =>
        msg.faqId === faqId ? { ...msg, marked: true } : msg
      ));
    } catch (_) {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <LinearGradient colors={[colors.navy, colors.navyLight]} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={s.heroAvatar}>
          <Text style={{ fontSize: 20 }}>🤖</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle}>Cycle Ella Assistant</Text>
          <View style={s.onlineRow}>
            <View style={s.onlineDot} />
            <Text style={s.onlineTxt}>Online</Text>
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={s.chatArea}
          contentContainerStyle={s.chatContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((msg, i) => (
            <View key={i} style={[s.bubbleWrap, msg.type === 'user' && s.bubbleWrapUser]}>
              {msg.type === 'user' ? (
                <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.userBubble} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={s.userTxt}>{msg.text}</Text>
                </LinearGradient>
              ) : (
                <View style={s.botBubble}>
                  <Text style={s.botTxt}>{msg.text}</Text>
                  {msg.source ? <Text style={s.sourceTxt}>{msg.source}</Text> : null}
                  {msg.faqId && !msg.marked && (
                    <TouchableOpacity style={s.helpfulBtn} onPress={() => markHelpful(msg.faqId)}>
                      <Text style={s.helpfulTxt}>👍 This helped</Text>
                    </TouchableOpacity>
                  )}
                  {msg.marked && <Text style={s.markedTxt}>✅ Glad it helped!</Text>}
                </View>
              )}
            </View>
          ))}

          {loading && (
            <View style={s.bubbleWrap}>
              <View style={[s.botBubble, { paddingHorizontal: 20 }]}>
                <ActivityIndicator color={colors.purple} size="small" />
              </View>
            </View>
          )}

          {showSuggestions && (
            <View style={s.suggestWrap}>
              <Text style={s.suggestLabel}>💡 Try asking:</Text>
              <View style={s.suggestRow}>
                {SUGGESTIONS.map((q, i) => (
                  <TouchableOpacity key={i} style={s.chip} onPress={() => sendMessage(q)}>
                    <Text style={s.chipTxt}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={s.inputBar}>
          <TextInput
            style={s.inputField}
            placeholder="Ask about PCOS, diet, symptoms..."
            placeholderTextColor={colors.textSecondary}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
          />
          <TouchableOpacity onPress={() => sendMessage()} disabled={!input.trim() || loading}>
            <LinearGradient
              colors={input.trim() ? ['#E5457A', '#9B4DB5'] : [colors.border, colors.border]}
              style={s.sendBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={{ fontSize: 18, color: '#fff' }}>↑</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: '#fff', fontWeight: '700' },
  heroAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2ECC8E' },
  onlineTxt: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  chatArea: { flex: 1, backgroundColor: colors.bg },
  chatContent: { padding: 16, gap: 10, paddingBottom: 12 },
  bubbleWrap: { alignItems: 'flex-start' },
  bubbleWrapUser: { alignItems: 'flex-end' },
  botBubble: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, borderBottomLeftRadius: 4, padding: 14, maxWidth: '85%', gap: 8 },
  botTxt: { fontSize: 14, color: colors.textPrimary, lineHeight: 22 },
  userBubble: { borderRadius: 18, borderBottomRightRadius: 4, padding: 14, maxWidth: '80%' },
  userTxt: { fontSize: 14, color: '#fff', lineHeight: 22 },
  sourceTxt: { fontSize: 10, color: colors.textSecondary, fontStyle: 'italic' },
  helpfulBtn: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.lavender, borderRadius: 99 },
  helpfulTxt: { fontSize: 12, color: colors.purple, fontWeight: '700' },
  markedTxt: { fontSize: 12, color: colors.green, fontWeight: '700' },
  suggestWrap: { marginTop: 4, gap: 8 },
  suggestLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 99 },
  chipTxt: { fontSize: 12, color: colors.purple, fontWeight: '600' },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, paddingHorizontal: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  inputField: { flex: 1, padding: 12, paddingHorizontal: 16, borderWidth: 1.5, borderColor: colors.border, borderRadius: 24, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.bg },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
