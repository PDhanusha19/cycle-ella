const db = require('../config/db');
const C = require('../utils/cycleCalculations');

// ── Helpers ───────────────────────────────────────────

// All reads/writes go through this — deleted_at IS NULL is the one thing
// every query in this file must never forget.
function fetchActiveEntries(user_id, callback) {
  db.query(
    'SELECT * FROM period_logs WHERE user_id = ? AND deleted_at IS NULL AND start_date IS NOT NULL ORDER BY start_date ASC',
    [user_id],
    callback
  );
}

function getOverlapDays(startDateStr, duration, year, month) {
  const days = [];
  for (let i = 0; i < (duration || 5); i++) {
    const d = C.addDays(startDateStr, i);
    if (d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month) {
      days.push(d.getUTCDate());
    }
  }
  return days;
}

const todayISO = () => new Date().toISOString().split('T')[0];

function computeDuration(start, end) {
  return Math.max(1, C.daysBetween(start, end) + 1);
}

// Finds a period_logs row (excluding excludeId, if given) whose
// [start_date, end_date || start_date] range overlaps [candStart, candEnd].
// An open entry (end_date IS NULL) is treated as ongoing indefinitely.
function findOverlap(user_id, candStart, candEnd, excludeId, callback) {
  const params = [user_id, candEnd, candStart];
  let sql = `SELECT id, start_date, end_date FROM period_logs
             WHERE user_id = ? AND deleted_at IS NULL
               AND start_date <= ?
               AND (end_date IS NULL OR end_date >= ?)`;
  if (excludeId) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }
  sql += ' LIMIT 1';
  db.query(sql, params, (err, results) => {
    if (err) return callback(err);
    callback(null, results[0] || null);
  });
}

function conflictPayload(conflict) {
  return {
    message: `This overlaps your period logged ${C.fmtShort(conflict.start_date)}${conflict.end_date ? `–${C.fmtShort(conflict.end_date)}` : ' (ongoing)'}.`,
    conflict: { id: conflict.id, start_date: C.isoDate(conflict.start_date), end_date: conflict.end_date ? C.isoDate(conflict.end_date) : null },
    canExtend: true,
  };
}

