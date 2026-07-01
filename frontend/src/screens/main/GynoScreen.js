import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

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
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Call', `Please dial: ${phone}`);
        }
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
        if (supported) {
          Linking.openURL(url);
        } else {
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

export default function GynoScreen({ navigation }) {
  const [search, setSearch] = useState('');
  const [district, setDistrict] = useState('All');
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/gyno');
        if (Array.isArray(res.data) && res.data.length > 0) {
          setDoctors(res.data);
        }
      } catch (_) {}
      setLoading(false);
    };
    load();
  }, []);

  const filtered = doctors.filter(d => {
    if (!d) return false;
    const name = (d.name || '').toLowerCase();
    const hospital = (d.hospital || '').toLowerCase();
    const searchLower = search.toLowerCase();
    const matchesSearch = search.length < 2 || name.includes(searchLower) || hospital.includes(searchLower);
    const matchesDistrict = district === 'All' || d.district === district;
    return matchesSearch && matchesDistrict;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Gynecologist Directory</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        <TextInput
          style={s.searchInput}
          placeholder="🔍 Search doctor or hospital..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.filterScroll}
          contentContainerStyle={s.filterPicker}>
          {DISTRICTS.map(d => (
            <TouchableOpacity
              key={d}
              style={[s.filterBtn, district === d && s.filterBtnActive]}
              onPress={() => setDistrict(d)}>
              <Text style={[s.filterTxt, district === d && s.filterTxtActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <Text style={s.emptyTxt}>Loading doctors...</Text>
        ) : filtered.length === 0 ? (
          <Text style={s.emptyTxt}>No doctors found matching your search.</Text>
        ) : (
          <>
            <Text style={s.resultCount}>
              {filtered.length} doctor{filtered.length !== 1 ? 's' : ''} found
              {district !== 'All' ? ` in ${district}` : ''}
            </Text>
            {filtered.map((doc, idx) => (
              <DoctorCard key={doc?.id || idx} doc={doc} idx={idx} />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingHorizontal: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: colors.purple, fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.textPrimary },
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