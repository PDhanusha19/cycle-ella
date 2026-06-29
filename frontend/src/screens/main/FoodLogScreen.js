import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, Animated, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';
import * as IntentLauncher from 'expo-intent-launcher';

const MEAL_TABS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const UNITS = ['g', 'pieces', 'cups', 'tbsp', 'serving'];
const UNIT_TO_GRAMS = { 'g': 1, 'pieces': 100, 'cups': 200, 'tbsp': 15, 'serving': 150 };
const BASE = 'http://192.168.8.141:3000/api';

const LANG_OPTIONS = [
  { code: 'en-US', label: '🇬🇧 English' },
  { code: 'si-LK', label: '🇱🇰 සිංහල' },
  { code: 'ta-LK', label: '🇱🇰 தமிழ்' },
];

const WORD_TO_NUM = {
  'a': 1, 'an': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
  'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'half': 0.5, 'quarter': 0.25, 'couple': 2,
};

const UNIT_MAP = {
  'g': 'g', 'gram': 'g', 'grams': 'g',
  'kg': 'kg', 'kilo': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
  'piece': 'pieces', 'cup': 'cups', 'tbsp': 'tbsp',
  'tablespoon': 'tbsp', 'tsp': 'tbsp', 'teaspoon': 'tbsp',
  'serving': 'serving', 'plate': 'serving', 'bowl': 'serving', 'slice': 'pieces',
};

const UNICODE_NUMS = {
  'එකක්': '1', 'දෙකක්': '2', 'තුනක්': '3', 'හතරක්': '4', 'පහක්': '5',
  'ஒன்று': '1', 'இரண்டு': '2', 'மூன்று': '3', 'நான்கு': '4', 'ஐந்து': '5',
};

const UNICODE_UNITS = {
  'ග්‍රෑම්': 'g', 'ග්රෑම්': 'g', 'කිලෝ': 'kg',
  'කෝප්ප': 'cups', 'හැදි': 'tbsp',
  'கிராம்': 'g', 'கிலோ': 'kg', 'கப்': 'cups',
};

const STOP_WORDS = [
  'i ate', 'i had', 'i eat', 'i have', 'i drank',
  'for breakfast', 'for lunch', 'for dinner',
  'today', 'this morning', 'just now',
];

function parseVoiceInput(text) {
  try {
    let cleaned = text;
    Object.entries(UNICODE_UNITS).forEach(([w, u]) => { try { cleaned = cleaned.split(w).join(` ${u} `); } catch (_) {} });
    Object.entries(UNICODE_NUMS).forEach(([w, n]) => { try { cleaned = cleaned.split(w).join(` ${n} `); } catch (_) {} });
    cleaned = cleaned.toLowerCase();
    STOP_WORDS.forEach(w => { try { cleaned = cleaned.split(w).join(''); } catch (_) {} });
    cleaned = cleaned.replace(/\band\b/g, ',').replace(/\bwith\b/g, ',').replace(/\s+/g, ' ').trim();
    const parts = cleaned.split(/[,;]/).map(p => p.trim()).filter(p => p.length > 1);
    const items = [];
    for (let part of parts) {
      try {
        const pattern = /^(\d+\.?\d*|a|an|one|two|three|four|five|six|seven|eight|nine|ten|half|quarter|couple)?\s*(g|grams?|kg|kilo|kilograms?|pieces?|cups?|tbsp|tablespoons?|tsp|servings?|plates?|bowls?|slices?)?\s*(?:of\s+)?(.+)$/;
        const match = part.match(pattern);
        if (match) {
          let [, qty, unit, food] = match;
          if (qty) qty = isNaN(qty) ? (WORD_TO_NUM[qty.toLowerCase()] || 1) : parseFloat(qty);
          if (unit) unit = UNIT_MAP[unit.toLowerCase().replace(/s$/, '')] || 'serving';
          if (unit === 'kg' && qty) { qty = qty * 1000; unit = 'g'; }
          food = food?.trim();
          if (food && food.length > 1) items.push({ raw: part, food, quantity: qty || null, unit: unit || null });
        }
      } catch (_) {}
    }
    return items;
  } catch (_) { return []; }
}

function calcMacros(food, quantity, unit) {
  const base = food.serving_size_g || 100;
  const grams = parseFloat(quantity || 1) * (UNIT_TO_GRAMS[unit] || 150);
  const ratio = grams / base;
  return {
    calories: Math.round((food.calories || 0) * ratio),
    protein: Math.round((food.protein || 0) * ratio * 10) / 10,
    carbs: Math.round((food.carbs || 0) * ratio * 10) / 10,
    fats: Math.round((food.fats || 0) * ratio * 10) / 10,
  };
}