// ── SAVE PERIOD HISTORY (onboarding backdating) ───────
// Real dates now, not month/year guesses. Atomic: rejects the whole
// batch on any future date or internal overlap rather than partially
// saving. Refuses to wipe real tracked data if the user already has any
// (today's version unconditionally deletes everything on every submit).
const savePeriodHistory = (req, res) => {
  const user_id = req.user.id;
  const { periods } = req.body || {};

  if (!Array.isArray(periods) || periods.length === 0) {
    return res.status(400).json({ message: 'No period data provided' });
  }

  const today = todayISO();
  const invalidEntries = [];
  periods.forEach((p, index) => {
    if (!p.start_date) invalidEntries.push({ index, reason: 'Missing start date' });
    else if (p.start_date > today) invalidEntries.push({ index, reason: 'Start date is in the future' });
  });
  // Internal overlap check within the submitted batch itself
  const sorted = [...periods].map((p, index) => ({ ...p, index })).sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (!prev.start_date || !cur.start_date) continue;
    const prevEnd = prev.end_date || (prev.duration_days ? C.isoDate(C.addDays(prev.start_date, prev.duration_days - 1)) : prev.start_date);
    if (cur.start_date <= prevEnd) {
      invalidEntries.push({ index: cur.index, reason: 'Overlaps another period in this batch' });
    }
  }

  if (invalidEntries.length > 0) {
    return res.status(400).json({ message: "Some periods couldn't be saved", invalidEntries });
  }

  db.query(
    'SELECT COUNT(*) as cnt FROM period_logs WHERE user_id = ? AND deleted_at IS NULL AND (is_estimated = FALSE OR is_estimated IS NULL)',
    [user_id],
    (err, countRows) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err.message });

      if (countRows[0].cnt > 0) {
        return res.status(400).json({
          message: 'You already have tracked periods logged — edit them from the Period Tracker instead of re-submitting your history.',
        });
      }

      db.query(
        'UPDATE period_logs SET deleted_at = NOW() WHERE user_id = ? AND deleted_at IS NULL',
        [user_id],
        (err2) => {
          if (err2) return res.status(500).json({ message: 'Database error', error: err2.message });

          let inserted = 0;
          const insertedEntries = [];
          periods.forEach((p) => {
            const d = C.toDate(p.start_date);
            const month = d.getUTCMonth() + 1;
            const year = d.getUTCFullYear();
            const duration = p.duration_days || 5;
            const end_date = C.isoDate(C.addDays(p.start_date, duration - 1));

            db.query(
              `INSERT INTO period_logs (user_id, month, year, start_date, end_date, duration_days, is_estimated)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [user_id, month, year, p.start_date, end_date, duration, !!p.is_estimated],
              (err3, result) => {
                if (err3) return res.status(500).json({ message: 'Error saving period', error: err3.message });
                insertedEntries.push({ id: result.insertId, start_date: p.start_date, end_date, duration_days: duration });
                inserted++;

                if (inserted === periods.length) {
                  fetchActiveEntries(user_id, (err4, entries) => {
                    if (err4) return res.status(500).json({ message: 'Database error' });
                    const stats = C.computeCycleStats(entries);
                    res.status(201).json({
                      message: 'Period history saved! 🌸',
                      entries: insertedEntries,
                      regularity_status: C.regularityStatus(stats),
                    });
                  });
                }
              }
            );
          });
        }
      );
    }
  );
};

// ── LOG PERIOD START (calendar tap or one-tap button) ──
const logPeriodStart = (req, res) => {
  const user_id = req.user.id;
  const { start_date, end_date, duration_days } = req.body || {};
  const dateToUse = start_date || todayISO();

  if (dateToUse > todayISO()) {
    return res.status(400).json({ message: 'Cannot log a period start in the future.' });
  }

  let finalEndDate = end_date || null;
  let finalDuration = duration_days || null;
  if (finalEndDate && !finalDuration) finalDuration = computeDuration(dateToUse, finalEndDate);
  if (finalEndDate && finalEndDate < dateToUse) {
    return res.status(400).json({ message: 'End date cannot be before the start date.' });
  }
  if (finalEndDate && finalEndDate > todayISO()) {
    return res.status(400).json({ message: 'End date cannot be in the future.' });
  }

  findOverlap(user_id, dateToUse, finalEndDate || dateToUse, null, (err, conflict) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    if (conflict) return res.status(409).json(conflictPayload(conflict));

    const d = C.toDate(dateToUse);
    const month = d.getUTCMonth() + 1;
    const year = d.getUTCFullYear();

    db.query(
      `INSERT INTO period_logs (user_id, month, year, start_date, end_date, duration_days)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, month, year, dateToUse, finalEndDate, finalDuration],
      (err2, result) => {
        if (err2) return res.status(500).json({ message: 'Error logging period', error: err2.message });
        res.status(201).json({
          message: 'Period logged! 🌸',
          entry: { id: result.insertId, start_date: dateToUse, end_date: finalEndDate, duration_days: finalDuration },
        });
      }
    );
  });
};

// ── LOG PERIOD END (closes the open entry, computes bleed duration) ──
const logPeriodEnd = (req, res) => {
  const user_id = req.user.id;
  const { id, end_date } = req.body || {};
  const dateToUse = end_date || todayISO();

  const loadOpenEntry = (cb) => {
    if (id) {
      db.query('SELECT * FROM period_logs WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [id, user_id], (err, rows) => cb(err, rows?.[0]));
    } else {
      db.query(
        'SELECT * FROM period_logs WHERE user_id = ? AND deleted_at IS NULL AND end_date IS NULL ORDER BY start_date DESC LIMIT 1',
        [user_id],
        (err, rows) => cb(err, rows?.[0])
      );
    }
  };

  loadOpenEntry((err, entry) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    if (!entry) return res.status(400).json({ message: 'No open period to end. Please start a period first.' });

    const startISO = C.isoDate(entry.start_date);
    if (dateToUse < startISO) return res.status(400).json({ message: 'End date cannot be before the start date.' });
    if (dateToUse > todayISO()) return res.status(400).json({ message: 'End date cannot be in the future.' });

    const duration = computeDuration(startISO, dateToUse);

    db.query(
      'UPDATE period_logs SET end_date = ?, duration_days = ? WHERE id = ? AND user_id = ?',
      [dateToUse, duration, entry.id, user_id],
      (err2) => {
        if (err2) return res.status(500).json({ message: 'Error updating period', error: err2.message });
        res.json({
          message: 'Period end logged! 🌸',
          entry: { id: entry.id, start_date: startISO, end_date: dateToUse, duration_days: duration },
        });
      }
    );
  });
};

