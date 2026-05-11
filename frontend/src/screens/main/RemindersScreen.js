import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';

const DEFAULT_REMINDERS = {
  meal: [
    { id: 'breakfast', emoji: '☀️', title: 'Breakfast Reminder', sub: '8:00 AM daily', enabled: true },
    { id: 'lunch', emoji: '🌤️', title: 'Lunch Reminder', sub: '12:30 PM daily', enabled: true },
    { id: 'dinner', emoji: '🌙', title: 'Dinner Reminder', sub: '7:00 PM daily', enabled: false },
  ],
  period: [
    { id: 'period_3days', emoji: '📅', title: '3 days before period', sub: 'Advance warning', enabled: true },
    { id: 'period_today', emoji: '🔔', title: 'Period expected today', sub: 'Day-of alert', enabled: true },
  ],
  health: [
    { id: 'monthly_assess', emoji: '📊', title: 'Monthly PCOS Assessment', sub: '1st of each month', enabled: true },
  ],
  bmi: [
    { id: 'weight', emoji: '⚖️', title: 'Weight Update', sub: 'Monthly · Next: Jun 1', enabled: true },
    { id: 'height', emoji: '📏', title: 'Height Update', sub: 'Every 3 months · Next: Aug 1', enabled: false },
  ],
};

function ReminderSection({ title, items, onToggle }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {items.map((item, i) => (
        <View key={item.id} style={s.reminderItem}>
          <Text style={s.reminderEmoji}>{item.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.reminderTitle}>{item.title}</Text>
            <Text style={s.reminderSub}>{item.sub}</Text>
          </View>
          <Switch
            value={item.enabled}
            onValueChange={(v) => onToggle(item.id, v)}
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
  const [appointments, setAppointments] = useState([
    { id: 1, emoji: '🏥', title: 'Dr. Priya Fernando', sub: 'May 12, 2026 · 10:00 AM · Nawaloka' },
  ]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/reminders');
        if (res.data?.reminders) setReminders(res.data.reminders);
        if (res.data?.appointments) setAppointments(res.data.appointments);
      } catch (_) {}
    };
    load();
  }, []);

  const toggleReminder = async (id, val) => {
    setReminders(prev => {
      const updated = { ...prev };
      for (const cat in updated) {
        updated[cat] = updated[cat].map(r => r.id === id ? { ...r, enabled: val } : r);
      }
      return updated;
    });
    try {
      await api.put(`/reminders/${id}`, { enabled: val });
    } catch (_) {}
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
        <ReminderSection title="🍽️ Meal Log Reminders" items={reminders.meal} onToggle={toggleReminder} />
        <ReminderSection title="🔴 Period Reminders" items={reminders.period} onToggle={toggleReminder} />
        <ReminderSection title="📋 Health Assessment" items={reminders.health} onToggle={toggleReminder} />
        <ReminderSection title="⚖️ BMI Updates" items={reminders.bmi} onToggle={toggleReminder} />

        {/* Doctor Appointments */}
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
          <TouchableOpacity
            style={s.addApptBtn}
            onPress={() => Alert.alert('Add Appointment', 'Appointment booking coming soon!')}
          >
            <Text style={s.addApptTxt}>+ Add Doctor Appointment</Text>
          </TouchableOpacity>
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
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: colors.purple, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, paddingHorizontal: 4 },
  reminderItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 8 },
  reminderEmoji: { fontSize: 20, width: 40, textAlign: 'center' },
  reminderTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  reminderSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  addApptBtn: { width: '100%', marginTop: 8, padding: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 16, alignItems: 'center' },
  addApptTxt: { color: colors.purple, fontSize: 13, fontWeight: '800' },
});
