import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const DEFAULT_REMINDERS = {
  meal: [
    { id: 'breakfast', emoji: '☀️', title: 'Breakfast Reminder', sub: '8:00 AM daily', enabled: true, hour: 8, minute: 0 },
    { id: 'lunch', emoji: '🌤️', title: 'Lunch Reminder', sub: '12:30 PM daily', enabled: true, hour: 12, minute: 30 },
    { id: 'dinner', emoji: '🌙', title: 'Dinner Reminder', sub: '7:00 PM daily', enabled: false, hour: 19, minute: 0 },
  ],
  period: [
    { id: 'period_3days', emoji: '📅', title: '3 days before period', sub: 'Advance warning', enabled: true, hour: 9, minute: 0 },
    { id: 'period_today', emoji: '🔔', title: 'Period expected today', sub: 'Day-of alert', enabled: true, hour: 8, minute: 0 },
  ],
  health: [
    { id: 'monthly_assess', emoji: '📊', title: 'Monthly PCOS Assessment', sub: '1st of each month', enabled: true, hour: 10, minute: 0 },
  ],
  bmi: [
    { id: 'weight', emoji: '⚖️', title: 'Weight Update', sub: 'Monthly reminder', enabled: true, hour: 9, minute: 0 },
    { id: 'height', emoji: '📏', title: 'Height Update', sub: 'Every 3 months', enabled: false, hour: 9, minute: 0 },
  ],
};

const NOTIFICATION_CONTENT = {
  breakfast: { title: '☀️ Breakfast Time!', body: 'Log your breakfast to track your PCOS nutrition journey 🌸' },
  lunch: { title: '🌤️ Lunch Time!', body: 'Don\'t forget to log your lunch. Stay on track! 🌸' },
  dinner: { title: '🌙 Dinner Time!', body: 'Log your dinner to complete today\'s food log 🌸' },
  period_3days: { title: '📅 Period Coming Soon', body: 'Your period is expected in 3 days. Prepare and stay comfortable 🌸' },
  period_today: { title: '🔔 Period Expected Today', body: 'Your period may start today. Take care of yourself 🌸' },
  monthly_assess: { title: '📊 Monthly Check-in', body: 'Time for your monthly PCOS assessment 🌸' },
  weight: { title: '⚖️ Weight Update Reminder', body: 'Please update your weight to track your BMI progress 🌸' },
  height: { title: '📏 Height Update Reminder', body: 'Time to update your height measurement 🌸' },
};

async function requestPermissions() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (_) { return false; }
}

async function scheduleReminder(id, hour, minute) {
  try {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    const content = NOTIFICATION_CONTENT[id] || {
      title: '🌸 Cycle Ella Reminder',
      body: 'Time for your health check-in!',
    };
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { ...content, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  } catch (_) {}
}

async function cancelReminder(id) {
  try { await Notifications.cancelScheduledNotificationAsync(id); } catch (_) {}
}

function ReminderSection({ title, items, onToggle }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {items.map((item) => (
        <View key={item.id} style={s.reminderItem}>
          <Text style={s.reminderEmoji}>{item.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.reminderTitle}>{item.title}</Text>
            <Text style={s.reminderSub}>{item.sub}</Text>
          </View>
          <Switch
            value={item.enabled}
            onValueChange={(v) => onToggle(item.id, v, item.hour, item.minute)}
            thumbColor={item.enabled ? '#fff' : '#ccc'}
            trackColor={{ false: colors.border, true: colors.pink }}
          />
        </View>
      ))}
    </View>
  );
}