// ── EDIT ENTRY — change start and/or end date ─────────
const editEntry = (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;
  const { start_date, end_date } = req.body || {};

  db.query('SELECT * FROM period_logs WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [id, user_id], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    if (!rows[0]) return res.status(404).json({ message: 'Period entry not found' });

    const entry = rows[0];
    const newStart = start_date || C.isoDate(entry.start_date);
    const newEnd = end_date !== undefined ? end_date : (entry.end_date ? C.isoDate(entry.end_date) : null);

    if (newStart > todayISO()) return res.status(400).json({ message: 'Start date cannot be in the future.' });
    if (newEnd) {
      if (newEnd < newStart) return res.status(400).json({ message: 'End date cannot be before the start date.' });
      if (newEnd > todayISO()) return res.status(400).json({ message: 'End date cannot be in the future.' });
    }

    findOverlap(user_id, newStart, newEnd || newStart, entry.id, (err2, conflict) => {
      if (err2) return res.status(500).json({ message: 'Database error', error: err2.message });
      if (conflict) return res.status(409).json(conflictPayload(conflict));

      const duration = newEnd ? computeDuration(newStart, newEnd) : null;
      const d = C.toDate(newStart);

      db.query(
        'UPDATE period_logs SET start_date=?, end_date=?, duration_days=?, month=?, year=? WHERE id=? AND user_id=?',
        [newStart, newEnd, duration, d.getUTCMonth() + 1, d.getUTCFullYear(), entry.id, user_id],
        (err3) => {
          if (err3) return res.status(500).json({ message: 'Error updating period', error: err3.message });
          res.json({
            message: 'Period updated! 🌸',
            entry: { id: entry.id, start_date: newStart, end_date: newEnd, duration_days: duration, is_estimated: !!entry.is_estimated },
          });
        }
      );
    });
  });
};

// ── DELETE ENTRY — soft delete, names the dates ───────
const deleteEntry = (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;

  db.query('SELECT * FROM period_logs WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [id, user_id], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    if (!rows[0]) return res.status(404).json({ message: 'Period entry not found' });

    const entry = rows[0];
    db.query('UPDATE period_logs SET deleted_at = NOW() WHERE id = ? AND user_id = ?', [entry.id, user_id], (err2) => {
      if (err2) return res.status(500).json({ message: 'Error deleting period', error: err2.message });
      const startLabel = C.fmtShort(entry.start_date);
      const endLabel = entry.end_date ? C.fmtShort(entry.end_date) : null;
      res.json({
        message: `Deleted the period logged ${startLabel}${endLabel ? `–${endLabel}` : ''}`,
        deleted: { id: entry.id, start_date: C.isoDate(entry.start_date), end_date: entry.end_date ? C.isoDate(entry.end_date) : null },
      });
    });
  });
};

// ── GET CURRENT CYCLE PHASE ────────────────────────────
const getCurrentPhase = (req, res) => {
  const user_id = req.user.id;
  fetchActiveEntries(user_id, (err, entries) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    const stats = C.computeCycleStats(entries);
    const phase = C.computePhase(stats);
    res.json({
      phase_name: phase.phaseName,
      day_of_cycle: phase.dayOfCycle,
      is_late: phase.isLate,
      message: phase.message,
      nutrition_tip: phase.phaseName === 'Unknown' ? null : C.getPhaseTip(phase.phaseName),
    });
  });
};

// ── GET PERIOD HISTORY (for the Cycle History list) ───
const getPeriodHistory = (req, res) => {
  const user_id = req.user.id;
  fetchActiveEntries(user_id, (err, entries) => {
    if (err) return res.status(500).json({ message: 'Database error' });

    const sorted = [...entries].sort((a, b) => C.toDate(a.start_date) - C.toDate(b.start_date));
    const withIntervals = sorted.map((e, i) => {
      const next = sorted[i + 1];
      let interval = null;
      if (next) {
        const gap = C.daysBetween(e.start_date, next.start_date);
        if (gap > 0 && gap < 90) interval = gap;
      }
      return {
        id: e.id,
        start_date: C.isoDate(e.start_date),
        end_date: e.end_date ? C.isoDate(e.end_date) : null,
        duration_days: e.duration_days,
        is_open: !e.end_date,
        is_estimated: !!e.is_estimated,
        interval_to_next_days: interval,
      };
    });

    res.json({ entries: withIntervals.reverse() }); // newest first
  });
};

