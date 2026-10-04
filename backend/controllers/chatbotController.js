const { GoogleGenAI } = require('@google/genai');
const db = require('../config/db');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ============================================
// SYSTEM INSTRUCTION
// This defines what Ella is and — critically — what she is NOT.
// Do not weaken the "not a doctor" / "no diagnosis" rules to make
// responses sound more authoritative. Those rules exist because a
// wrong diagnosis from an app causes real harm: a false "you're
// fine" can stop someone seeking care they need.
// ============================================
const buildSystemInstruction = (context) => `You are Ella, the AI health guide inside the Cycle Ella app — a PCOS and menstrual health app for women in Sri Lanka.

Think of yourself as a knowledgeable, warm friend who understands women's health and helps users figure out their next steps. You are NOT a doctor and must never claim to be one.

CRITICAL SAFETY RULES — never break these:
1. NEVER diagnose. Never say "you have PCOS" or "you don't have PCOS". Only a real doctor can determine that after proper examination and tests.
2. NEVER interpret someone's specific lab results or medical reports to reach a conclusion about their condition. You may explain what a term or test generally means, but always end by saying their doctor must interpret their actual results in context.
3. NEVER suggest specific medications, dosages, or drug combinations.
4. If symptoms sound urgent or severe (severe pain, heavy bleeding, fainting, etc.), tell them to seek medical care promptly.

WHAT YOU CAN DO:
- Explain PCOS, symptoms, causes, and terminology in simple language
- Explain what tests doctors commonly use for PCOS (AMH, testosterone, LH:FSH ratio, fasting insulin/glucose, pelvic ultrasound, thyroid tests) and what they generally measure
- Give general reference ranges when asked, while making clear labs differ and only their doctor can interpret their specific results
- Give food and lifestyle guidance suited to Sri Lankan diets (rice and curry, local vegetables, etc.)
- Give exercise guidance appropriate for PCOS
- Encourage and support — many users find this topic stressful

REFERRING TO A DOCTOR:
When someone's situation calls for real medical attention — especially if their risk assessment came back High, or they describe concerning symptoms — clearly recommend seeing a gynecologist and tell them they can find one in the app's Gyno Directory.

TONE:
Warm, friendly, encouraging. Simple language, not clinical jargon. Keep responses SHORT — 2 to 4 short paragraphs maximum, since this is a mobile chat. Use the user's name occasionally if you know it.

${context}`;

// Pull the user's real app data so Ella has genuine context
const getUserContext = (user_id) => {
  return new Promise((resolve) => {
    const context = {};

    db.query('SELECT full_name FROM users WHERE id = ?', [user_id], (err, users) => {
      context.name = users?.[0]?.full_name?.split(' ')[0] || null;

      db.query(
        'SELECT risk_level, pcos_probability_percent, assessed_at FROM pcos_risk WHERE user_id = ? ORDER BY assessed_at DESC LIMIT 1',
        [user_id],
        (err2, risk) => {
          context.risk = risk?.[0] || null;

          db.query(
            'SELECT * FROM pcos_symptoms WHERE user_id = ?',
            [user_id],
            (err3, symptoms) => {
              context.symptoms = symptoms?.[0] || null;

              db.query(
                'SELECT diabetes, cholesterol, blood_pressure FROM users WHERE id = ?',
                [user_id],
                (err4, health) => {
                  context.health = health?.[0] || null;
                  resolve(context);
                }
              );
            }
          );
        }
      );
    });
  });
};

// Same day-range lookup used by periodController.getCurrentPhase and
// reportsController.getCurrentPhaseInfo — this app has no shared service
// layer between controllers, so this is (deliberately) a third copy.
function getPhaseFromDay(dayOfCycle) {
  if (dayOfCycle <= 5) return 'Menstrual';
  if (dayOfCycle <= 13) return 'Follicular';
  if (dayOfCycle <= 16) return 'Ovulatory';
  return 'Luteal';
}

