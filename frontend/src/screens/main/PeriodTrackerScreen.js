import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../api/api';
import MiniCalendarPicker, { MONTH_NAMES } from '../../components/MiniCalendarPicker';

const SYMPTOMS = ['😣 Cramps', '🤰 Bloating', '😔 Mood', '😴 Fatigue', '🤕 Headache', '🍫 Cravings'];

// 3 phases only — no "Ovulatory" label. A labeled ovulation phase implies
// knowing when ovulation happens, which is exactly the claim this app
// doesn't make (anovulatory cycles are the defining feature of PCOS).
const PHASE_INFO = {
  menstrual: { name: 'Menstrual Phase', color: colors.pink, bg: colors.lightPink, desc: 'Your body is shedding the uterine lining. Rest and warm foods are recommended.', tip: '🍵 Focus: Iron-rich foods, warm herbal teas, gentle movement' },
  follicular: { name: 'Follicular Phase', color: colors.blue, bg: colors.blueBg, desc: 'Estrogen is rising and energy levels build through this phase.', tip: '🥗 Focus: Antioxidant foods, lean protein, leafy greens' },
  luteal: { name: 'Luteal Phase', color: colors.amber, bg: colors.amberBg, desc: 'The back half of your cycle — you may notice some PMS symptoms.', tip: '🍫 Focus: Magnesium-rich foods, complex carbs, reduce caffeine' },
  unknown: { name: 'No Data Yet', color: colors.textSecondary, bg: colors.lavender, desc: 'Log your period to start tracking your cycle phases and get personalized tips.', tip: '👆 Tap two dates on the calendar: start, then end' },
};

