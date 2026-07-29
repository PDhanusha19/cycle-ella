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

const buildContextString = (ctx, faqKnowledge) => {
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

    const [userCtx, faqKnowledge] = await Promise.all([
      getUserContext(user_id),
      getFaqKnowledge(),
    ]);

    const contextString = buildContextString(userCtx, faqKnowledge);

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

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents,
      config: {
        systemInstruction: buildSystemInstruction(contextString),
        // gemini-flash-latest spends a variable, often large, number of
        // tokens on internal reasoning before producing visible output —
        // 500 was getting fully consumed by that and truncating every
        // reply (finishReason: MAX_TOKENS, empty/cut-off text). 2048
        // leaves enough headroom for both.
        maxOutputTokens: 2048,
      },
    });

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