// Pulls today's calorie/macro targets + consumed/remaining, this week's
// average intake, current cycle phase + days to next period, and a
// shortlist of foods that fit her remaining budget. Read-only — this
// NEVER triggers a target recalculation (that only ever happens from a
// real weigh-in or GET /api/nutrition/today); a chat message is the
// wrong place for that kind of side effect.
const getNutritionCycleContext = (user_id) => {
  return new Promise((resolve) => {
    const nc = {};
    const today = new Date().toISOString().split('T')[0];

    db.query(
      'SELECT * FROM nutrition_targets WHERE user_id = ? ORDER BY week_start DESC LIMIT 1',
      [user_id],
      (errT, targetRows) => {
        nc.target = targetRows?.[0] || null;

        db.query(
          `SELECT COALESCE(SUM(calories),0) as calories, COALESCE(SUM(protein),0) as protein,
                  COALESCE(SUM(carbs),0) as carbs, COALESCE(SUM(fats),0) as fats
           FROM food_logs WHERE user_id = ? AND log_date = ?`,
          [user_id, today],
          (errC, consumedRows) => {
            const c = consumedRows?.[0];
            nc.consumedToday = c ? {
              calories: Math.round(parseFloat(c.calories)),
              protein: Math.round(parseFloat(c.protein) * 10) / 10,
              carbs: Math.round(parseFloat(c.carbs) * 10) / 10,
              fats: Math.round(parseFloat(c.fats) * 10) / 10,
            } : null;

            // Grouped by day and averaged over days actually logged —
            // NOT divided by a flat 7, which would make someone who
            // simply hasn't opened the app this weekend look like
            // she's starving (a real bug already present elsewhere in
            // this codebase's reports — not repeating it here).
            db.query(
              `SELECT DATE(log_date) as d, SUM(calories) as total
               FROM food_logs WHERE user_id = ? AND log_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
               GROUP BY DATE(log_date)`,
              [user_id],
              (errW, weekRows) => {
                if (weekRows?.length) {
                  const total = weekRows.reduce((sum, r) => sum + parseFloat(r.total), 0);
                  nc.weekAvgCalories = Math.round(total / weekRows.length);
                  nc.weekDaysLogged = weekRows.length;
                } else {
                  nc.weekAvgCalories = null;
                  nc.weekDaysLogged = 0;
                }

                // Same live period_logs-based calculation as
                // periodController.getCurrentPhase/getPredictions —
                // cycle_phases table is never written to anywhere in
                // this codebase, so it's not a usable source.
                db.query(
                  'SELECT * FROM period_logs WHERE user_id = ? AND start_date IS NOT NULL ORDER BY start_date DESC LIMIT 1',
                  [user_id],
                  (errP, periodRows) => {
                    const latest = periodRows?.[0];
                    if (latest) {
                      const avgCycle = latest.avg_cycle_length || 28;
                      const startDate = new Date(latest.start_date);
                      const now = new Date();
                      const daysSince = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
                      let dayOfCycle = (daysSince % avgCycle) + 1;
                      if (dayOfCycle < 1) dayOfCycle = 1;
                      nc.phase = getPhaseFromDay(dayOfCycle);

                      let nextPeriod = new Date(latest.start_date);
                      while (nextPeriod <= now) nextPeriod.setDate(nextPeriod.getDate() + avgCycle);
                      nc.daysToNextPeriod = Math.ceil((nextPeriod - now) / (1000 * 60 * 60 * 24));
                    } else {
                      nc.phase = null;
                      nc.daysToNextPeriod = null;
                    }

                    if (nc.target && nc.consumedToday) {
                      const remainingCalories = nc.target.daily_calories - nc.consumedToday.calories;
                      // Even an over-budget user still gets a non-empty
                      // "lighter options" shortlist instead of nothing.
                      const threshold = Math.max(remainingCalories, 300);
                      db.query(
                        `SELECT name, calories, protein, carbs, fats, category FROM foods
                         WHERE pcos_friendly = 1 AND calories <= ? ORDER BY calories DESC LIMIT 12`,
                        [threshold],
                        (errF, foodRows) => {
                          nc.suggestedFoods = foodRows || [];
                          resolve(nc);
                        }
                      );
                    } else {
                      nc.suggestedFoods = [];
                      resolve(nc);
                    }
                  }
                );
              }
            );
          }
        );
      }
    );
  });
};