// ── GET CALENDAR DAYS for a specific month/year ───────
const getPeriodCalendar = (req, res) => {
  const user_id = req.user.id;
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || (new Date().getMonth() + 1);

  fetchActiveEntries(user_id, (err, entries) => {
    if (err) return res.status(500).json({ message: 'Database error' });

    let periodDays = [];
    entries.forEach((e) => {
      const duration = e.duration_days || C.daysBetween(e.start_date, e.end_date || e.start_date) + 1;
      periodDays.push(...getOverlapDays(e.start_date, duration, year, month));
    });

    const stats = C.computeCycleStats(entries);
    const prediction = C.computePrediction(stats);
    let predictedDays = [];

    if (stats.latestEntry && stats.hasEnoughForPersonalization) {
      // Project up to 6 cycles forward using the same avg interval, marking
      // the full predicted range (not a single day) for each projected cycle
      // so the calendar's dashed styling honestly reflects uncertainty width.
      const spanDays = prediction.rangeStart && prediction.rangeEnd
        ? C.daysBetween(prediction.rangeStart, prediction.rangeEnd) + 1
        : (stats.avgBleedDurationDays || 5);

      for (let i = 1; i <= 6; i++) {
        const anchor = C.addDays(stats.latestEntry.start_date, stats.avgInterval * i);
        const rangeStartForCycle = prediction.rangeStart
          ? C.addDays(prediction.rangeStart, stats.avgInterval * (i - 1))
          : anchor;
        const overlap = getOverlapDays(C.isoDate(rangeStartForCycle), spanDays, year, month);
        overlap.forEach((d) => {
          if (!periodDays.includes(d) && !predictedDays.includes(d)) predictedDays.push(d);
        });
      }
    }

    res.json({
      periodDays: [...new Set(periodDays)],
      predictedDays: [...new Set(predictedDays)],
    });
  });
};

// ── GET PREDICTIONS (next period only — no ovulation) ─
const getPredictions = (req, res) => {
  const user_id = req.user.id;
  fetchActiveEntries(user_id, (err, entries) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    const stats = C.computeCycleStats(entries);
    const prediction = C.computePrediction(stats);
    res.json(prediction);
  });
};

// ── GET CYCLE SUMMARY STATS ────────────────────────────
const getCycleSummary = (req, res) => {
  const user_id = req.user.id;
  fetchActiveEntries(user_id, (err, entries) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    const stats = C.computeCycleStats(entries);
    const regularity = C.regularityStatus(stats);
    res.json({
      avgIntervalDays: stats.avgInterval,
      varianceDays: stats.varianceDays,
      cyclesLoggedLast12Months: stats.cyclesLoggedLast12Months,
      longestGapDays: stats.longestGapDays,
      shortestGapDays: stats.minInterval,
      isIrregular: stats.isIrregular,
      status: regularity.status,
      avgBleedDurationDays: stats.avgBleedDurationDays,
      totalPeriodsLogged: stats.totalPeriodsLogged,
      hasEnoughForPersonalization: stats.hasEnoughForPersonalization,
    });
  });
};

// ── SAVE TODAY'S SYMPTOMS ─────────────────────────────
const logSymptoms = (req, res) => {
  const user_id = req.user.id;
  const { symptoms, log_date } = req.body || {};
  const date = log_date || todayISO();
  const symptomsStr = Array.isArray(symptoms) ? symptoms.join(',') : (symptoms || '');

  db.query(
    `INSERT INTO period_symptoms (user_id, log_date, symptoms) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE symptoms = ?`,
    [user_id, date, symptomsStr, symptomsStr],
    (err) => {
      if (err) return res.status(500).json({ message: 'Error saving symptoms' });
      res.json({ message: 'Symptoms saved! 🌸' });
    }
  );
};

// ── GET TODAY'S SYMPTOMS ──────────────────────────────
const getTodaySymptoms = (req, res) => {
  const user_id = req.user.id;
  const today = todayISO();

  db.query(
    'SELECT symptoms FROM period_symptoms WHERE user_id = ? AND log_date = ?',
    [user_id, today],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      const symptoms = results[0]?.symptoms ? results[0].symptoms.split(',').filter(Boolean) : [];
      res.json({ symptoms });
    }
  );
};

// ── GET CYCLE REGULARITY (Regular vs Irregular) ───────
// computeCycleStats() excludes is_estimated (guessed first-of-month)
// entries from its gap math internally, so every endpoint that calls it
// — this one, /period/summary, savePeriodHistory's response — agrees.
const getRegularity = (req, res) => {
  const user_id = req.user.id;
  fetchActiveEntries(user_id, (err, entries) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    const stats = C.computeCycleStats(entries);
    const regularity = C.regularityStatus(stats);
    res.json({
      ...regularity,
      cycleLengths: stats.gaps,
      avgCycle: stats.avgInterval,
      variance: stats.varianceDays,
      periodsLogged: entries.length,
    });
  });
};

module.exports = {
  savePeriodHistory,
  logPeriodStart,
  logPeriodEnd,
  editEntry,
  deleteEntry,
  getCurrentPhase,
  getPeriodHistory,
  getPeriodCalendar,
  getPredictions,
  getCycleSummary,
  logSymptoms,
  getTodaySymptoms,
  getRegularity,
};
