import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, LayoutAnimation, Platform, UIManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function FAQCard({ item, expanded, onToggle, onMarkHelpful, marked }) {
  return (
    <TouchableOpacity style={s.card} activeOpacity={0.8} onPress={onToggle}>
      <View style={s.cardTop}>
        <Text style={s.cardEmoji}>{item.category_emoji || '❓'}</Text>
        <Text style={s.cardQuestion}>{item.question}</Text>
        <Text style={s.cardChevron}>{expanded ? '︿' : '﹀'}</Text>
      </View>
      {expanded && (
        <View style={s.cardBody}>
          <Text style={s.cardAnswer}>{item.answer}</Text>
          <View style={s.cardFooter}>
            <Text style={s.cardCategory}>{item.category}</Text>
            <TouchableOpacity
              style={[s.helpfulBtn, marked && s.helpfulBtnDone]}
              onPress={onMarkHelpful}
              disabled={marked}
            >
              <Text style={[s.helpfulTxt, marked && s.helpfulTxtDone]}>
                {marked ? '✓ Thanks!' : `👍 Helpful (${item.helpful_count || 0})`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function FAQScreen({ navigation }) {
  const [faqs, setFaqs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [markedIds, setMarkedIds] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const [faqRes, catRes] = await Promise.all([
          api.get('/faq'),
          api.get('/faq/categories'),
        ]);
        setFaqs(Array.isArray(faqRes.data) ? faqRes.data : []);
        setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      } catch (_) {
        // leave lists empty — the screen still renders its empty state
      }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return faqs.filter((f) => {
      const matchesCategory = activeCategory === 'All' || f.category === activeCategory;
      const matchesSearch = q.length < 2
        || f.question.toLowerCase().includes(q)
        || f.answer.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [faqs, activeCategory, search]);

  const toggleExpand = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((cur) => (cur === id ? null : id));
  };

  const markHelpful = async (id) => {
    setMarkedIds((m) => ({ ...m, [id]: true }));
    setFaqs((list) => list.map((f) => (f.id === id ? { ...f, helpful_count: (f.helpful_count || 0) + 1 } : f)));
    try {
      await api.put(`/faq/helpful/${id}`);
    } catch (_) {
      // optimistic update stands even if the vote didn't persist —
      // not worth surfacing an error for a "was this helpful" tap
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <LinearGradient colors={[colors.navy, colors.navyLight]} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle}>FAQ Library</Text>
          <Text style={s.heroSub}>Curated PCOS questions & answers</Text>
        </View>
      </LinearGradient>

      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput}
          placeholder="🔍 Search questions..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterPicker}>
        <TouchableOpacity
          style={[s.filterBtn, activeCategory === 'All' && s.filterBtnActive]}
          onPress={() => setActiveCategory('All')}
        >
          <Text style={[s.filterTxt, activeCategory === 'All' && s.filterTxtActive]}>All</Text>
        </TouchableOpacity>
        {categories.map((c) => (
          <TouchableOpacity
            key={c.category}
            style={[s.filterBtn, activeCategory === c.category && s.filterBtnActive]}
            onPress={() => setActiveCategory(c.category)}
          >
            <Text style={[s.filterTxt, activeCategory === c.category && s.filterTxtActive]}>
              {c.category_emoji} {c.category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.purple} style={{ marginTop: 24 }} />
        ) : filtered.length === 0 ? (
          <Text style={s.emptyTxt}>No questions found. Try a different search or category.</Text>
        ) : (
          <>
            <Text style={s.resultCount}>{filtered.length} question{filtered.length !== 1 ? 's' : ''}</Text>
            {filtered.map((item) => (
              <FAQCard
                key={item.id}
                item={item}
                expanded={expandedId === item.id}
                onToggle={() => toggleExpand(item.id)}
                onMarkHelpful={() => markHelpful(item.id)}
                marked={!!markedIds[item.id]}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: '#fff', fontWeight: '700' },
  heroTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  heroSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 14 },
  searchInput: { padding: 14, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, fontSize: 14, color: colors.textPrimary },
  filterScroll: { marginTop: 12 },
  filterPicker: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  filterBtnActive: { backgroundColor: colors.lavender, borderColor: colors.purple },
  filterTxt: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  filterTxtActive: { color: colors.purple },
  scroll: { padding: 16, paddingTop: 12, gap: 10 },
  resultCount: { fontSize: 11, color: colors.textSecondary, fontWeight: '700', marginBottom: 2 },
  emptyTxt: { textAlign: 'center', color: colors.textSecondary, fontSize: 13, padding: 24 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 14, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardEmoji: { fontSize: 16 },
  cardQuestion: { flex: 1, fontSize: 13.5, fontWeight: '700', color: colors.textPrimary, lineHeight: 19 },
  cardChevron: { fontSize: 12, color: colors.textSecondary },
  cardBody: { gap: 10, paddingLeft: 26 },
  cardAnswer: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardCategory: { fontSize: 10, fontWeight: '700', color: colors.purple, backgroundColor: colors.lavender, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  helpfulBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1.5, borderColor: colors.pink, backgroundColor: colors.lightPink },
  helpfulBtnDone: { borderColor: colors.green, backgroundColor: colors.greenBg },
  helpfulTxt: { fontSize: 11, fontWeight: '800', color: colors.pink },
  helpfulTxtDone: { color: colors.green },
});
