import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

const MEAL_TABS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const MICRO_BADGE_COLORS = {
  low: { bg: colors.lightPink, color: colors.pink },
  good: { bg: colors.greenBg, color: '#1a8a5c' },
  ok: { bg: colors.blueBg, color: '#1565c0' },
};

export default function FoodLogScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Breakfast');
  const [search, setSearch] = useState('');
  const [foodItems, setFoodItems] = useState({});
  const [searchResults, setSearchResults] = useState([]);
  const [nutrition, setNutrition] = useState({ calories: 0, goal: 1800, protein: 0, carbs: 0, fats: 0 });
  const [micronutrients, setMicronutrients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  useEffect(() => {
    loadToday();
  }, []);

  const loadToday = async () => {
    try {
      const res = await api.get('/food/today');
      const data = res.data;
      if (data.meals) setFoodItems(data.meals);
      if (data.nutrition) setNutrition(data.nutrition);
      if (data.micronutrients) setMicronutrients(data.micronutrients);
    } catch (_) {}
  };

  const handleSearch = async (q) => {
    setSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const res = await api.get(`/food/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res.data?.items || []);
    } catch (_) {}
  };

  const addFoodItem = async (item) => {
    try {
      await api.post('/food/log', { meal: activeTab.toLowerCase(), foodItem: item.name, calories: item.calories, quantity: 1, unit: item.unit || 'serving' });
      setFoodItems(prev => ({ ...prev, [activeTab]: [...(prev[activeTab] || []), item] }));
      setSearch('');
      setSearchResults([]);
      loadToday();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not add food item');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/food/save-log', { date: new Date().toISOString().split('T')[0] });
      Alert.alert('Saved!', 'Your food log has been saved.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not save log');
    } finally {
      setSaving(false);
    }
  };

  const currentMealItems = foodItems[activeTab] || [];
  const calPct = nutrition.goal > 0 ? Math.min((nutrition.calories / nutrition.goal) * 100, 100) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Food Log</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.dateBar}>
        <Text style={s.dateLabel}>Today, {today}</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Voice Button */}
        <View style={s.voiceSection}>
          <TouchableOpacity style={s.micBtn} activeOpacity={0.85}>
            <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.micGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={{ fontSize: 28 }}>🎤</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={s.micLabel}>Tap to speak</Text>
          <View style={s.langChips}>
            {['🇬🇧 English', '🇱🇰 සිංහල', '🇱🇰 தமிழ்'].map(l => (
              <View key={l} style={s.langChip}><Text style={s.langChipTxt}>{l}</Text></View>
            ))}
          </View>
        </View>

        {/* Search */}
        <TextInput
          style={s.searchInput}
          placeholder="🔍 Or search food manually..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={handleSearch}
        />

        {/* Search Results */}
        {searchResults.length > 0 && (
          <View style={s.searchResults}>
            {searchResults.map((item, i) => (
              <TouchableOpacity key={i} style={s.searchResultItem} onPress={() => addFoodItem(item)}>
                <Text style={s.searchResultName}>{item.name}</Text>
                <Text style={s.searchResultCal}>{item.calories} kcal</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Meal Tabs */}
        <View style={s.mealTabs}>
          {MEAL_TABS.map(tab => (
            <TouchableOpacity key={tab} style={[s.mealTab, activeTab === tab && s.mealTabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[s.mealTabTxt, activeTab === tab && s.mealTabTxtActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Food Items */}
        <View style={s.card}>
          {currentMealItems.length === 0 ? (
            <Text style={s.emptyTxt}>No items logged for {activeTab.toLowerCase()} yet</Text>
          ) : currentMealItems.map((item, i) => (
            <View key={i} style={s.foodItem}>
              <Text style={s.foodEmoji}>{item.emoji || '🍽️'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.foodName}>{item.name}</Text>
                <Text style={s.foodQty}>{item.quantity} {item.unit}</Text>
              </View>
              <Text style={s.foodCal}>{item.calories} kcal</Text>
            </View>
          ))}
          <TouchableOpacity style={s.addFoodBtn}>
            <Text style={s.addFoodTxt}>+ Add food item</Text>
          </TouchableOpacity>
        </View>

        {/* Daily Summary */}
        <Text style={s.sectionTitle}>Daily Summary</Text>
        <View style={[s.card, { gap: 12 }]}>
          <View style={s.calRow}>
            <Text style={s.calNum}>{nutrition.calories.toLocaleString()} kcal</Text>
            <Text style={s.calGoal}>of {nutrition.goal.toLocaleString()} goal · {Math.round(calPct)}%</Text>
          </View>
          <View style={s.calBar}>
            <LinearGradient colors={['#E5457A', '#9B4DB5']} style={[s.calFill, { width: `${calPct}%` }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
          </View>
          <View style={s.macroGrid}>
            <View style={s.macroCell}>
              <Text style={s.macroVal}>{nutrition.protein || 0}g</Text>
              <Text style={s.macroLabel}>Protein</Text>
            </View>
            <View style={s.macroCell}>
              <Text style={s.macroVal}>{nutrition.carbs || 0}g</Text>
              <Text style={s.macroLabel}>Carbs</Text>
            </View>
            <View style={[s.macroCell, { borderRightWidth: 0 }]}>
              <Text style={s.macroVal}>{nutrition.fats || 0}g</Text>
              <Text style={s.macroLabel}>Fats</Text>
            </View>
          </View>
          <Text style={s.sectionTitle}>Micronutrients</Text>
          <View style={s.microRow}>
            {micronutrients.length > 0 ? micronutrients.map((m, i) => {
              const cfg = MICRO_BADGE_COLORS[m.status] || MICRO_BADGE_COLORS.ok;
              return (
                <View key={i} style={[s.microBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[s.microTxt, { color: cfg.color }]}>{m.label}</Text>
                </View>
              );
            }) : (
              <>
                <View style={[s.microBadge, { backgroundColor: colors.lightPink }]}><Text style={[s.microTxt, { color: colors.pink }]}>⚠️ Iron — Low</Text></View>
                <View style={[s.microBadge, { backgroundColor: colors.greenBg }]}><Text style={[s.microTxt, { color: '#1a8a5c' }]}>✓ Calcium</Text></View>
                <View style={[s.microBadge, { backgroundColor: colors.lavender }]}><Text style={[s.microTxt, { color: colors.purple }]}>↗ Vitamin D</Text></View>
              </>
            )}
          </View>
        </View>

        <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.saveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnTxt}>Save Log</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingHorizontal: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: colors.purple, fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  dateBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  dateLabel: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  scroll: { padding: 16, gap: 16 },
  voiceSection: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  micBtn: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', shadowColor: '#E5457A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  micGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  micLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  langChips: { flexDirection: 'row', gap: 8 },
  langChip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.lavender, borderRadius: 99 },
  langChipTxt: { fontSize: 11, fontWeight: '700', color: colors.purple },
  searchInput: { padding: 16, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, fontSize: 14, color: colors.textPrimary },
  searchResults: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  searchResultItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchResultName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  searchResultCal: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  mealTabs: { flexDirection: 'row', backgroundColor: colors.lavender, borderRadius: 16, padding: 4, gap: 4 },
  mealTab: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  mealTabActive: { backgroundColor: colors.surface },
  mealTabTxt: { fontSize: 11, fontWeight: '800', color: colors.textSecondary },
  mealTabTxtActive: { color: colors.purple },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border },
  emptyTxt: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', paddingVertical: 8 },
  foodItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  foodEmoji: { fontSize: 22, width: 32 },
  foodName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  foodQty: { fontSize: 11, color: colors.textSecondary },
  foodCal: { fontSize: 12, fontWeight: '800', color: colors.purple },
  addFoodBtn: { marginTop: 8, backgroundColor: colors.lavender, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start' },
  addFoodTxt: { fontSize: 11, fontWeight: '800', color: colors.purple },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  calRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calNum: { fontSize: 15, fontWeight: '900', color: colors.textPrimary },
  calGoal: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  calBar: { height: 8, backgroundColor: colors.border, borderRadius: 99, overflow: 'hidden' },
  calFill: { height: '100%', borderRadius: 99 },
  macroGrid: { flexDirection: 'row' },
  macroCell: { flex: 1, alignItems: 'center', gap: 2, borderRightWidth: 1, borderRightColor: colors.border },
  macroVal: { fontSize: 17, fontWeight: '900', color: colors.textPrimary },
  macroLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
  microRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  microBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99 },
  microTxt: { fontSize: 11, fontWeight: '700' },
  saveBtn: { borderRadius: 16, overflow: 'hidden', shadowColor: '#E5457A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 8 },
  saveBtnGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: 16 },
  saveBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
