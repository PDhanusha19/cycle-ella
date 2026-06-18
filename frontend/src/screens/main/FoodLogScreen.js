import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

const MEAL_TABS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const UNITS = ['g', 'pieces', 'cups', 'tbsp', 'serving'];
const UNIT_TO_GRAMS = { 'g': 1, 'pieces': 100, 'cups': 200, 'tbsp': 15, 'serving': 150 };
const BASE = 'http://192.168.8.141:3000/api';

function calcMacros(food, quantity, unit) {
  const base = food.serving_size_g || 100;
  const grams = parseFloat(quantity || 1) * UNIT_TO_GRAMS[unit];
  const ratio = grams / base;
  return {
    calories: Math.round((food.calories || 0) * ratio),
    protein: Math.round((food.protein || 0) * ratio * 10) / 10,
    carbs: Math.round((food.carbs || 0) * ratio * 10) / 10,
    fats: Math.round((food.fats || 0) * ratio * 10) / 10,
  };
}

function QuantityModal({ visible, food, activeTab, onClose, onAdd }) {
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('serving');

  useEffect(() => {
    if (food) { setQuantity('1'); setUnit('serving'); }
  }, [food]);

  if (!food) return null;
  const macros = calcMacros(food, quantity, unit);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <View style={m.header}>
            <Text style={m.foodEmoji}>🍽️</Text>
            <View style={{ flex: 1 }}>
              <Text style={m.foodName}>{food.name}</Text>
              <Text style={m.foodCat}>{food.category} · {food.glycemic_index || 'medium'} GI</Text>
            </View>
            <TouchableOpacity style={m.closeBtn} onPress={onClose}>
              <Text style={m.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={m.question}>How much did you eat?</Text>

          <View style={m.amountRow}>
            <TextInput
              style={m.amountInput}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              selectTextOnFocus
            />
            <Text style={m.amountLabel}>{unit}</Text>
          </View>

          <View style={m.unitsRow}>
            {UNITS.map(u => (
              <TouchableOpacity
                key={u}
                style={[m.unitChip, unit === u && m.unitChipActive]}
                onPress={() => setUnit(u)}
              >
                <Text style={[m.unitChipTxt, unit === u && m.unitChipTxtActive]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={m.macrosBox}>
            <View style={m.macroItem}>
              <Text style={m.macroVal}>{macros.calories}</Text>
              <Text style={m.macroLabel}>kcal</Text>
            </View>
            <View style={m.macroDivider} />
            <View style={m.macroItem}>
              <Text style={m.macroVal}>{macros.protein}g</Text>
              <Text style={m.macroLabel}>Protein</Text>
            </View>
            <View style={m.macroDivider} />
            <View style={m.macroItem}>
              <Text style={m.macroVal}>{macros.carbs}g</Text>
              <Text style={m.macroLabel}>Carbs</Text>
            </View>
            <View style={m.macroDivider} />
            <View style={m.macroItem}>
              <Text style={m.macroVal}>{macros.fats}g</Text>
              <Text style={m.macroLabel}>Fats</Text>
            </View>
          </View>

          <TouchableOpacity
            style={m.addBtn}
            onPress={() => onAdd(food, quantity, unit, macros)}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#E5457A', '#9B4DB5']} style={m.addBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={m.addBtnTxt}>Add to {activeTab} ✓</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function FoodLogScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Breakfast');
  const [search, setSearch] = useState('');
  const [foodItems, setFoodItems] = useState({});
  const [searchResults, setSearchResults] = useState([]);
  const [nutrition, setNutrition] = useState({ calories: 0, goal: 1800, protein: 0, carbs: 0, fats: 0 });
  const [saving, setSaving] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  useEffect(() => {
    loadToday();
    loadPopularFoods();
  }, []);

  const loadToday = async () => {
    try {
      const res = await api.get('/food/today');
      const data = res.data;
      if (data.meals) setFoodItems(data.meals);
      if (data.nutrition) setNutrition(prev => ({ ...prev, ...data.nutrition }));
    } catch (_) {}
  };

  const loadPopularFoods = async () => {
    try {
      const res = await fetch(`${BASE}/food/search?q=curry`);
      const data = await res.json();
      setSearchResults(data?.items?.slice(0, 8) || []);
    } catch (_) {}
  };

  const handleSearch = async (q) => {
    setSearch(q);
    if (q.length < 2) {
      loadPopularFoods();
      return;
    }
    try {
      const res = await fetch(`${BASE}/food/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data?.items || []);
    } catch (_) {}
  };

  const onSelectFood = (item) => {
    setSelectedFood(item);
    setShowModal(true);
  };

  const onConfirmAdd = async (food, quantity, unit, macros) => {
    // Close modal first
    setShowModal(false);
    setSelectedFood(null);

    // Update UI immediately
    setFoodItems(prev => ({
      ...prev,
      [activeTab]: [
        ...(prev[activeTab] || []),
        {
          ...food,
          calories: macros.calories,
          protein: macros.protein,
          carbs: macros.carbs,
          fats: macros.fats,
          quantity: parseFloat(quantity),
          unit
        }
      ]
    }));

    // Update nutrition summary immediately
    setNutrition(n => ({
      ...n,
      calories: (n.calories || 0) + macros.calories,
      protein: Math.round(((n.protein || 0) + macros.protein) * 10) / 10,
      carbs: Math.round(((n.carbs || 0) + macros.carbs) * 10) / 10,
      fats: Math.round(((n.fats || 0) + macros.fats) * 10) / 10,
    }));

    // Save to backend
    try {
      await api.post('/food/log', {
        meal_type: activeTab,
        food_name: food.name,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fats: macros.fats,
        quantity: parseFloat(quantity),
        unit,
      });
    } catch (_) {}
  };

  const handleSave = () => {
    Alert.alert('Saved! 🌸', 'Your food log has been saved successfully.');
  };

  const currentMealItems = foodItems[activeTab] || [];
  const calPct = nutrition.goal > 0 ? Math.min((nutrition.calories / nutrition.goal) * 100, 100) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <QuantityModal
        visible={showModal}
        food={selectedFood}
        activeTab={activeTab}
        onClose={() => { setShowModal(false); setSelectedFood(null); }}
        onAdd={onConfirmAdd}
      />

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
              <View key={l} style={s.langChip}>
                <Text style={s.langChipTxt}>{l}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Search */}
        <TextInput
          style={s.searchInput}
          placeholder="🔍 Search food..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={handleSearch}
        />

        {/* Food List */}
        {searchResults.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>
              {search.length < 2 ? '🔥 Popular Foods' : `🔍 Results for "${search}"`}
            </Text>
            {searchResults.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[s.foodResultItem, i === searchResults.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => onSelectFood(item)}
              >
                <View style={s.foodResultLeft}>
                  <Text style={s.foodResultName}>{item.name}</Text>
                  <Text style={s.foodResultMeta}>
                    {item.category} · {item.glycemic_index} GI
                    {item.pcos_friendly ? ' · ✅ PCOS' : ''}
                  </Text>
                </View>
                <View style={s.foodResultRight}>
                  <Text style={s.foodResultCal}>{item.calories}</Text>
                  <Text style={s.foodResultCalLabel}>kcal</Text>
                </View>
                <Text style={s.foodResultAdd}>+</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Meal Tabs */}
        <View style={s.mealTabs}>
          {MEAL_TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[s.mealTab, activeTab === tab && s.mealTabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[s.mealTabTxt, activeTab === tab && s.mealTabTxtActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logged Food Items */}
        <View style={s.card}>
          {currentMealItems.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyEmoji}>🍽️</Text>
              <Text style={s.emptyTxt}>Nothing logged for {activeTab.toLowerCase()} yet</Text>
              <Text style={s.emptySub}>Search above and tap + to add food</Text>
            </View>
          ) : currentMealItems.map((item, i) => (
            <View key={i} style={[s.foodItem, i === currentMealItems.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={s.foodEmoji}>🍽️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.foodName}>{item.name}</Text>
                <Text style={s.foodQty}>{item.quantity} {item.unit}</Text>
              </View>
              <Text style={s.foodCal}>{item.calories} kcal</Text>
            </View>
          ))}
        </View>

        {/* Daily Summary */}
        <Text style={s.sectionTitleLarge}>Daily Summary</Text>
        <View style={[s.card, { gap: 12 }]}>
          <View style={s.calRow}>
            <Text style={s.calNum}>{nutrition.calories} kcal</Text>
            <Text style={s.calGoal}>of {nutrition.goal} goal · {Math.round(calPct)}%</Text>
          </View>
          <View style={s.calBar}>
            <LinearGradient
              colors={['#E5457A', '#9B4DB5']}
              style={[s.calFill, { width: `${calPct}%` }]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            />
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
        </View>

        <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          <LinearGradient colors={['#E5457A', '#9B4DB5']} style={s.saveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnTxt}>Save Log ✓</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foodEmoji: { fontSize: 32 },
  foodName: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  foodCat: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  question: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.lavender, borderRadius: 16, padding: 16 },
  amountInput: { fontSize: 32, fontWeight: '900', color: colors.purple, minWidth: 60, textAlign: 'center' },
  amountLabel: { fontSize: 16, color: colors.purple, fontWeight: '700' },
  unitsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  unitChipActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  unitChipTxt: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  unitChipTxtActive: { color: '#fff' },
  macrosBox: { flexDirection: 'row', backgroundColor: colors.lavender, borderRadius: 16, padding: 16 },
  macroItem: { flex: 1, alignItems: 'center', gap: 2 },
  macroVal: { fontSize: 18, fontWeight: '900', color: colors.purple },
  macroLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
  macroDivider: { width: 1, backgroundColor: colors.border },
  addBtn: { borderRadius: 16, overflow: 'hidden' },
  addBtnGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: 16 },
  addBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingHorizontal: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: colors.purple, fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  dateBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  dateLabel: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  scroll: { padding: 16, gap: 16 },
  voiceSection: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  micBtn: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', elevation: 6 },
  micGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  micLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  langChips: { flexDirection: 'row', gap: 8 },
  langChip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.lavender, borderRadius: 99 },
  langChipTxt: { fontSize: 11, fontWeight: '700', color: colors.purple },
  searchInput: { padding: 16, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, fontSize: 14, color: colors.textPrimary },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  sectionTitleLarge: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  foodResultItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  foodResultLeft: { flex: 1 },
  foodResultName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  foodResultMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  foodResultRight: { alignItems: 'center' },
  foodResultCal: { fontSize: 14, fontWeight: '900', color: colors.purple },
  foodResultCalLabel: { fontSize: 9, color: colors.textSecondary },
  foodResultAdd: { fontSize: 22, color: colors.pink, fontWeight: '900', marginLeft: 4 },
  mealTabs: { flexDirection: 'row', backgroundColor: colors.lavender, borderRadius: 16, padding: 4, gap: 4 },
  mealTab: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  mealTabActive: { backgroundColor: colors.surface },
  mealTabTxt: { fontSize: 11, fontWeight: '800', color: colors.textSecondary },
  mealTabTxtActive: { color: colors.purple },
  emptyWrap: { alignItems: 'center', paddingVertical: 16, gap: 4 },
  emptyEmoji: { fontSize: 32 },
  emptyTxt: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  emptySub: { fontSize: 11, color: colors.textSecondary },
  foodItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  foodEmoji: { fontSize: 22, width: 32 },
  foodName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  foodQty: { fontSize: 11, color: colors.textSecondary },
  foodCal: { fontSize: 12, fontWeight: '800', color: colors.purple },
  calRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calNum: { fontSize: 15, fontWeight: '900', color: colors.textPrimary },
  calGoal: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  calBar: { height: 8, backgroundColor: colors.border, borderRadius: 99, overflow: 'hidden' },
  calFill: { height: '100%', borderRadius: 99 },
  macroGrid: { flexDirection: 'row' },
  macroCell: { flex: 1, alignItems: 'center', gap: 2, borderRightWidth: 1, borderRightColor: colors.border },
  macroVal: { fontSize: 17, fontWeight: '900', color: colors.textPrimary },
  macroLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
  saveBtn: { borderRadius: 16, overflow: 'hidden', elevation: 8 },
  saveBtnGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: 16 },
  saveBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});