// Pull the FAQ library so Ella answers consistently with the
// app's own vetted content rather than inventing everything
const getFaqKnowledge = () => {
  return new Promise((resolve) => {
    db.query('SELECT question, answer FROM faq ORDER BY category, id', (err, results) => {
      if (err || !results?.length) return resolve('');
      const faqText = results
        .map(f => `Q: ${f.question}\nA: ${f.answer}`)
        .join('\n\n');
      resolve(`\n\nAPP FAQ LIBRARY — prefer these answers when relevant, they are the app's vetted content:\n${faqText}`);
    });
  });
};

const buildContextString = (ctx, nc, faqKnowledge) => {
  let str = '\nWHAT YOU KNOW ABOUT THIS USER:\n';

  if (ctx.name) str += `- Her name is ${ctx.name}\n`;

  if (ctx.risk) {
    str += `- She completed the PCOS risk assessment: result was ${ctx.risk.risk_level} risk`;
    if (ctx.risk.pcos_probability_percent) {
      str += ` (${ctx.risk.pcos_probability_percent}% probability score)`;
    }
    str += '\n';
    if (ctx.risk.risk_level === 'High') {
      str += `- IMPORTANT: Her risk is High. Encourage her to see a gynecologist and mention the Gyno Directory in the app.\n`;
    }
  } else {
    str += `- She has NOT taken the PCOS risk assessment yet. If relevant, gently suggest she try it in the app — it asks 9 simple questions.\n`;
  }

  if (ctx.symptoms) {
    const s = ctx.symptoms;
    const reported = [];
    if (s.cycle_regularity === 'Irregular') reported.push('irregular periods');
    if (s.weight_gain) reported.push('weight gain');
    if (s.hair_growth) reported.push('excess hair growth');
    if (s.skin_darkening) reported.push('skin darkening');
    if (s.hair_loss) reported.push('hair loss');
    if (s.pimples) reported.push('acne');
    if (reported.length) str += `- Symptoms she reported: ${reported.join(', ')}\n`;
    if (!s.regular_exercise) str += `- She reported not exercising regularly\n`;
    if (s.fast_food) str += `- She reported eating fast food often\n`;
  }

  if (ctx.health) {
    if (ctx.health.diabetes && ctx.health.diabetes !== 'None' && ctx.health.diabetes !== 'No') {
      str += `- She has diabetes status: ${ctx.health.diabetes} — keep this in mind for any food advice\n`;
    }
    if (ctx.health.cholesterol === 'Yes') str += `- She reported high cholesterol\n`;
    if (ctx.health.blood_pressure === 'Yes') str += `- She reported high blood pressure\n`;
  }

  if (nc.phase) {
    str += `- Her current menstrual cycle phase is: ${nc.phase}\n`;
    if (nc.daysToNextPeriod !== null) {
      str += `- Her next period is predicted in about ${nc.daysToNextPeriod} day${nc.daysToNextPeriod === 1 ? '' : 's'}\n`;
    }
  }

  if (nc.target) {
    str += `- Her daily targets (calculated from her weight/height/activity, goal: ${nc.target.goal}): ${nc.target.daily_calories} kcal, ${nc.target.daily_protein_g}g protein, ${nc.target.daily_carbs_g}g carbs, ${nc.target.daily_fats_g}g fats\n`;
    if (nc.consumedToday) {
      const remaining = nc.target.daily_calories - nc.consumedToday.calories;
      str += `- So far today she's eaten ${nc.consumedToday.calories} kcal (${nc.consumedToday.protein}g protein, ${nc.consumedToday.carbs}g carbs, ${nc.consumedToday.fats}g fats)\n`;
      str += remaining >= 0
        ? `- She has ${remaining} kcal remaining today\n`
        : `- She is ${Math.abs(remaining)} kcal OVER her target today — if this comes up, mention it gently and supportively, never as a failure\n`;
    }
    if (nc.weekAvgCalories !== null) {
      str += `- Her average intake this week (${nc.weekDaysLogged} day${nc.weekDaysLogged === 1 ? '' : 's'} logged) is ${nc.weekAvgCalories} kcal/day vs her ${nc.target.daily_calories} kcal/day target\n`;
    }
    if (nc.suggestedFoods.length) {
      str += `- Foods from the app's database that fit what she has left today (use these, with reasons, if she asks what to eat): ${nc.suggestedFoods.map(f => `${f.name} (${f.calories} kcal, ${f.protein}g protein)`).join(', ')}\n`;
    }
    str += `- IMPORTANT: these targets are general estimates from standard formulas, not a medical prescription — say so if asked. If she asks about fatigue, low energy, or how she's feeling, you may mention that intake or cycle phase commonly affect energy as POSSIBLE factors — never attribute it to a specific diagnosis, and suggest she see a doctor if it's severe or persistent.\n`;
  } else {
    str += `- She hasn't logged her weight/height yet, so there are no personalized calorie/macro targets available. If relevant, gently suggest she complete the BMI step in the app.\n`;
  }

  str += '\nUse this context naturally — do not recite it back at her like a list.\n';
  return str + faqKnowledge;
};