export default function RemindersScreen({ navigation }) {
  const [reminders, setReminders] = useState(DEFAULT_REMINDERS);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [appointments] = useState([
    { id: 1, emoji: '🏥', title: 'Dr. Priya Fernando', sub: 'May 12, 2026 · 10:00 AM · Nawaloka' },
  ]);

  useEffect(() => {
    setupNotifications();
  }, []);

  const setupNotifications = async () => {
    const granted = await requestPermissions();
    setPermissionGranted(granted);
    if (!granted) return;
    for (const category of Object.values(DEFAULT_REMINDERS)) {
      for (const reminder of category) {
        if (reminder.enabled) {
          await scheduleReminder(reminder.id, reminder.hour, reminder.minute);
        }
      }
    }
  };

  const toggleReminder = async (id, val, hour, minute) => {
    setReminders(prev => {
      const updated = { ...prev };
      for (const cat in updated) {
        updated[cat] = updated[cat].map(r => r.id === id ? { ...r, enabled: val } : r);
      }
      return updated;
    });
    if (val) {
      await scheduleReminder(id, hour, minute);
    } else {
      await cancelReminder(id);
    }
    try { await api.put(`/reminders/${id}`, { enabled: val }); } catch (_) {}
  };

  const sendTestNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌸 Cycle Ella Test',
          body: 'Notifications are working perfectly!',
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 3,
          repeats: false,
        },
      });
      Alert.alert('Test Sent! 🌸', 'You will receive a notification in 3 seconds!');
    } catch (_) {
      Alert.alert('Note 🌸', 'Push notifications work in the APK build. Build the APK to test fully!');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Smart Reminders</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={[s.permBanner, { backgroundColor: permissionGranted ? colors.greenBg : colors.lightPink }]}>
          <Text style={{ fontSize: 16 }}>{permissionGranted ? '✅' : '⚠️'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.permTitle, { color: permissionGranted ? '#1a8a5c' : colors.pink }]}>
              {permissionGranted ? 'Notifications Active' : 'Notifications Disabled'}
            </Text>
            <Text style={[s.permSub, { color: permissionGranted ? '#1a8a5c' : colors.pink }]}>
              {permissionGranted ? 'You will receive reminders on time' : 'Enable in phone settings'}
            </Text>
          </View>
          <TouchableOpacity style={s.testBtn} onPress={sendTestNotification}>
            <Text style={s.testBtnTxt}>Test 🔔</Text>
          </TouchableOpacity>
        </View>

        <ReminderSection title="🍽️ Meal Log Reminders" items={reminders.meal} onToggle={toggleReminder} />
        <ReminderSection title="🔴 Period Reminders" items={reminders.period} onToggle={toggleReminder} />
        <ReminderSection title="📋 Health Assessment" items={reminders.health} onToggle={toggleReminder} />
        <ReminderSection title="⚖️ BMI Updates" items={reminders.bmi} onToggle={toggleReminder} />

        <View style={s.section}>
          <Text style={s.sectionTitle}>👩‍⚕️ Doctor Appointments</Text>
          {appointments.map(appt => (
            <TouchableOpacity key={appt.id} style={s.reminderItem}>
              <Text style={s.reminderEmoji}>{appt.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.reminderTitle}>{appt.title}</Text>
                <Text style={s.reminderSub}>{appt.sub}</Text>
              </View>
              <Text style={{ fontSize: 18, color: colors.textSecondary }}>›</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={s.addApptBtn}
            onPress={() => Alert.alert('Coming Soon 🌸', 'Doctor appointment booking coming soon!')}>
            <Text style={s.addApptTxt}>+ Add Doctor Appointment</Text>
          </TouchableOpacity>
        </View>

        <View style={s.noteBox}>
          <Text style={s.noteTxt}>💡 Note: Push notifications work fully in the APK build. Toggle reminders to schedule them!</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingHorizontal: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: colors.purple, fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  scroll: { padding: 16, gap: 4 },
  permBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, marginBottom: 16 },
  permTitle: { fontSize: 13, fontWeight: '800' },
  permSub: { fontSize: 11, marginTop: 2 },
  testBtn: { backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  testBtnTxt: { fontSize: 11, fontWeight: '800', color: colors.purple },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: colors.purple, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, paddingHorizontal: 4 },
  reminderItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 8 },
  reminderEmoji: { fontSize: 20, width: 40, textAlign: 'center' },
  reminderTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  reminderSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  addApptBtn: { width: '100%', marginTop: 8, padding: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 16, alignItems: 'center' },
  addApptTxt: { color: colors.purple, fontSize: 13, fontWeight: '800' },
  noteBox: { backgroundColor: colors.lavender, padding: 14, borderRadius: 16, marginBottom: 20 },
  noteTxt: { fontSize: 12, color: colors.purple, fontWeight: '600', lineHeight: 18 },
});