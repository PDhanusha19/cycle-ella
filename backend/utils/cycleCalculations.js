// ============================================
// Cycle calculation engine — single source of truth for phase, interval,
// variance, regularity, and next-period prediction. Pure functions, no DB
// access, so periodController.js and reportsController.js can no longer
// drift out of sync the way they did with the old duplicated
// getPhaseFromDay().
//
// Phase timing is based on Bull et al. 2019, npj Digital Medicine
// ("Real-world menstrual cycle characteristics of more than 600,000
// menstrual cycles", 612,613 real cycles): mean cycle length 29.3 days,
// mean follicular phase 16.9 days (95% CI 10–30 — highly variable), mean
// luteal phase 12.4 days (95% CI 7–17 — comparatively fixed). Almost all
// of the variability in total cycle length comes from the follicular
// phase, not the luteal phase — so the luteal phase is anchored backward
// from the predicted next period (relatively constant length), and the
// follicular phase absorbs whatever's left. No "Ovulatory" phase and no
// ovulation-window prediction: pinpointing ovulation from calendar data
// alone is unreliable in anovulatory cycles, which is the defining
// feature of PCOS — offering it would mislead exactly this app's users.
// ============================================

const POP_MEAN_CYCLE_DAYS = 29.3;
const POP_MEAN_LUTEAL_DAYS = 12.4;
const POP_DEFAULT_BLEED_DAYS = 5; // used only when the user has zero tracked bleed data yet

const MIN_VALID_INTERVALS = 2; // 2 gaps = 3 periods logged with real (non-estimated) dates
const ROLLING_WINDOW_MONTHS = 12;

const NORMAL_INTERVAL_MIN = 21;
const NORMAL_INTERVAL_MAX = 35;
const HIGH_VARIANCE_DAYS = 9; // existing irregularity threshold — also used to suppress a point prediction
const LOW_VARIANCE_DAYS = 4; // at or below this, a plain point-estimate date is shown

const LATE_MULTIPLIER = 1.5;
const UNKNOWN_MULTIPLIER = 2.5;
const UNKNOWN_HARD_CAP_DAYS = 90;

const GAP_MIN_DAYS = 0; // exclusive
const GAP_MAX_DAYS = 90; // exclusive — same sanity filter the old computeRegularity used