const askChatbot = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { message, history } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Please enter a question' });
    }

    const [userCtx, nutritionCycleCtx, faqKnowledge] = await Promise.all([
      getUserContext(user_id),
      getNutritionCycleContext(user_id),
      getFaqKnowledge(),
    ]);

    const contextString = buildContextString(userCtx, nutritionCycleCtx, faqKnowledge);

    const contents = [];
    if (Array.isArray(history)) {
      for (const turn of history) {
        contents.push({
          role: turn.role === 'bot' ? 'model' : 'user',
          parts: [{ text: turn.text }],
        });
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    // Pinned to an explicit model instead of the "gemini-flash-latest" alias —
    // that alias silently moved onto gemini-3.8-flash, whose free-tier quota
    // (20 requests/day/project) we ran out of. flash-lite is a distinct model
    // with its own separate quota bucket, and is the cheapest tier once
    // billing is enabled. If Google deprecates this model id too, re-check
    // https://ai.google.dev/gemini-api/docs/models for its replacement.
    const GEMINI_MODEL = 'gemini-3.5-flash-lite';

    // The Gemini API is intermittently slow/flaky (observed 7-50s response
    // times, occasional 503 "high demand" and connection resets) — a single
    // attempt with no timeout risked hanging well past the frontend's request
    // timeout. Two attempts at 13s each keeps the worst case comfortably
    // under that, while giving a real second chance instead of failing
    // straight to the FAQ fallback on the first network hiccup.
    const GEMINI_ATTEMPTS = 2;
    const GEMINI_ATTEMPT_TIMEOUT_MS = 13000;
    let response;
    let lastErr;
    for (let attempt = 1; attempt <= GEMINI_ATTEMPTS; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents,
          config: {
            systemInstruction: buildSystemInstruction(contextString),
            // Generous ceiling so a longer reply never gets cut off
            // mid-sentence (finishReason: MAX_TOKENS).
            maxOutputTokens: 2048,
            httpOptions: { timeout: GEMINI_ATTEMPT_TIMEOUT_MS },
          },
        });
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        console.error(`Gemini API error (attempt ${attempt}/${GEMINI_ATTEMPTS}):`, err.message);
      }
    }
    if (lastErr) throw lastErr;

    const reply = response.text;

    if (!reply) {
      return res.status(500).json({ message: 'No response generated, please try again' });
    }

    // Tell the app when to surface the Gyno Directory shortcut
    const suggestGyno = userCtx.risk?.risk_level === 'High'
      || /gynecolog|gynaecolog|see a doctor|consult a doctor|Gyno Directory/i.test(reply);

    res.json({
      reply,
      suggest_gyno: suggestGyno,
      has_assessment: !!userCtx.risk,
      risk_level: userCtx.risk?.risk_level || null,
    });
  } catch (err) {
    console.error('Gemini API error:', err.message);
    res.status(500).json({
      message: "I'm having trouble responding right now. Please try again in a moment.",
      error: err.message,
    });
  }
};

module.exports = { askChatbot };