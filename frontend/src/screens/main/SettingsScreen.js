import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import useStore from '../../store/useStore';

const SETTINGS_SECTIONS = [
  {
    title: 'Account',
    items: [
      { icon: '👤', label: 'Edit Profile', sub: 'Update your personal info', color: colors.lavender, screen: 'EditProfile' },
      { icon: '🏥', label: 'Health Profile', sub: 'Conditions, preferences', color: colors.lightPink, screen: 'HealthProfile' },
      { icon: '📏', label: 'BMI & Measurements', sub: 'Weight, height tracker', color: colors.amberBg, screen: 'BMI' },
    ]
  },
  {
    title: 'Features',
    items: [
      { icon: '🔔', label: 'Reminders', sub: 'Manage your alerts', color: colors.lavender, screen: 'Reminders' },
      { icon: '📊', label: 'Reports', sub: 'View your health reports', color: colors.lightPink, screen: 'Reports' },
      { icon: '📈', label: 'Progress', sub: 'Track your improvements', color: colors.amberBg, screen: 'Progress' },
      { icon: '👩‍⚕️', label: 'Gyno Directory', sub: 'Find PCOS specialists', color: colors.greenBg, screen: 'HealthAssistant', params: { initialTab: 'doctors' } },
      { icon: '💬', label: 'FAQ Chatbot', sub: 'Ask PCOS questions', color: colors.blueBg, screen: 'HealthAssistant', params: { initialTab: 'chat' } },
    ]
  },
  {
    title: 'Preferences',
    items: [
      { icon: '🌐', label: 'Language', sub: 'English', color: colors.lavender },
      { icon: '🎨', label: 'Appearance', sub: 'Light mode', color: colors.lightPink },
    ]
  },
  {
    title: 'Support',
    items: [
      { icon: '🔒', label: 'Privacy & Security', sub: 'Data and password', color: colors.lavender },
      { icon: '⭐', label: 'Rate the App', sub: 'Share your feedback', color: colors.amberBg },
      { icon: 'ℹ️', label: 'About Cycle Ella', sub: 'Version 1.0.0', color: colors.lightPink },
    ]
  }
];

export default function SettingsScreen({ navigation }) {
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'CE';

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.replace('Splash');
          }
        },
      ]
    );
  };

  const handlePress = (item) => {
    if (item.screen) {
      navigation.navigate(item.screen, item.params);
    } else {
      Alert.alert(item.label, `${item.label} coming soon! 🌸`);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* Profile Header */}
      <LinearGradient
        colors={['#E5457A', '#9B4DB5']}
        style={s.profileHeader}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{user?.full_name || 'Cycle Ella User'}</Text>
          <Text style={s.email}>{user?.email || ''}</Text>
        </View>
        <TouchableOpacity
          style={s.editBtn}
          onPress={() => navigation.navigate('HealthProfile')}
        >
          <Text style={s.editBtnTxt}>Edit</Text>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        style={s.body}
        contentContainerStyle={s.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {SETTINGS_SECTIONS.map((section, si) => (
          <View key={si} style={s.sectionWrap}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <View style={s.section}>
              {section.items.map((item, ii) => (
                <TouchableOpacity
                  key={ii}
                  style={[s.row, ii === section.items.length - 1 && s.rowLast]}
                  onPress={() => handlePress(item)}
                  activeOpacity={0.7}
                >
                  <View style={[s.rowIcon, { backgroundColor: item.color }]}>
                    <Text style={{ fontSize: 16 }}>{item.icon}</Text>
                  </View>
                  <View style={s.rowInfo}>
                    <Text style={s.rowTitle}>{item.label}</Text>
                    <Text style={s.rowSub}>{item.sub}</Text>
                  </View>
                  <Text style={s.rowChevron}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutTxt}>🚪 Sign Out</Text>
        </TouchableOpacity>

        <Text style={s.versionTxt}>Cycle Ella v1.0.0 🌸</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  profileHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarTxt: { fontSize: 24, fontWeight: '900', color: '#fff' },
  name: { fontSize: 17, fontWeight: '900', color: '#fff' },
  email: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  editBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12
  },
  editBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  body: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -24
  },
  bodyContent: { padding: 20, paddingTop: 28, gap: 8, paddingBottom: 32 },
  sectionWrap: { gap: 8, marginBottom: 8 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 4
  },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    overflow: 'hidden'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  rowSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  rowChevron: { fontSize: 18, color: colors.textSecondary },
  logoutBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: colors.lightPink,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(229,69,122,0.2)',
    marginTop: 8
  },
  logoutTxt: { color: colors.pink, fontSize: 15, fontWeight: '800' },
  versionTxt: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: 12
  },
});