function RangeConfirmModal({ visible, title, startLabel, endLabel, duration, onClose, onConfirm, loading, confirmLabel = 'Confirm ✓' }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={dm.overlay}>
        <View style={dm.sheet}>
          <Text style={dm.emoji}>🔴</Text>
          <Text style={dm.title}>{title}</Text>
          <View style={dm.rangeBox}>
            <View style={dm.rangeCol}>
              <Text style={dm.rangeLabel}>START</Text>
              <Text style={dm.rangeVal}>{startLabel}</Text>
            </View>
            <Text style={dm.rangeArrow}>→</Text>
            <View style={dm.rangeCol}>
              <Text style={dm.rangeLabel}>END</Text>
              <Text style={dm.rangeVal}>{endLabel}</Text>
            </View>
          </View>
          <Text style={dm.durationTxt}>{duration} day{duration !== 1 ? 's' : ''} duration</Text>
          <View style={dm.btnRow}>
            <TouchableOpacity style={dm.cancelBtn} onPress={onClose}>
              <Text style={dm.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dm.confirmBtn} onPress={onConfirm} disabled={loading}>
              <LinearGradient colors={['#E5457A', '#9B4DB5']} style={dm.confirmGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={dm.confirmTxt}>{confirmLabel}</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function PeriodTrackerScreen({ navigation }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [periodDays, setPeriodDays] = useState([]);
  const [predictedDays, setPredictedDays] = useState([]);
  const [phase, setPhase] = useState('unknown');
  const [phaseDay, setPhaseDay] = useState(0);
  const [phaseMessage, setPhaseMessage] = useState(null);
  const [isLate, setIsLate] = useState(false);
  const [symptoms, setSymptoms] = useState([]);
  const [predictions, setPredictions] = useState({ nextPeriod: '—', avgCycle: '28d' });
  const [summary, setSummary] = useState({ hasEnoughForPersonalization: false });
  const [regularity, setRegularity] = useState({ status: null, message: '' });
  const [hasAssessment, setHasAssessment] = useState(true); // assume true until checked, so the button doesn't flash in
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const [pendingStart, setPendingStart] = useState(null);
  const [pendingEnd, setPendingEnd] = useState(null);
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);

  useEffect(() => { loadCalendarData(); }, [viewYear, viewMonth]);
  useEffect(() => { refreshAll(); }, []);

  const refreshAll = () => {
    loadCalendarData();
    loadPhaseAndPredictions();
    loadTodaySymptoms();
    loadRegularity();
    loadAssessmentStatus();
    loadHistory();
    loadSummary();
  };

  const loadCalendarData = async () => {
    try {
      const res = await api.get(`/period/calendar?month=${viewMonth}&year=${viewYear}`);
      setPeriodDays(res.data?.periodDays || []);
      setPredictedDays(res.data?.predictedDays || []);
    } catch (_) {}
  };

  const loadPhaseAndPredictions = async () => {
    try {
      const phaseRes = await api.get('/period/phase');
      setPhase(phaseRes.data?.phase_name?.toLowerCase() || 'unknown');
      setPhaseDay(phaseRes.data?.day_of_cycle || 0);
      setPhaseMessage(phaseRes.data?.message || null);
      setIsLate(!!phaseRes.data?.is_late);
    } catch (_) {}
    try {
      const predRes = await api.get('/period/predictions');
      setPredictions({
        nextPeriod: predRes.data?.nextPeriod || '—',
        avgCycle: predRes.data?.avgCycle || '28d',
      });
    } catch (_) {}
  };

  const loadRegularity = async () => {
    try {
      const res = await api.get('/period/regularity');
      setRegularity(res.data || {});
    } catch (_) {}
  };

  const loadSummary = async () => {
    try {
      const res = await api.get('/period/summary');
      setSummary(res.data || {});
    } catch (_) {}
  };

  const loadHistory = async () => {
    try {
      const res = await api.get('/period/history');
      setHistory(res.data?.entries || []);
    } catch (_) {}
  };

  const loadAssessmentStatus = async () => {
    try {
      await api.get('/pcos/risk');
      setHasAssessment(true);
    } catch (err) {
      setHasAssessment(err?.response?.status !== 404);
    }
  };

  const loadTodaySymptoms = async () => {
    try {
      const res = await api.get('/period/symptoms/today');
      setSymptoms(res.data?.symptoms || []);
    } catch (_) {}
  };

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const toggleSymptom = async (sym) => {
    const updated = symptoms.includes(sym) ? symptoms.filter(x => x !== sym) : [...symptoms, sym];
    setSymptoms(updated);
    try { await api.post('/period/symptoms', { symptoms: updated }); } catch (_) {}
  };

  const dateToObj = (day) => new Date(viewYear, viewMonth - 1, day);
  const toISO = (sel) => `${sel.year}-${String(sel.month).padStart(2, '0')}-${String(sel.day).padStart(2, '0')}`;

  const onDayPress = (d) => {
    if (!d) return;
    const tapped = dateToObj(d);

    // A complete pair already selected (fresh, or pre-filled by "Edit")
    // means this tap starts a brand new selection.
    if (!pendingStart || pendingEnd) {
      setPendingStart({ day: d, month: viewMonth, year: viewYear });
      setPendingEnd(null);
      return;
    }

    const startObj = new Date(pendingStart.year, pendingStart.month - 1, pendingStart.day);
    if (tapped < startObj) {
      setPendingStart({ day: d, month: viewMonth, year: viewYear });
      setPendingEnd(null);
      return;
    }

    const diffDays = Math.round((tapped - startObj) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 14) {
      Alert.alert('Too Long', 'Period duration cannot exceed 14 days. Please select a closer end date.');
      return;
    }

    setPendingEnd({ day: d, month: viewMonth, year: viewYear });
    setShowRangeModal(true);
  };

  const cancelSelection = () => {
    setPendingStart(null);
    setPendingEnd(null);
    setShowRangeModal(false);
    setEditingEntryId(null);
  };

  // A 409 overlap response offers extending the conflicting entry instead
  // of failing outright — this is how the server resolves "extend" (no
  // separate endpoint: it's just a normal edit of the existing entry).
  const handleOverlapConflict = (err, attemptedEndDate) => {
    const data = err.response?.data;
    if (err.response?.status !== 409 || !data?.conflict) return false;

    Alert.alert('Period Overlap', data.message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Extend', onPress: async () => {
          try {
            await api.put(`/period/entries/${data.conflict.id}`, { end_date: attemptedEndDate });
            Alert.alert('Extended 🌸', 'Your period entry was extended.');
            refreshAll();
          } catch (e2) {
            Alert.alert('Error', e2.response?.data?.message || 'Could not extend period');
          }
        },
      },
    ]);
    return true;
  };

  const confirmRangeLog = async () => {
    if (!pendingStart || !pendingEnd) return;
    setLoading(true);
    const startStr = toISO(pendingStart);
    const endStr = toISO(pendingEnd);

    try {
      if (editingEntryId) {
        await api.put(`/period/entries/${editingEntryId}`, { start_date: startStr, end_date: endStr });
        Alert.alert('Updated! 🌸', 'Period entry updated.');
      } else {
        await api.post('/period/start', { start_date: startStr, end_date: endStr });
        Alert.alert('Logged! 🌸', 'Period saved.');
      }
      setShowRangeModal(false);
      setPendingStart(null);
      setPendingEnd(null);
      setEditingEntryId(null);
      refreshAll();
    } catch (err) {
      setShowRangeModal(false);
      if (!handleOverlapConflict(err, endStr)) {
        Alert.alert('Error', err.response?.data?.message || 'Could not save period');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartPeriod = async () => {
    setLoading(true);
    try {
      await api.post('/period/start');
      Alert.alert('Period Started 🌸', 'Your period has been logged for today!');
      refreshAll();
    } catch (err) {
      if (!handleOverlapConflict(err, new Date().toISOString().split('T')[0])) {
        Alert.alert('Error', err.response?.data?.message || 'Could not start period');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEndPeriod = async () => {
    setLoading(true);
    try {
      const res = await api.put('/period/end', {});
      Alert.alert('Period Ended 🌸', `Duration: ${res.data?.entry?.duration_days ?? '—'} days`);
      refreshAll();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not end period');
    } finally {
      setLoading(false);
    }
  };

  const startEditingEntry = (entry) => {
    const start = new Date(entry.start_date);
    const end = entry.end_date ? new Date(entry.end_date) : start;
    setEditingEntryId(entry.id);
    setPendingStart({ day: start.getDate(), month: start.getMonth() + 1, year: start.getFullYear() });
    setPendingEnd({ day: end.getDate(), month: end.getMonth() + 1, year: end.getFullYear() });
    setViewMonth(start.getMonth() + 1);
    setViewYear(start.getFullYear());
  };

  const fmtEntryDate = (iso) => {
    const d = new Date(iso);
    return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  };

  const deleteHistoryEntry = (entry) => {
    const label = `${fmtEntryDate(entry.start_date)}${entry.end_date ? ` – ${fmtEntryDate(entry.end_date)}` : ' (ongoing)'}`;
    Alert.alert('Delete this period?', `${label} will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/period/entries/${entry.id}`);
            refreshAll();
          } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Could not delete period');
          }
        },
      },
    ]);
  };

  const phaseInfo = PHASE_INFO[phase] || PHASE_INFO.unknown;

  const getDayStyle = (d) => {
    if (!d) return null;

    if (pendingStart && pendingStart.day === d && pendingStart.month === viewMonth && pendingStart.year === viewYear) {
      return { backgroundColor: colors.pink, borderRadius: 99 };
    }
    if (pendingEnd && pendingEnd.day === d && pendingEnd.month === viewMonth && pendingEnd.year === viewYear) {
      return { backgroundColor: colors.purple, borderRadius: 99 };
    }
    if (pendingStart && !pendingEnd) {
      const startObj = new Date(pendingStart.year, pendingStart.month - 1, pendingStart.day);
      const cellObj = dateToObj(d);
      if (cellObj > startObj && pendingStart.month === viewMonth && pendingStart.year === viewYear) {
        return { backgroundColor: 'rgba(229,69,122,0.12)' };
      }
    }

    if (periodDays.includes(d)) return { backgroundColor: 'rgba(229,69,122,0.25)' };
    if (predictedDays.includes(d)) return { backgroundColor: 'rgba(229,69,122,0.10)', borderWidth: 1, borderColor: 'rgba(229,69,122,0.3)', borderStyle: 'dashed' };
    return null;
  };

  const fmtLabel = (sel) => sel ? `${MONTH_NAMES[sel.month - 1]} ${sel.day}, ${sel.year}` : '';
  const rangeDuration = pendingStart && pendingEnd
    ? Math.round((new Date(pendingEnd.year, pendingEnd.month - 1, pendingEnd.day) - new Date(pendingStart.year, pendingStart.month - 1, pendingStart.day)) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  const isIrregular = regularity.status === 'Irregular';
  const hasRegularityData = regularity.status && regularity.status !== 'Not enough data';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <RangeConfirmModal
        visible={showRangeModal}
        title={editingEntryId ? 'Update This Period?' : 'Log This Period?'}
        confirmLabel={editingEntryId ? 'Save ✓' : 'Confirm ✓'}
        startLabel={fmtLabel(pendingStart)}
        endLabel={fmtLabel(pendingEnd)}
        duration={rangeDuration}
        onClose={() => setShowRangeModal(false)}
        onConfirm={confirmRangeLog}
        loading={loading}
      />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Period Tracker</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Regularity Badge */}
        {hasRegularityData && (
          <View style={[s.regBanner, { backgroundColor: isIrregular ? colors.lightPink : colors.greenBg }]}>
            <Text style={{ fontSize: 18 }}>{isIrregular ? '⚠️' : '✅'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.regTitle, { color: isIrregular ? colors.pink : '#1a8a5c' }]}>
                {isIrregular ? 'Irregular Cycle Detected' : 'Regular Cycle'}
              </Text>
              <Text style={[s.regSub, { color: isIrregular ? colors.pink : '#1a8a5c' }]}>
                {regularity.message}
              </Text>
              {isIrregular && (
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {!hasAssessment && (
                    <TouchableOpacity style={s.gynoBtn} onPress={() => navigation.navigate('Questionnaire')}>
                      <Text style={s.gynoBtnTxt}>📋 Take the PCOS Assessment</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={s.gynoBtn} onPress={() => navigation.navigate('HealthAssistant', { initialTab: 'doctors' })}>
                    <Text style={s.gynoBtnTxt}>👩‍⚕️ Find a Gynecologist</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={s.card}>
          {editingEntryId && (
            <View style={s.editingBanner}>
              <Text style={s.editingTxt}>✏️ Editing {fmtLabel(pendingStart)} – {fmtLabel(pendingEnd)}. Tap new dates, or save as-is.</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity onPress={() => setShowRangeModal(true)}><Text style={s.hintCancelTxt}>Save</Text></TouchableOpacity>
                <TouchableOpacity onPress={cancelSelection}><Text style={s.hintCancelTxt}>Cancel</Text></TouchableOpacity>
              </View>
            </View>
          )}
          <MiniCalendarPicker
            year={viewYear}
            month={viewMonth}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            onDayPress={onDayPress}
            getDayStyle={getDayStyle}
            disableFutureDates
          />

          {pendingStart && !pendingEnd ? (
            <View style={s.hintBoxActive}>
              <Text style={s.hintActiveTxt}>📍 Start: {fmtLabel(pendingStart)} — now tap the end date</Text>
              <TouchableOpacity onPress={cancelSelection}><Text style={s.hintCancelTxt}>Cancel</Text></TouchableOpacity>
            </View>
          ) : (
            !editingEntryId && <Text style={s.tapHint}>💡 Tap a start date, then an end date to log a period</Text>
          )}

          <View style={s.legend}>
            <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: 'rgba(229,69,122,0.25)' }]} /><Text style={s.legendTxt}>Period</Text></View>
            <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: 'rgba(229,69,122,0.10)', borderWidth: 1, borderColor: 'rgba(229,69,122,0.3)' }]} /><Text style={s.legendTxt}>Predicted</Text></View>
            <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: colors.pink, borderRadius: 99 }]} /><Text style={s.legendTxt}>Today</Text></View>
          </View>
        </View>

        <View style={[s.phaseCard, { backgroundColor: phaseInfo.bg }]}>
          <Text style={[s.phaseName, { color: phaseInfo.color }]}>{phaseInfo.name}</Text>
          {phaseDay > 0 && <Text style={[s.phaseDay, { color: phaseInfo.color }]}>Day {phaseDay} of your cycle{isLate ? ' (running long)' : ''}</Text>}
          <Text style={s.phaseDesc}>{phaseMessage || phaseInfo.desc}</Text>
          {!phaseMessage && <Text style={[s.phaseTip, { color: phaseInfo.color }]}>{phaseInfo.tip}</Text>}
        </View>

        <View style={s.actionRow}>
          <TouchableOpacity style={s.startBtn} onPress={handleStartPeriod} disabled={loading}>
            <LinearGradient colors={['#E5457A', '#C73568']} style={s.actionBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.actionBtnTxt}>🔴 Period Started Today</Text>}
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={s.endBtn} onPress={handleEndPeriod} disabled={loading}>
            <Text style={s.endBtnTxt}>⬛ End Period</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.sectionTitle}>Log Symptoms Today</Text>
        <View style={s.symptomWrap}>
          {SYMPTOMS.map(sym => (
            <TouchableOpacity key={sym} style={[s.symptomTag, symptoms.includes(sym) && s.symptomTagActive]} onPress={() => toggleSymptom(sym)}>
              <Text style={[s.symptomTxt, symptoms.includes(sym) && s.symptomTxtActive]}>{sym}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.sectionTitle}>Predictions</Text>
        <View style={s.card}>
          <View style={s.predRow}>
            <View style={s.predCol}>
              <Text style={s.predVal}>{predictions.nextPeriod}</Text>
              <Text style={s.predLabel}>Next Period</Text>
            </View>
            <View style={s.predDivider} />
            <View style={s.predCol}>
              <Text style={s.predVal}>{predictions.avgCycle}</Text>
              <Text style={s.predLabel}>Avg. Cycle</Text>
            </View>
            <View style={s.predDivider} />
            <View style={s.predCol}>
              <Text style={s.predVal}>{summary.cyclesLoggedLast12Months ?? '—'}</Text>
              <Text style={s.predLabel}>Cycles Logged (12mo)</Text>
            </View>
          </View>
        </View>

        <Text style={s.sectionTitle}>Cycle Summary</Text>
        {summary.hasEnoughForPersonalization ? (
          <View style={s.card}>
            <View style={s.summaryGrid}>
              <View style={s.summaryTile}>
                <Text style={s.summaryVal}>{summary.avgIntervalDays}d</Text>
                <Text style={s.summaryLabel}>Avg. Interval</Text>
              </View>
              <View style={s.summaryTile}>
                <Text style={s.summaryVal}>±{summary.varianceDays}d</Text>
                <Text style={s.summaryLabel}>Variance</Text>
              </View>
              <View style={s.summaryTile}>
                <Text style={s.summaryVal}>{summary.cyclesLoggedLast12Months}</Text>
                <Text style={s.summaryLabel}>Cycles (12mo)</Text>
              </View>
              <View style={s.summaryTile}>
                <Text style={s.summaryVal}>{summary.longestGapDays}d</Text>
                <Text style={s.summaryLabel}>Longest Gap</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={s.emptyCard}>
            <Text style={s.emptyTxt}>Log at least 3 periods to see your cycle summary.</Text>
          </View>
        )}

        <Text style={s.sectionTitle}>Cycle History</Text>
        {history.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyTxt}>No periods logged yet — tap a date above to get started.</Text>
          </View>
        ) : (
          <View style={s.card}>
            {history.map((entry, i) => (
              <View key={entry.id} style={[s.historyRow, i === history.length - 1 && s.historyRowLast]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.historyDates}>
                    {fmtEntryDate(entry.start_date)}{entry.end_date ? ` – ${fmtEntryDate(entry.end_date)}` : ' (ongoing)'}
                    {entry.is_estimated ? <Text style={s.historyEstimated}>  · estimated</Text> : null}
                  </Text>
                  <Text style={s.historySub}>
                    {entry.duration_days ? `${entry.duration_days} day bleed` : 'Not yet ended'}
                    {entry.interval_to_next_days ? ` · ${entry.interval_to_next_days}d to next` : ''}
                  </Text>
                </View>
                <TouchableOpacity style={s.historyIconBtn} onPress={() => startEditingEntry(entry)}>
                  <Text style={s.historyIconTxt}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.historyIconBtn} onPress={() => deleteHistoryEntry(entry)}>
                  <Text style={s.historyIconTxt}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const dm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: colors.surface, borderRadius: 24, padding: 24, width: '100%', alignItems: 'center', gap: 8 },
  emoji: { fontSize: 36 },
  title: { fontSize: 17, fontWeight: '900', color: colors.textPrimary },
  rangeBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.lavender, borderRadius: 16, padding: 14, marginTop: 8, width: '100%', justifyContent: 'center' },
  rangeCol: { alignItems: 'center', gap: 2 },
  rangeLabel: { fontSize: 9, fontWeight: '800', color: colors.purple, letterSpacing: 1 },
  rangeVal: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  rangeArrow: { fontSize: 18, color: colors.purple },
  durationTxt: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginTop: 4, marginBottom: 4 },
  btnRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: colors.border },
  cancelTxt: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  confirmBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  confirmGrad: { paddingVertical: 14, alignItems: 'center', borderRadius: 14 },
  confirmTxt: { fontSize: 13, fontWeight: '800', color: '#fff' },
});

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingHorizontal: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: colors.purple, fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  scroll: { padding: 16, gap: 12 },
  regBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 16 },
  regTitle: { fontSize: 13, fontWeight: '800' },
  regSub: { fontSize: 11, marginTop: 3, lineHeight: 16 },
  gynoBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: colors.pink, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99 },
  gynoBtnTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border },
  editingBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.lavender, borderRadius: 12, padding: 10, marginBottom: 10, gap: 8 },
  editingTxt: { fontSize: 11, color: colors.purple, fontWeight: '700', flex: 1 },
  tapHint: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
  hintBoxActive: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.lightPink, borderRadius: 12, padding: 10, marginTop: 8 },
  hintActiveTxt: { fontSize: 11, color: colors.pink, fontWeight: '700', flex: 1 },
  hintCancelTxt: { fontSize: 11, color: colors.pink, fontWeight: '900', textDecorationLine: 'underline' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendTxt: { fontSize: 10, color: colors.textSecondary, fontWeight: '700' },
  phaseCard: { borderRadius: 20, padding: 16, gap: 8 },
  phaseName: { fontSize: 17, fontWeight: '900' },
  phaseDay: { fontSize: 12, fontWeight: '700' },
  phaseDesc: { fontSize: 13, color: colors.textPrimary, lineHeight: 20 },
  phaseTip: { fontSize: 12, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8 },
  startBtn: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  actionBtnGrad: { paddingVertical: 14, alignItems: 'center', borderRadius: 16 },
  actionBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  endBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  endBtnTxt: { fontWeight: '800', fontSize: 13, color: colors.textPrimary },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  symptomWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  symptomTag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  symptomTagActive: { backgroundColor: colors.lightPink, borderColor: colors.pink },
  symptomTxt: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  symptomTxtActive: { color: colors.pink },
  predRow: { flexDirection: 'row', alignItems: 'center' },
  predCol: { flex: 1, alignItems: 'center', gap: 4 },
  predDivider: { width: 1, height: 40, backgroundColor: colors.border },
  predVal: { fontSize: 15, fontWeight: '900', color: colors.textPrimary },
  predLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summaryTile: { width: '45%', alignItems: 'center', gap: 4, paddingVertical: 8 },
  summaryVal: { fontSize: 17, fontWeight: '900', color: colors.textPrimary },
  summaryLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '700', textAlign: 'center' },
  emptyCard: { backgroundColor: colors.lavender, borderRadius: 16, padding: 16, alignItems: 'center' },
  emptyTxt: { fontSize: 12, color: colors.purple, fontWeight: '600', textAlign: 'center' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyRowLast: { borderBottomWidth: 0 },
  historyDates: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  historyEstimated: { fontSize: 10, fontWeight: '600', color: colors.textSecondary, fontStyle: 'italic' },
  historySub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  historyIconBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  historyIconTxt: { fontSize: 14 },
});
