// ============================================
// MIGRATION: Seed the faq table
// Run once:  node migrations/seed_faq.js
// Safe to run multiple times — if the faq table already has any rows the
// script reports and exits without inserting, so it will not duplicate
// content or overwrite edits made later.
//
// Requires the faq table to exist (created by setupdb.js).
//
// CONTENT POLICY for anything added here:
//   - general educational information only, never a diagnosis
//   - never name a medicine, supplement or dose
//   - point the reader to a qualified clinician for anything personal
// ============================================

require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// [category, emoji, question, answer, tags]
const FAQS = [
  // ---------- About PCOS ----------
  ['About PCOS', '🌸',
    'What is PCOS?',
    'PCOS (Polycystic Ovary Syndrome) is a common hormonal condition that affects how the ovaries work. It can make ovulation irregular or infrequent, which is why periods often become unpredictable. It affects people differently — two people with PCOS can have quite different symptoms. Only a doctor can diagnose PCOS, usually by looking at your symptoms, your cycle history and sometimes blood tests or a scan.',
    'pcos,polycystic,ovary,syndrome,meaning,definition,hormonal'],

  ['About PCOS', '🌸',
    'What causes PCOS?',
    'The exact cause is not fully understood. Research points to a mix of factors, including how the body responds to insulin, hormone levels, and a family tendency towards the condition. Importantly, PCOS is not something you caused by anything you did or did not do. A doctor can explain which factors seem most relevant in your own case.',
    'cause,causes,reason,why,insulin,genetic,family'],

  ['About PCOS', '🌸',
    'What are the common signs of PCOS?',
    'Frequently reported signs include irregular or missed periods, excess hair growth on the face or body, persistent acne, thinning hair on the scalp, darkened patches of skin, and changes in weight. Many people have only some of these, and each of these signs can also have entirely different explanations. Noticing them is a reason to talk to a doctor, not a diagnosis on its own.',
    'signs,symptoms,acne,hair,growth,thinning,skin,darkening'],

  ['About PCOS', '🌸',
    'Can PCOS be cured?',
    'There is currently no cure, but PCOS is manageable and many people find their symptoms improve a lot over time. Management usually combines regular medical review with everyday habits such as balanced eating, movement, and sleep. What works best varies from person to person, so a plan made with your own doctor will fit you better than any general advice.',
    'cure,cured,permanent,treatment,manage,management,reversible'],

  ['About PCOS', '🌸',
    'Can I still get pregnant if I have PCOS?',
    'Many people with PCOS do become pregnant. Because PCOS can make ovulation irregular, it may take longer for some, and some benefit from medical support. If you are planning a pregnancy or having difficulty conceiving, a gynecologist or fertility specialist is the right person to talk to about your options.',
    'pregnant,pregnancy,fertility,conceive,baby,children,trying'],

  ['About PCOS', '🌸',
    'Does PCOS affect long-term health?',
    'PCOS is associated with a higher chance of some other conditions over time, including insulin resistance, type 2 diabetes, raised blood pressure and changes in cholesterol. This is about likelihood, not certainty. Regular check-ups let a doctor watch for these early, which is one of the main reasons routine monitoring is recommended.',
    'long,term,risks,diabetes,pressure,cholesterol,future,complications'],

  // ---------- Diet and Nutrition ----------
  ['Diet and Nutrition', '🥗',
    'Is there a special diet for PCOS?',
    'There is no single official PCOS diet. Most general guidance points towards balanced meals built around vegetables, fibre-rich foods, whole grains and adequate protein, eaten regularly rather than skipped. Because needs differ, a doctor or registered dietitian can help you shape this around your own health, budget and food preferences.',
    'diet,eating,plan,nutrition,food,meals,balanced'],

  ['Diet and Nutrition', '🥗',
    'Should I stop eating carbohydrates completely?',
    'Cutting out an entire food group is rarely recommended and can be hard to sustain. General guidance leans towards choosing higher-fibre carbohydrates such as whole grains, legumes and vegetables, keeping portions reasonable, and pairing them with protein or vegetables. If you are considering a major change to how you eat, discuss it with a dietitian or doctor first.',
    'carbs,carbohydrates,rice,bread,cutting,keto,restriction'],

  ['Diet and Nutrition', '🥗',
    'Does sugar make PCOS worse?',
    'Frequent sugary foods and drinks cause sharper rises in blood sugar, which is worth being mindful of given the link between PCOS and insulin resistance. That does not mean sugar must be eliminated entirely. Most general advice focuses on how often and how much, rather than banning particular foods outright.',
    'sugar,sweets,sugary,drinks,blood,insulin,resistance'],

  ['Diet and Nutrition', '🥗',
    'Will losing weight improve my symptoms?',
    'For some people, modest changes in weight are associated with improvements in cycle regularity and other symptoms, but weight is only one part of the picture and PCOS also affects people at every body size. Very restrictive or crash diets tend to backfire. A doctor or dietitian can help you judge whether this is a useful goal for you specifically, and how to approach it safely.',
    'weight,losing,loss,gain,exercise,bmi,body'],

  ['Diet and Nutrition', '🥗',
    'Should I take supplements for PCOS?',
    'This app does not recommend any supplement, dose or medicine. Some supplements are studied in connection with PCOS, but evidence varies, products differ in quality, and some can interact with other medication. Please speak to your doctor or pharmacist before starting anything, including products sold as natural or herbal.',
    'supplements,vitamins,herbal,natural,tablets,medicine,pills'],

  // ---------- Cycle and Periods ----------
  ['Cycle and Periods', '🩸',
    'What counts as an irregular cycle?',
    'Cycle length is measured from the first day of one period to the first day of the next. For most adults this falls roughly between 21 and 35 days. Cycles consistently shorter or longer than that, or that swing widely from month to month, are usually described as irregular. Tracking a few cycles gives a doctor something concrete to look at.',
    'irregular,regular,cycle,length,days,normal,range'],

  ['Cycle and Periods', '🩸',
    'How many periods a year is typical?',
    'Roughly monthly cycles work out to about 9 to 13 periods a year. Having noticeably fewer than that, or regularly going more than 35 days between periods, is commonly considered worth discussing with a doctor. Infrequent periods are one of the more recognised features of PCOS, though they have other possible explanations too.',
    'periods,year,frequency,often,many,missing,infrequent'],

  ['Cycle and Periods', '🩸',
    'Why is my cycle a different length each month?',
    'Some variation is completely ordinary. Stress, illness, poor sleep, travel, and changes in activity or eating can all shift a cycle by a few days. Larger or repeated swings are more useful to record and raise with a doctor, which is exactly what tracking over several months helps you show.',
    'varies,varying,different,length,month,changes,stress'],

  ['Cycle and Periods', '🩸',
    'Is it normal to miss a period sometimes?',
    'An occasional missed period happens to many people and is not automatically a cause for alarm. Repeatedly missed periods are worth having checked. If there is any chance of pregnancy, that should be ruled out first. A doctor can help work out what is behind a pattern of missed periods.',
    'missed,missing,skipped,late,absent,amenorrhea'],

  ['Cycle and Periods', '🩸',
    'When should I see a gynecologist?',
    'Consider booking an appointment if your periods are persistently irregular or absent, if bleeding is unusually heavy or prolonged, if you have severe pelvic pain, if you notice new or worsening symptoms, or if you are having difficulty becoming pregnant. Trust your own judgement too — if something feels wrong, that is reason enough to get it checked.',
    'gynecologist,doctor,appointment,visit,consult,when,referral'],

  // ---------- Using the App ----------
  ['Using the App', '📱',
    'How do I log my period?',
    'Open the Period Tracker screen and mark the day your period started; mark it again when it ends. Logging just the start date is already enough for the app to begin working out your cycle length. The more cycles you log, the more accurate your phase and prediction information becomes.',
    'logging,track,tracker,period,record,start,date'],

  ['Using the App', '📱',
    'How does the app work out my cycle phase?',
    'The phase is calculated from the period start dates you have logged — it counts the days since your most recent period and compares that against your own average cycle length once enough cycles are recorded. Before that it falls back on typical population figures. This is an estimate based on calendar data, not a measurement of your hormones.',
    'phase,calculate,menstrual,follicular,luteal,estimate,prediction'],

  ['Using the App', '📱',
    'What does the PCOS risk result mean?',
    'It is a screening indicator produced by a statistical model trained on data from a group of previous patients. It estimates how closely the answers you gave resemble patterns seen in that group. It is not a diagnosis, it cannot examine you, and a low result does not rule PCOS out. Please treat it as a prompt to talk to a doctor, not as an answer.',
    'risk,score,result,assessment,screening,accuracy,diagnosis'],

  ['Using the App', '📱',
    'How do I log what I eat?',
    'Go to the Food Log screen, search for the food, then set the amount and which meal it belongs to. The app adds up your calories and macronutrients for the day from those entries. Nutrition values in the catalogue are general reference figures, so treat the totals as a useful estimate rather than an exact measurement.',
    'food,logging,meals,calories,macros,diary,eat'],

  ['Using the App', '📱',
    'What happens to my health data?',
    'The information you enter is stored against your account so the app can generate your tips, charts and reports, and it is not shown to other users of the app. Keep your login details private, and sign out on shared devices. For anything beyond that — how long data is kept, or how to have it deleted — please contact whoever operates your installation of the app.',
    'privacy,data,secure,stored,account,delete,personal'],
];