function QuantityModal({ visible, food, activeTab, onClose, onAdd, prefillQty, prefillUnit }) {
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('serving');
  useEffect(() => {
    if (food) { setQuantity(prefillQty ? String(prefillQty) : '1'); setUnit(prefillUnit || 'serving'); }
  }, [food, prefillQty, prefillUnit]);
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
            <TouchableOpacity style={m.closeBtn} onPress={onClose}><Text style={m.closeTxt}>✕</Text></TouchableOpacity>
          </View>
          <Text style={m.question}>How much did you eat?</Text>
          <View style={m.amountRow}>
            <TextInput style={m.amountInput} value={quantity} onChangeText={setQuantity} keyboardType="numeric" selectTextOnFocus />
            <Text style={m.amountLabel}>{unit}</Text>
          </View>
          <View style={m.unitsRow}>
            {UNITS.map(u => (
              <TouchableOpacity key={u} style={[m.unitChip, unit === u && m.unitChipActive]} onPress={() => setUnit(u)}>
                <Text style={[m.unitChipTxt, unit === u && m.unitChipTxtActive]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={m.macrosBox}>
            <View style={m.macroItem}><Text style={m.macroVal}>{macros.calories}</Text><Text style={m.macroLabel}>kcal</Text></View>
            <View style={m.macroDivider} />
            <View style={m.macroItem}><Text style={m.macroVal}>{macros.protein}g</Text><Text style={m.macroLabel}>Protein</Text></View>
            <View style={m.macroDivider} />
            <View style={m.macroItem}><Text style={m.macroVal}>{macros.carbs}g</Text><Text style={m.macroLabel}>Carbs</Text></View>
            <View style={m.macroDivider} />
            <View style={m.macroItem}><Text style={m.macroVal}>{macros.fats}g</Text><Text style={m.macroLabel}>Fats</Text></View>
          </View>
          <TouchableOpacity style={m.addBtn} onPress={() => onAdd(food, quantity, unit, macros)} activeOpacity={0.85}>
            <LinearGradient colors={['#E5457A', '#9B4DB5']} style={m.addBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={m.addBtnTxt}>Add to {activeTab} ✓</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function VoiceResultsModal({ visible, items, onClose, onAddItem }) {
  if (!visible || !items.length) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <View style={[m.header, { marginBottom: 4 }]}>
            <Text style={{ fontSize: 24 }}>🎤</Text>
            <View style={{ flex: 1 }}>
              <Text style={m.foodName}>Voice Recognized</Text>
              <Text style={m.foodCat}>{items.length} food item{items.length > 1 ? 's' : ''} found</Text>
            </View>
            <TouchableOpacity style={m.closeBtn} onPress={onClose}><Text style={m.closeTxt}>✕</Text></TouchableOpacity>
          </View>
          {items.map((item, idx) => (
            <View key={idx} style={vr.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={vr.itemName}>{item.dbFood?.name || item.food}</Text>
                {item.quantity
                  ? <Text style={vr.itemQty}>{item.quantity}{item.unit === 'g' ? 'g' : ` ${item.unit || 'serving'}`} · {calcMacros(item.dbFood || { calories: 0, protein: 0, carbs: 0, fats: 0, serving_size_g: 100 }, item.quantity, item.unit || 'serving').calories} kcal</Text>
                  : <Text style={vr.itemQtyNeeded}>⚠️ Quantity not detected</Text>}
              </View>
              <TouchableOpacity style={[vr.addBtn, item.quantity ? vr.addBtnReady : vr.addBtnNeedsQty]} onPress={() => onAddItem(item)}>
                <Text style={vr.addBtnTxt}>{item.quantity ? 'Add ✓' : 'Set qty'}</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={m.addBtn} onPress={onClose}>
            <View style={[m.addBtnGrad, { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={[m.addBtnTxt, { color: colors.textSecondary }]}>Done</Text>
            </View>
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
  const [prefillQty, setPrefillQty] = useState(null);
  const [prefillUnit, setPrefillUnit] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeLang, setActiveLang] = useState('en-US');
  const [voiceText, setVoiceText] = useState('');
  const [voiceItems, setVoiceItems] = useState([]);
  const [showVoiceResults, setShowVoiceResults] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  useEffect(() => { loadToday(); loadPopularFoods(); }, []);

  useEffect(() => {
    if (isListening) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])).start();
    } else { pulseAnim.setValue(1); }
  }, [isListening]);

  const loadToday = async () => {
    try {
      const res = await api.get('/food/today');
      if (res.data?.meals) setFoodItems(res.data.meals);
      if (res.data?.nutrition) setNutrition(prev => ({ ...prev, ...res.data.nutrition }));
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
    if (q.length < 2) { loadPopularFoods(); return; }
    try {
      const res = await fetch(`${BASE}/food/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data?.items || []);
    } catch (_) {}
  };

  const startVoiceRecognition = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('Voice Recognition', 'Supported on Android only.');
      return;
    }
    try {
      setIsListening(true);
      setVoiceText('Listening...');
      const result = await IntentLauncher.startActivityAsync(
        'android.speech.action.RECOGNIZE_SPEECH',
        {
          extra: {
            'android.speech.extra.LANGUAGE_MODEL': 'free_form',
            'android.speech.extra.LANGUAGE': activeLang,
            'android.speech.extra.PROMPT': 'Say a food name...',
            'android.speech.extra.MAX_RESULTS': 1,
          },
        }
      );
      setIsListening(false);
      let spoken = null;
      try {
        const extras = result?.extra || result?.data || {};
        const matches = extras?.['android.speech.extra.RESULTS'];
        if (Array.isArray(matches) && matches[0]) {
          spoken = String(matches[0]);
        }
      } catch (_) {}
      if (spoken) {
        setVoiceText(`"${spoken}"`);
        setSearch(spoken);
        handleSearch(spoken);
      } else {
        setVoiceText('Not recognized. Try again!');
      }
    } catch (_) {
      setIsListening(false);
      setVoiceText('');
    }
  };

  const onSelectFood = (item) => {
    setPrefillQty(null); setPrefillUnit(null);
    setSelectedFood(item); setShowModal(true);
  };

  const onConfirmAdd = async (food, quantity, unit, macros) => {
    setShowModal(false); setSelectedFood(null);
    setPrefillQty(null); setPrefillUnit(null);
    setFoodItems(prev => ({
      ...prev,
      [activeTab]: [...(prev[activeTab] || []),
        { ...food, calories: macros.calories, protein: macros.protein,
          carbs: macros.carbs, fats: macros.fats, quantity: parseFloat(quantity), unit }]
    }));
    setNutrition(n => ({
      ...n,
      calories: (n.calories || 0) + macros.calories,
      protein: Math.round(((n.protein || 0) + macros.protein) * 10) / 10,
      carbs: Math.round(((n.carbs || 0) + macros.carbs) * 10) / 10,
      fats: Math.round(((n.fats || 0) + macros.fats) * 10) / 10,
    }));
    try {
      await api.post('/food/log', {
        meal_type: activeTab, food_name: food.name,
        calories: macros.calories, protein: macros.protein,
        carbs: macros.carbs, fats: macros.fats,
        quantity: parseFloat(quantity), unit,
      });
    } catch (_) {}
  };

  const handleSave = () => Alert.alert('Saved! 🌸', 'Your food log has been saved successfully.');
  const currentMealItems = foodItems[activeTab] || [];
  const calPct = nutrition.goal > 0 ? Math.min((nutrition.calories / nutrition.goal) * 100, 100) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <QuantityModal visible={showModal} food={selectedFood} activeTab={activeTab}
        prefillQty={prefillQty} prefillUnit={prefillUnit}
        onClose={() => { setShowModal(false); setSelectedFood(null); }} onAdd={onConfirmAdd} />
      <VoiceResultsModal visible={showVoiceResults} items={voiceItems}
        onClose={() => setShowVoiceResults(false)} onAddItem={() => {}} />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Food Log</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={s.dateBar}><Text style={s.dateLabel}>Today, {today}</Text></View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.voiceSection}>
          <View style={s.langChips}>
            {LANG_OPTIONS.map(lang => (
              <TouchableOpacity key={lang.code}
                style={[s.langChip, activeLang === lang.code && s.langChipActive]}
                onPress={() => setActiveLang(lang.code)}>
                <Text style={[s.langChipTxt, activeLang === lang.code && s.langChipTxtActive]}>{lang.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity style={[s.micBtn, isListening && s.micBtnActive]}
              onPress={startVoiceRecognition} activeOpacity={0.85} disabled={isListening}>
              <LinearGradient colors={isListening ? ['#FF6B6B', '#E5457A'] : ['#E5457A', '#9B4DB5']}
                style={s.micGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Text style={{ fontSize: 28 }}>{isListening ? '🔴' : '🎤'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
          <Text style={s.micLabel}>{isListening ? 'Listening... speak now!' : 'Tap mic · Say food name'}</Text>
          {voiceText ? <View style={s.voiceResult}><Text style={s.voiceResultTxt}>🎤 {voiceText}</Text></View> : null}
        </View>

        <TextInput style={s.searchInput} placeholder="🔍 Or type food name..."
          placeholderTextColor={colors.textSecondary} value={search} onChangeText={handleSearch} />

        {searchResults.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>{search.length < 2 ? '🔥 Popular Foods' : `🔍 Results for "${search}"`}</Text>
            {searchResults.map((item, idx) => (
              <TouchableOpacity key={idx}
                style={[s.foodResultItem, idx === searchResults.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => onSelectFood(item)}>
                <View style={s.foodResultLeft}>
                  <Text style={s.foodResultName}>{item.name}</Text>
                  <Text style={s.foodResultMeta}>{item.category} · {item.glycemic_index} GI{item.pcos_friendly ? ' · ✅ PCOS' : ''}</Text>
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

        <View style={s.mealTabs}>
          {MEAL_TABS.map(tab => (
            <TouchableOpacity key={tab} style={[s.mealTab, activeTab === tab && s.mealTabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[s.mealTabTxt, activeTab === tab && s.mealTabTxtActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.card}>
          {currentMealItems.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyEmoji}>🍽️</Text>
              <Text style={s.emptyTxt}>Nothing logged for {activeTab.toLowerCase()} yet</Text>
              <Text style={s.emptySub}>Speak or type to add food</Text>
            </View>
          ) : currentMealItems.map((item, idx) => (
            <View key={idx} style={[s.foodItem, idx === currentMealItems.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={s.foodEmoji}>🍽️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.foodName}>{item.name}</Text>
                <Text style={s.foodQty}>{item.quantity}{item.unit === 'g' ? 'g' : ` ${item.unit}`}</Text>
              </View>
              <Text style={s.foodCal}>{item.calories} kcal</Text>
            </View>
          ))}
        </View>

        <Text style={s.sectionTitleLarge}>Daily Summary</Text>
        <View style={[s.card, { gap: 12 }]}>
          <View style={s.calRow}>
            <Text style={s.calNum}>{nutrition.calories} kcal</Text>
            <Text style={s.calGoal}>of {nutrition.goal} goal · {Math.round(calPct)}%</Text>
          </View>
          <View style={s.calBar}>
            <LinearGradient colors={['#E5457A', '#9B4DB5']} style={[s.calFill, { width: `${calPct}%` }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
          </View>
          <View style={s.macroGrid}>
            <View style={s.macroCell}><Text style={s.macroVal}>{nutrition.protein || 0}g</Text><Text style={s.macroLabel}>Protein</Text></View>
            <View style={s.macroCell}><Text style={s.macroVal}>{nutrition.carbs || 0}g</Text><Text style={s.macroLabel}>Carbs</Text></View>
            <View style={[s.macroCell, { borderRightWidth: 0 }]}><Text style={s.macroVal}>{nutrition.fats || 0}g</Text><Text style={s.macroLabel}>Fats</Text></View>
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

const vr = StyleSheet.create({
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  itemQty: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  itemQtyNeeded: { fontSize: 12, color: colors.pink, marginTop: 2, fontWeight: '600' },
  addBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99 },
  addBtnReady: { backgroundColor: colors.lavender },
  addBtnNeedsQty: { backgroundColor: colors.lightPink },
  addBtnTxt: { fontSize: 12, fontWeight: '800', color: colors.purple },
});

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
  voiceSection: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  langChips: { flexDirection: 'row', gap: 8 },
  langChip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.lavender, borderRadius: 99, borderWidth: 1.5, borderColor: 'transparent' },
  langChipActive: { borderColor: colors.purple },
  langChipTxt: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  langChipTxtActive: { color: colors.purple },
  micBtn: { width: 80, height: 80, borderRadius: 40, overflow: 'hidden', elevation: 8 },
  micBtnActive: { elevation: 12 },
  micGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  micLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', textAlign: 'center', paddingHorizontal: 20 },
  voiceResult: { backgroundColor: colors.lavender, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99 },
  voiceResultTxt: { fontSize: 13, color: colors.purple, fontWeight: '700' },
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