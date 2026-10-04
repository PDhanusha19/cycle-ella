import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';
import useStore from '../../store/useStore';

const SUGGESTIONS = [
  'What is PCOS?',
  'What tests should I take?',
  'What should I eat?',
  'Best exercises for PCOS',
];

const GRAD_COLORS = [
  ['#E5457A', '#9B4DB5'],
  ['#9B4DB5', '#E5457A'],
  ['#E5457A', '#F5A623'],
  ['#4DB5E5', '#9B4DB5'],
  ['#F5A623', '#E5457A'],
];

const DISTRICTS = [
  'All', 'Colombo', 'Kandy', 'Gampaha', 'Kurunegala',
  'Galle', 'Anuradhapura', 'Kalutara', 'Matara',
  'Ratnapura', 'Trincomalee'
];

function DoctorCard({ doc, idx }) {
  const handleCall = () => {
    const phone = doc.contact || doc.phone;
    if (!phone) {
      Alert.alert('No Phone', 'No phone number available.');
      return;
    }
    const cleaned = phone.toString().replace(/[^0-9+]/g, '');
    const url = `tel:${cleaned}`;
    Linking.canOpenURL(url)
      .then(supported => {
        if (supported) Linking.openURL(url);
        else Alert.alert('Call', `Please dial: ${phone}`);
      })
      .catch(() => Alert.alert('Call', `Please dial: ${phone}`));
  };

  const handleDirections = () => {
    let url;
    if (doc.latitude && doc.longitude) {
      url = `geo:${doc.latitude},${doc.longitude}?q=${doc.latitude},${doc.longitude}`;
    } else {
      const query = encodeURIComponent(`${doc.hospital} Sri Lanka`);
      url = `https://maps.google.com/maps?q=${query}`;
    }
    Linking.canOpenURL(url)
      .then(supported => {
        if (supported) Linking.openURL(url);
        else {
          const query = encodeURIComponent(`${doc.hospital} Sri Lanka`);
          Linking.openURL(`https://maps.google.com/maps?q=${query}`);
        }
      })
      .catch(() => Alert.alert('Error', 'Could not open maps.'));
  };

  const initials = doc.name
    ? doc.name.replace(/^(Dr\.|Prof\.|Dr)\s*/i, '').charAt(0).toUpperCase()
    : '?';

  const gradColors = GRAD_COLORS[idx % GRAD_COLORS.length];
  const fee = doc.fee !== undefined && doc.fee !== null
    ? (parseInt(doc.fee) === 0 ? 'Free (Gov.)' : `Rs. ${doc.fee}`)
    : 'N/A';
  const isGov = doc.is_government === 1 || doc.is_government === true;

  return (
    <View style={s.docCard}>
      <View style={s.docTop}>
        <LinearGradient colors={gradColors} style={s.docAvatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={s.docInitials}>{initials}</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={s.docName}>{doc.name || 'Unknown'}</Text>
          <Text style={s.docSpec}>{doc.specialization || doc.spec || 'Gynaecologist'}</Text>
          <Text style={s.docHospital}>{doc.hospital || ''}</Text>
        </View>
      </View>
      <View style={s.docBadges}>
        <View style={[s.badge, { backgroundColor: colors.lavender }]}>
          <Text style={[s.badgeTxt, { color: colors.purple }]}>📍 {doc.district || 'Unknown'}</Text>
        </View>
        <View style={[s.badge, { backgroundColor: isGov ? colors.blueBg : colors.greenBg }]}>
          <Text style={[s.badgeTxt, { color: isGov ? '#1565c0' : '#1a8a5c' }]}>
            {isGov ? '🏥' : '💰'} {fee}
          </Text>
        </View>
        {doc.contact && (
          <View style={[s.badge, { backgroundColor: colors.lightPink }]}>
            <Text style={[s.badgeTxt, { color: colors.pink }]}>📞 {doc.contact}</Text>
          </View>
        )}
      </View>
      <View style={s.docActions}>
        <TouchableOpacity style={[s.docBtn, s.callBtn]} onPress={handleCall}>
          <Text style={[s.docBtnTxt, { color: colors.pink }]}>📞 Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.docBtn, s.mapBtn]} onPress={handleDirections}>
          <Text style={[s.docBtnTxt, { color: colors.purple }]}>🗺️ Directions</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function HealthAssistantScreen({ navigation, route }) {
  const user = useStore((s) => s.user);
  const [tab, setTab] = useState(route?.params?.initialTab === 'doctors' ? 'doctors' : 'chat');

  // --- Chat state ---
  const [messages, setMessages] = useState([
    {
      type: 'bot',
      text: `Hi ${user?.full_name?.split(' ')[0] || 'there'}! 👋 I'm Ella, your health guide. I can explain PCOS, tests, food and exercise — and help you find a real doctor when you need one. What's on your mind?`,
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollRef = useRef(null);

  // --- Doctor directory state ---
  const [search, setSearch] = useState('');
  const [district, setDistrict] = useState('All');
  const [doctors, setDoctors] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/gyno');
        if (Array.isArray(res.data) && res.data.length > 0) setDoctors(res.data);
      } catch (_) {}
      setDocsLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (tab === 'chat') {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, tab]);

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg) return;

    const updated = [...messages, { type: 'user', text: msg }];
    setMessages(updated);
    setInput('');
    setLoading(true);
    setShowSuggestions(false);

    try {
      const history = updated.slice(-11, -1).map(m => ({
        role: m.type === 'bot' ? 'bot' : 'user',
        text: m.text,
      }));

      // Gemini can take longer than the app's default 30s request timeout to
      // respond, especially under load — give this specific call more room
      // before falling back to the FAQ library.
      const res = await api.post('/chatbot/ask', { message: msg, history }, { timeout: 45000 });

      setMessages(m => [...m, {
        type: 'bot',
        text: res.data.reply,
        suggestGyno: res.data.suggest_gyno,
        needsAssessment: !res.data.has_assessment,
        source: '🤖 AI guide — not a substitute for medical advice.',
      }]);
    } catch (err) {
      // Fall back to the FAQ library if the AI is unreachable. The backend's
      // /faq/search already extracts and scores keywords from the whole
      // query (question-match weighted above tag-match) — splitting into
      // single words here and trying the longest first only threw that
      // scoring away and let generic words like "should" win over the
      // actually meaningful one ("tests"), landing on unrelated answers.
      try {
        let botText = '';
        const r = await api.get(`/faq/search?q=${encodeURIComponent(msg)}`);
        if (r.data?.length > 0) botText = r.data[0].answer;

        if (!botText) {
          botText = "I'm having trouble connecting right now. For personal advice, please see a gynecologist — check the Find a Doctor tab above. 👩‍⚕️";
        }
        setMessages(m => [...m, { type: 'bot', text: botText, source: '⚕️ From our FAQ library.' }]);
      } catch (_) {
        setMessages(m => [...m, { type: 'bot', text: 'Something went wrong. Please try again in a moment.' }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const filtered = doctors.filter(d => {
    if (!d) return false;
    const name = (d.name || '').toLowerCase();
    const hospital = (d.hospital || '').toLowerCase();
    const q = search.toLowerCase();
    const matchesSearch = search.length < 2 || name.includes(q) || hospital.includes(q);
    const matchesDistrict = district === 'All' || d.district === district;
    return matchesSearch && matchesDistrict;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <LinearGradient colors={[colors.navy, colors.navyLight]} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={s.heroAvatar}><Text style={{ fontSize: 20 }}>💜</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle}>Health Assistant</Text>
          <Text style={s.heroSub}>Ask anything • Find a doctor</Text>
        </View>
      </LinearGradient>

      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tab, tab === 'chat' && s.tabActive]} onPress={() => setTab('chat')}>
          <Text style={[s.tabTxt, tab === 'chat' && s.tabTxtActive]}>💬 Ask Ella</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'doctors' && s.tabActive]} onPress={() => setTab('doctors')}>
          <Text style={[s.tabTxt, tab === 'doctors' && s.tabTxtActive]}>👩‍⚕️ Find a Doctor</Text>
        </TouchableOpacity>
      </View>

      {tab === 'chat' ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scrollRef}
            style={s.chatArea}
            contentContainerStyle={s.chatContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
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
                    {msg.suggestGyno && (
                      <TouchableOpacity style={s.actionBtn} onPress={() => setTab('doctors')}>
                        <Text style={s.actionTxt}>👩‍⚕️ Find a gynecologist near you →</Text>
                      </TouchableOpacity>
                    )}
                    {msg.needsAssessment && (
                      <TouchableOpacity style={s.actionBtnAlt} onPress={() => navigation.navigate('Questionnaire')}>
                        <Text style={s.actionTxtAlt}>📋 Take the PCOS assessment →</Text>
                      </TouchableOpacity>
                    )}
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
              placeholder="Ask about PCOS, tests, food..."
              placeholderTextColor={colors.textSecondary}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => sendMessage()}
              returnKeyType="send"
            />
            <TouchableOpacity onPress={() => sendMessage()} disabled={!input.trim() || loading}>
              <LinearGradient
                colors={input.trim() ? ['#E5457A', '#9B4DB5'] : [colors.border, colors.border]}
                style={s.sendBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Text style={{ fontSize: 18, color: '#fff' }}>↑</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <TextInput
            style={s.searchInput}
            placeholder="🔍 Search doctor or hospital..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterPicker}>
            {DISTRICTS.map(d => (
              <TouchableOpacity key={d} style={[s.filterBtn, district === d && s.filterBtnActive]} onPress={() => setDistrict(d)}>
                <Text style={[s.filterTxt, district === d && s.filterTxtActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {docsLoading ? (
            <Text style={s.emptyTxt}>Loading doctors...</Text>
          ) : filtered.length === 0 ? (
            <Text style={s.emptyTxt}>No doctors found matching your search.</Text>
          ) : (
            <>
              <Text style={s.resultCount}>
                {filtered.length} doctor{filtered.length !== 1 ? 's' : ''} found
                {district !== 'All' ? ` in ${district}` : ''}
              </Text>
              {filtered.map((doc, idx) => <DoctorCard key={doc?.id || idx} doc={doc} idx={idx} />)}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: '#fff', fontWeight: '700' },
  heroAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  heroSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.pink },
  tabTxt: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  tabTxtActive: { color: colors.pink },
  chatArea: { flex: 1, backgroundColor: colors.bg },
  chatContent: { padding: 16, gap: 10, paddingBottom: 12 },
  bubbleWrap: { alignItems: 'flex-start' },
  bubbleWrapUser: { alignItems: 'flex-end' },
  botBubble: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, borderBottomLeftRadius: 4, padding: 14, maxWidth: '88%', gap: 8 },
  botTxt: { fontSize: 14, color: colors.textPrimary, lineHeight: 22 },
  userBubble: { borderRadius: 18, borderBottomRightRadius: 4, padding: 14, maxWidth: '80%' },
  userTxt: { fontSize: 14, color: '#fff', lineHeight: 22 },
  sourceTxt: { fontSize: 10, color: colors.textSecondary, fontStyle: 'italic' },
  actionBtn: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.lightPink, borderRadius: 12, borderWidth: 1.5, borderColor: colors.pink },
  actionTxt: { fontSize: 12, color: colors.pink, fontWeight: '800' },
  actionBtnAlt: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.lavender, borderRadius: 12, borderWidth: 1.5, borderColor: colors.purple },
  actionTxtAlt: { fontSize: 12, color: colors.purple, fontWeight: '800' },
  suggestWrap: { marginTop: 4, gap: 8 },
  suggestLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 99 },
  chipTxt: { fontSize: 12, color: colors.purple, fontWeight: '600' },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, paddingHorizontal: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  inputField: { flex: 1, padding: 12, paddingHorizontal: 16, borderWidth: 1.5, borderColor: colors.border, borderRadius: 24, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.bg },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, gap: 12 },
  searchInput: { padding: 14, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, fontSize: 14, color: colors.textPrimary },
  filterScroll: { marginHorizontal: -16 },
  filterPicker: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  filterBtnActive: { backgroundColor: colors.lavender, borderColor: colors.purple },
  filterTxt: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  filterTxtActive: { color: colors.purple },
  resultCount: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  docCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 16, gap: 12 },
  docTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  docAvatar: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  docInitials: { fontSize: 20, fontWeight: '900', color: '#fff' },
  docName: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  docSpec: { fontSize: 11, fontWeight: '700', color: colors.purple, marginTop: 2 },
  docHospital: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  docBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  badgeTxt: { fontSize: 10, fontWeight: '700' },
  docActions: { flexDirection: 'row', gap: 8 },
  docBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  callBtn: { borderColor: colors.pink, backgroundColor: colors.lightPink },
  mapBtn: { borderColor: colors.purple, backgroundColor: colors.lavender },
  docBtnTxt: { fontSize: 12, fontWeight: '800' },
  emptyTxt: { textAlign: 'center', color: colors.textSecondary, fontSize: 13, padding: 24 },
});