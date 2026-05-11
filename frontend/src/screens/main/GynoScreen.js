import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

const DEFAULT_DOCTORS = [
  { id: 1, initials: 'P', gradColors: ['#E5457A', '#9B4DB5'], name: 'Dr. Priya Fernando', spec: 'Gynecologist & Obstetrician', hospital: 'Nawaloka Hospital, Colombo 2', district: 'Colombo', fee: 'Rs. 1,500', type: 'Private', phone: '+94112544744' },
  { id: 2, initials: 'S', gradColors: ['#9B4DB5', '#E5457A'], name: 'Dr. Sandya Kumari', spec: 'Reproductive Endocrinologist', hospital: 'Lanka Hospital, Colombo 5', district: 'Colombo', fee: 'Rs. 2,000', type: 'Private', phone: '+94112554411' },
  { id: 3, initials: 'A', gradColors: ['#E5457A', '#F5A623'], name: 'Dr. Amara Jayasinghe', spec: 'Gynecologist', hospital: 'National Hospital of Sri Lanka', district: 'Colombo', fee: 'Free', type: 'Government', phone: '+94112691111' },
];

function DoctorCard({ doc }) {
  const handleCall = () => {
    if (doc.phone) Linking.openURL(`tel:${doc.phone}`);
    else Alert.alert('Call', `Calling ${doc.name}...`);
  };
  const handleMap = () => Alert.alert('Directions', `Opening map for ${doc.hospital}`);

  return (
    <View style={s.docCard}>
      <View style={s.docTop}>
        <LinearGradient colors={doc.gradColors} style={s.docAvatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={s.docInitials}>{doc.initials}</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={s.docName}>{doc.name}</Text>
          <Text style={s.docSpec}>{doc.spec}</Text>
          <Text style={s.docHospital}>{doc.hospital}</Text>
        </View>
      </View>
      <View style={s.docBadges}>
        <View style={[s.badge, { backgroundColor: colors.lavender }]}>
          <Text style={[s.badgeTxt, { color: colors.purple }]}>📍 {doc.district}</Text>
        </View>
        <View style={[s.badge, { backgroundColor: doc.type === 'Government' ? colors.blueBg : colors.greenBg }]}>
          <Text style={[s.badgeTxt, { color: doc.type === 'Government' ? '#1565c0' : '#1a8a5c' }]}>
            {doc.type === 'Government' ? '🏥' : '💰'} {doc.fee}
          </Text>
        </View>
      </View>
      <View style={s.docActions}>
        <TouchableOpacity style={[s.docBtn, s.callBtn]} onPress={handleCall}>
          <Text style={[s.docBtnTxt, { color: colors.pink }]}>📞 Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.docBtn, s.mapBtn]} onPress={handleMap}>
          <Text style={[s.docBtnTxt, { color: colors.purple }]}>🗺️ Directions</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function GynoScreen({ navigation }) {
  const [search, setSearch] = useState('');
  const [district, setDistrict] = useState('Colombo');
  const [doctors, setDoctors] = useState(DEFAULT_DOCTORS);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/gyno');
        if (res.data?.length) setDoctors(res.data);
      } catch (_) {}
    };
    load();
  }, []);

  const filtered = doctors.filter(d =>
    (d.name.toLowerCase().includes(search.toLowerCase()) || d.hospital.toLowerCase().includes(search.toLowerCase())) &&
    (district === 'All' || d.district === district)
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Gynecologist Directory</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.searchRow}>
          <TextInput
            style={s.searchInput}
            placeholder="🔍 Search doctor or hospital..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          <View style={s.filterPicker}>
            {['All', 'Colombo', 'Kandy'].map(d => (
              <TouchableOpacity key={d} style={[s.filterBtn, district === d && s.filterBtnActive]} onPress={() => setDistrict(d)}>
                <Text style={[s.filterTxt, district === d && s.filterTxtActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {filtered.length === 0 ? (
          <Text style={s.emptyTxt}>No doctors found matching your search.</Text>
        ) : filtered.map(doc => <DoctorCard key={doc.id} doc={doc} />)}
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
  searchRow: { gap: 8 },
  searchInput: { padding: 14, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, fontSize: 14, color: colors.textPrimary },
  filterPicker: { flexDirection: 'row', gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  filterBtnActive: { backgroundColor: colors.lavender, borderColor: colors.purple },
  filterTxt: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  filterTxtActive: { color: colors.purple },
  docCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 16, gap: 12 },
  docTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  docAvatar: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  docInitials: { fontSize: 20, fontWeight: '900', color: '#fff' },
  docName: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  docSpec: { fontSize: 11, fontWeight: '700', color: colors.purple, marginTop: 2 },
  docHospital: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  docBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  docActions: { flexDirection: 'row', gap: 8 },
  docBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  callBtn: { borderColor: colors.pink, backgroundColor: colors.lightPink },
  mapBtn: { borderColor: colors.purple, backgroundColor: colors.lavender },
  docBtnTxt: { fontSize: 12, fontWeight: '800' },
  emptyTxt: { textAlign: 'center', color: colors.textSecondary, fontSize: 13, padding: 24 },
});