const SQL = 'INSERT INTO faq (category, category_emoji, question, answer, tags, helpful_count) VALUES ?';

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('Connected to MySQL! 🌸');

  db.query('SELECT COUNT(*) AS n FROM faq', (err, rows) => {
    if (err) {
      if (err.errno === 1146) {
        console.error("❌ The 'faq' table does not exist. Run 'node setupdb.js' first.");
      } else {
        console.error('❌ Could not read the faq table:', err.message);
      }
      db.end();
      process.exit(1);
    }

    const existing = rows[0].n;
    if (existing > 0) {
      console.log(`ℹ️  faq already has ${existing} row(s) — nothing inserted.`);
      console.log('   Clear the table first if you want to re-seed it.');
      console.log('\n✅ Nothing to do.');
      db.end();
      return;
    }

    const values = FAQS.map((f) => [f[0], f[1], f[2], f[3], f[4], 0]);

    db.query(SQL, [values], (err, result) => {
      if (err) {
        console.error('❌ Insert failed:', err.message);
        db.end();
        process.exit(1);
      }

      console.log(`✅ Inserted ${result.affectedRows} FAQ row(s)`);

      const byCategory = {};
      FAQS.forEach((f) => { byCategory[f[0]] = (byCategory[f[0]] || 0) + 1; });
      Object.keys(byCategory).forEach((c) => console.log(`   ${c}: ${byCategory[c]}`));

      console.log('\n✅ Migration complete!');
      db.end();
    });
  });
});