// Normalizes either a JS Date (as mysql2 returns DATE columns — local
// midnight) or a 'YYYY-MM-DD' string (as req.body sends dates) into a
// UTC-midnight Date representing that same calendar day. This is the one
// place the ambiguity is resolved — every other helper below only ever
// sees UTC-normalized dates, so arithmetic/formatting can't drift a day
// depending on the server's local timezone (mysql2's local-midnight
// Date + a naive .toISOString() is exactly what silently shifts dates
// backward a day in any timezone ahead of UTC — this must never come back).
function toDate(d) {
  if (d instanceof Date) {
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  const [y, m, day] = String(d).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
function daysBetween(a, b) {
  return Math.round((toDate(b) - toDate(a)) / 86400000);
}
function addDays(d, n) {
  const r = toDate(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}
function isoDate(d) {
  return toDate(d).toISOString().split('T')[0];
}
function monthsAgo(n, from) {
  const d = toDate(from);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d;
}
function fmtShort(d) {
  return toDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * entries: period_logs rows for one user, already filtered to
 * deleted_at IS NULL. Each { start_date, end_date?, duration_days?, is_estimated? }.
 *
 * is_estimated rows (onboarding entries where the user didn't remember the
 * exact day — stored as a first-of-month guess) are excluded from gap-based
 * math (interval/variance/regularity/prediction) everywhere, in this one
 * place, so every endpoint that calls this function agrees with every other
 * one. They still count toward totalPeriodsLogged/cyclesLoggedLast12Months
 * and can still be the latestEntry (a rough date beats no date for phase
 * purposes) — only the day-level gap arithmetic can't trust them.
 */
function computeCycleStats(entries, today = new Date()) {
  const withDates = (entries || []).filter((e) => e.start_date);
  const sorted = [...withDates].sort((a, b) => toDate(a.start_date) - toDate(b.start_date));
  const trackedSorted = sorted.filter((e) => !e.is_estimated);

  const windowStart = monthsAgo(ROLLING_WINDOW_MONTHS, today);
  const windowed = sorted.filter((e) => toDate(e.start_date) >= windowStart);
  const trackedWindowed = trackedSorted.filter((e) => toDate(e.start_date) >= windowStart);

  const gaps = [];
  for (let i = 1; i < trackedWindowed.length; i++) {
    const gap = daysBetween(trackedWindowed[i - 1].start_date, trackedWindowed[i].start_date);
    if (gap > GAP_MIN_DAYS && gap < GAP_MAX_DAYS) gaps.push(gap);
  }

  const hasEnoughForPersonalization = gaps.length >= MIN_VALID_INTERVALS;
  const avgInterval = gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;
  const minInterval = gaps.length > 0 ? Math.min(...gaps) : null;
  const maxInterval = gaps.length > 0 ? Math.max(...gaps) : null;
  const varianceDays = gaps.length > 0 ? maxInterval - minInterval : null;

  const isIrregular = avgInterval !== null
    ? (avgInterval < NORMAL_INTERVAL_MIN || avgInterval > NORMAL_INTERVAL_MAX || varianceDays > HIGH_VARIANCE_DAYS)
    : null;

  const bleedDurations = windowed
    .map((e) => e.duration_days)
    .filter((d) => d !== null && d !== undefined && !Number.isNaN(Number(d)))
    .map(Number);
  const avgBleedDurationDays = bleedDurations.length > 0
    ? Math.round(bleedDurations.reduce((a, b) => a + b, 0) / bleedDurations.length)
    : null;

  return {
    gaps,
    avgInterval,
    minInterval,
    maxInterval,
    varianceDays,
    longestGapDays: maxInterval,
    isIrregular,
    cyclesLoggedLast12Months: windowed.length,
    totalPeriodsLogged: sorted.length,
    avgBleedDurationDays,
    hasEnoughForPersonalization,
    latestEntry: sorted.length > 0 ? sorted[sorted.length - 1] : null,
  };
}

function regularityStatus(stats) {
  if (!stats.hasEnoughForPersonalization) {
    return {
      status: 'Not enough data',
      message: 'Log at least 3 periods (2 gaps between them) to detect your cycle pattern.',
    };
  }

  const outOfNormalRange = stats.avgInterval < NORMAL_INTERVAL_MIN || stats.avgInterval > NORMAL_INTERVAL_MAX;
  const highVariance = stats.varianceDays > HIGH_VARIANCE_DAYS;

  let message;
  if (stats.isIrregular && outOfNormalRange) {
    message = `Your average cycle (${stats.avgInterval} days, last 12 months) is outside the typical 21-35 day range. This pattern is often seen in PCOS — consider discussing with a gynecologist.`;
  } else if (stats.isIrregular && highVariance) {
    message = `Your cycle length has varied by up to ${stats.varianceDays} days between periods in the last 12 months. Irregular cycles are a common PCOS symptom — worth tracking and discussing with a doctor.`;
  } else {
    message = `Your cycles have been fairly consistent over the last 12 months (${stats.avgInterval} days on average, varying by ${stats.varianceDays} days). Keep tracking to monitor any changes.`;
  }

  return { status: stats.isIrregular ? 'Irregular' : 'Regular', message };
}

function computePhase(stats, today = new Date()) {
  if (!stats.latestEntry) {
    return {
      phaseName: 'Unknown',
      dayOfCycle: 0,
      isLate: false,
      message: 'No cycle data found. Please log your period history.',
    };
  }

  const bleedLen = Math.round(stats.avgBleedDurationDays || POP_DEFAULT_BLEED_DAYS);
  const lutealLen = Math.round(POP_MEAN_LUTEAL_DAYS);
  const predictedLen = stats.hasEnoughForPersonalization ? stats.avgInterval : Math.round(POP_MEAN_CYCLE_DAYS);
  const follicularLen = Math.max(1, predictedLen - bleedLen - lutealLen);

  const dayOfCycle = daysBetween(stats.latestEntry.start_date, today) + 1;
  const unknownCutoff = Math.max(UNKNOWN_HARD_CAP_DAYS, predictedLen * UNKNOWN_MULTIPLIER);

  if (dayOfCycle > unknownCutoff) {
    return {
      phaseName: 'Unknown',
      dayOfCycle,
      isLate: false,
      message: "We haven't seen a new period logged in a while — log your latest period to keep this accurate.",
    };
  }

  const isLate = dayOfCycle > predictedLen * LATE_MULTIPLIER;

  let phaseName;
  if (dayOfCycle <= bleedLen) phaseName = 'Menstrual';
  else if (dayOfCycle <= bleedLen + follicularLen) phaseName = 'Follicular';
  else phaseName = 'Luteal';

  return { phaseName, dayOfCycle, isLate, predictedLen, bleedLen, follicularLen, lutealLen, message: null };
}

function getPhaseTip(phaseName) {
  const tips = {
    Menstrual: 'Focus on iron-rich foods like spinach, lentils, and dates to replenish blood loss.',
    Follicular: 'Eat protein-rich foods like eggs, legumes, and nuts to support this phase.',
    Luteal: 'Reduce sugar and caffeine. Eat magnesium-rich foods like dark chocolate and nuts to ease PMS.',
  };
  return tips[phaseName] || 'Maintain a balanced diet with whole foods.';
}

function getNextPhaseTip(phaseName) {
  const tips = {
    Menstrual: "Next you'll enter the follicular phase — a great time to increase protein intake and start light exercise.",
    Follicular: "Next you'll enter the luteal phase — reduce sugar and increase magnesium-rich foods to ease PMS.",
    Luteal: 'Your period is approaching — stock up on iron-rich foods like spinach, dates, and lentils.',
  };
  return tips[phaseName] || 'Maintain a balanced diet and stay consistent with food logging.';
}

function computePrediction(stats) {
  if (!stats.latestEntry) {
    return { type: 'no_data', nextPeriod: 'No data yet', nextPeriodDate: null, rangeStart: null, rangeEnd: null, avgCycle: '28d' };
  }

  if (!stats.hasEnoughForPersonalization) {
    const popLen = Math.round(POP_MEAN_CYCLE_DAYS);
    return {
      type: 'population_estimate',
      nextPeriod: `~${popLen}d after your last period (typical average — log more periods for a personal estimate)`,
      nextPeriodDate: null,
      rangeStart: null,
      rangeEnd: null,
      avgCycle: `${popLen}d`,
    };
  }

  const base = addDays(stats.latestEntry.start_date, stats.avgInterval);

  if (stats.varianceDays > HIGH_VARIANCE_DAYS) {
    const rangeStart = addDays(stats.latestEntry.start_date, stats.minInterval);
    const rangeEnd = addDays(stats.latestEntry.start_date, stats.maxInterval);
    return {
      type: 'wide_range',
      nextPeriod: 'Your cycles vary too much to predict a single date',
      nextPeriodDate: null,
      rangeStart: isoDate(rangeStart),
      rangeEnd: isoDate(rangeEnd),
      avgCycle: `${stats.avgInterval}d`,
    };
  }

  if (stats.varianceDays > LOW_VARIANCE_DAYS) {
    const half = Math.round(stats.varianceDays / 2);
    const rangeStart = addDays(base, -half);
    const rangeEnd = addDays(base, half);
    return {
      type: 'range',
      nextPeriod: `${fmtShort(rangeStart)}–${toDate(rangeEnd).getUTCDate()}`,
      nextPeriodDate: isoDate(base),
      rangeStart: isoDate(rangeStart),
      rangeEnd: isoDate(rangeEnd),
      avgCycle: `${stats.avgInterval}d`,
    };
  }

  return {
    type: 'point',
    nextPeriod: fmtShort(base),
    nextPeriodDate: isoDate(base),
    rangeStart: null,
    rangeEnd: null,
    avgCycle: `${stats.avgInterval}d`,
  };
}

module.exports = {
  POP_MEAN_CYCLE_DAYS,
  POP_MEAN_LUTEAL_DAYS,
  POP_DEFAULT_BLEED_DAYS,
  MIN_VALID_INTERVALS,
  ROLLING_WINDOW_MONTHS,
  NORMAL_INTERVAL_MIN,
  NORMAL_INTERVAL_MAX,
  HIGH_VARIANCE_DAYS,
  LOW_VARIANCE_DAYS,
  toDate,
  daysBetween,
  addDays,
  isoDate,
  fmtShort,
  computeCycleStats,
  regularityStatus,
  computePhase,
  computePrediction,
  getPhaseTip,
  getNextPhaseTip,
};
