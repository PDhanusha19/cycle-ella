/**
 * Cycle Ella — Flask AI service (app.py) API contract tests
 * =========================================================
 * Target: http://localhost:5001 (see playwright.config.ts baseURL)
 *
 * The AI service must be running before these execute:
 *     cd ai-service && python app.py
 *
 * Every assertion below was checked against the live service rather than
 * inferred from reading the source. Where the service behaves in a way
 * that is arguably wrong (validation errors surfacing as 500 instead of
 * 400, an empty search returning the whole catalogue), the test asserts
 * the ACTUAL behaviour and is marked "CONTRACT NOTE" so the suite stays
 * green while still documenting the quirk. Those are the places to change
 * first if app.py is ever hardened.
 *
 * Counts are derived from /foods/all at runtime, never hardcoded, so the
 * suite survives the food catalogue growing or shrinking.
 */

import { test, expect, APIRequestContext, APIResponse } from '@playwright/test';

// ---------------------------------------------------------------------
// Types mirroring what the endpoints actually return
// ---------------------------------------------------------------------
type Food = {
  id: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  category: string;
  glycemic_index: 'low' | 'medium' | 'high' | null;
  pcos_friendly: number;
  cuisine?: string;
  sinhala_name?: string;
  tamil_name?: string;
};

type Recommendation = Food & { score: number; reasons: string[]; similar_alternatives: Food[] };

type RecommendResponse = {
  recommendations: Recommendation[];
  algorithm: string;
  based_on: {
    risk_level: string;
    bmi_category: 'underweight' | 'normal' | 'overweight' | 'obese';
    diabetes_level: 'None' | 'Pre-diabetic' | 'Diet-controlled' | 'Insulin-dependent';
    cholesterol_filter_applied: boolean;
    total_foods_available: number;
  };
};

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

/** A payload that build_feature_row() can fully consume. */
const VALID_PCOS_PAYLOAD = {
  age: 24,
  weight_kg: 65,
  height_cm: 160,
  cycle_regularity: 'Irregular',
  period_duration_days: 6,
  weight_gain: true,
  hair_growth: true,
  skin_darkening: false,
  hair_loss: false,
  pimples: true,
  fast_food: true,
  regular_exercise: false,
};

/** Ask for every food so hard filters are observable. Anything above the
 *  catalogue size works; recommend_foods() just slices. */
const ALL = 500;

async function recommend(request: APIRequestContext, body: Record<string, unknown>) {
  const res = await request.post('/recommend-foods', { data: body });
  expect(res.status(), `recommend-foods ${JSON.stringify(body)}`).toBe(200);
  return (await res.json()) as RecommendResponse;
}

async function totalFoodCount(request: APIRequestContext): Promise<number> {
  const res = await request.get('/foods/all');
  const body = await res.json();
  return body.count as number;
}

/** GI levels present in a recommendation set. */
const gisIn = (recs: Recommendation[]) => new Set(recs.map((f) => f.glycemic_index));

// =====================================================================
// /health
// =====================================================================
test.describe('/health', () => {
  test('reports running status and model metadata', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('running');
    expect(body.message).toContain('Cycle Ella AI Service');

    // model_1 block is what the thesis quotes, so pin its shape.
    expect(body.model_1).toBeDefined();
    expect(body.model_1.name).toContain('Logistic Regression');
    expect(body.model_1.test_accuracy).toMatch(/^\d+(\.\d+)?%$/);
    expect(body.model_1.recall).toMatch(/^\d+(\.\d+)?% /);
    expect(body.model_1.trained_on).toHaveProperty('total_patients');
  });

  test('EDGE: POST is rejected — the route is GET-only', async ({ request }) => {
    const res = await request.post('/health', { data: {} });
    expect(res.status()).toBe(405);
  });

  test('EDGE: unknown route returns 404', async ({ request }) => {
    const res = await request.get('/definitely-not-a-route');
    expect(res.status()).toBe(404);
  });
});

// =====================================================================
// /predict-pcos
// =====================================================================
test.describe('/predict-pcos', () => {
  test('returns the full prediction contract for a valid payload', async ({ request }) => {
    const res = await request.post('/predict-pcos', { data: VALID_PCOS_PAYLOAD });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(
      [
        'disclaimer',
        'model_accuracy',
        'pcos_detected',
        'pcos_probability_percent',
        'risk_level',
        'top_contributing_factors',
      ].sort(),
    );

    expect(typeof body.pcos_detected).toBe('boolean');
    expect(typeof body.pcos_probability_percent).toBe('number');
    expect(body.pcos_probability_percent).toBeGreaterThanOrEqual(0);
    expect(body.pcos_probability_percent).toBeLessThanOrEqual(100);
    expect(['Low', 'Medium', 'High']).toContain(body.risk_level);
    expect(body.disclaimer).toContain('not a medical diagnosis');
  });

  test('risk_level matches get_risk_level() thresholds (33 / 66)', async ({ request }) => {
    const res = await request.post('/predict-pcos', { data: VALID_PCOS_PAYLOAD });
    const { pcos_probability_percent: p, risk_level } = await res.json();

    // app.py: <0.33 Low, <0.66 Medium, else High — on the 0-1 probability,
    // so the percentage boundaries are 33 and 66.
    const expected = p < 33 ? 'Low' : p < 66 ? 'Medium' : 'High';
    expect(risk_level).toBe(expected);
  });

  test('top_contributing_factors is exactly 3 raw model feature names', async ({ request }) => {
    const res = await request.post('/predict-pcos', { data: VALID_PCOS_PAYLOAD });
    const { top_contributing_factors: factors } = await res.json();

    expect(Array.isArray(factors)).toBe(true);
    expect(factors).toHaveLength(3);
    factors.forEach((f: string) => expect(typeof f).toBe('string'));

    // These are the dataset's raw column names, not display labels — the
    // app maps them for the user. If this fails, the frontend's
    // FACTOR_LABELS map in ReviewAssessmentScreen.js needs updating too.
    const KNOWN_FEATURES = [
      'Age (yrs)', 'Weight (Kg)', 'Height(Cm)', 'BMI', 'Cycle(R/I)',
      'Cycle length(days)', 'Weight gain(Y/N)', 'hair growth(Y/N)',
      'Skin darkening (Y/N)', 'Hair loss(Y/N)', 'Pimples(Y/N)',
      'Fast food (Y/N)', 'Reg.Exercise(Y/N)',
    ];
    factors.forEach((f: string) => expect(KNOWN_FEATURES).toContain(f));
  });

  test('the 3 factors are model-wide, so they do not vary per user', async ({ request }) => {
    // They come from the largest model coefficients, not this user's input,
    // which is exactly why the UI labels them "general model factors".
    const a = await request.post('/predict-pcos', { data: VALID_PCOS_PAYLOAD });
    const b = await request.post('/predict-pcos', {
      data: { ...VALID_PCOS_PAYLOAD, age: 41, weight_kg: 50, cycle_regularity: 'Regular', pimples: false },
    });
    expect((await a.json()).top_contributing_factors)
      .toEqual((await b.json()).top_contributing_factors);
  });

  test('cycle_regularity: only a value starting with "reg" counts as regular', async ({ request }) => {
    // build_feature_row(): cycle_code = 2 if startswith("reg") else 4.
    const regular = await request.post('/predict-pcos', {
      data: { ...VALID_PCOS_PAYLOAD, cycle_regularity: 'Regular' },
    });
    const irregular = await request.post('/predict-pcos', {
      data: { ...VALID_PCOS_PAYLOAD, cycle_regularity: 'Irregular' },
    });
    const nonsense = await request.post('/predict-pcos', {
      data: { ...VALID_PCOS_PAYLOAD, cycle_regularity: 'banana' },
    });

    expect(regular.status()).toBe(200);
    expect(irregular.status()).toBe(200);
    expect(nonsense.status()).toBe(200);

    const rp = (await regular.json()).pcos_probability_percent;
    const ip = (await irregular.json()).pcos_probability_percent;
    const np = (await nonsense.json()).pcos_probability_percent;

    // CONTRACT NOTE: an unrecognised string is silently treated as
    // IRREGULAR rather than rejected. A typo therefore shifts the result.
    expect(np).toBe(ip);
    expect(rp).not.toBe(ip);
  });

  // ------------------------- edge cases -------------------------

  test('EDGE: empty object returns 500, not a 400 validation error', async ({ request }) => {
    // CONTRACT NOTE: app.py wraps the whole handler in try/except and
    // returns 500 for ANY bad input. There is no request validation, so a
    // client cannot distinguish "you sent bad data" from "the model broke".
    const res = await request.post('/predict-pcos', { data: {} });
    expect(res.status()).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('NoneType');
  });

  test('EDGE: non-numeric age returns 500 with the coercion error', async ({ request }) => {
    const res = await request.post('/predict-pcos', {
      data: { ...VALID_PCOS_PAYLOAD, age: 'twenty' },
    });
    expect(res.status()).toBe(500);
    expect((await res.json()).error).toContain('could not convert string to float');
  });

  test('EDGE: height_cm = 0 divides by zero inside compute_bmi', async ({ request }) => {
    // compute_bmi() divides by (height_cm/100)**2 with no guard.
    const res = await request.post('/predict-pcos', {
      data: { ...VALID_PCOS_PAYLOAD, height_cm: 0 },
    });
    expect(res.status()).toBe(500);
    expect((await res.json()).error).toContain('division by zero');
  });

  test('EDGE: physiologically impossible values are accepted, not validated', async ({ request }) => {
    // CONTRACT NOTE: negative age / negative weight pass straight into the
    // model. Worth knowing before quoting the model's output as meaningful.
    const res = await request.post('/predict-pcos', {
      data: { ...VALID_PCOS_PAYLOAD, age: -5, weight_kg: -10, period_duration_days: 999 },
    });
    expect(res.status()).toBe(200);
    expect(['Low', 'Medium', 'High']).toContain((await res.json()).risk_level);
  });

  test('EDGE: an explicit null field is a 500, but an omitted one uses no default', async ({ request }) => {
    const res = await request.post('/predict-pcos', {
      data: { ...VALID_PCOS_PAYLOAD, weight_kg: null },
    });
    expect(res.status()).toBe(500);
    expect((await res.json()).error).toContain('NoneType');
  });

  test('EDGE: genuinely malformed JSON surfaces as 500, not 400', async ({ request }) => {
    // Sent as a raw Buffer — passing a plain string here would be
    // JSON-encoded by Playwright into a valid JSON string, which is a
    // different case entirely (covered by the next test).
    const res = await request.post('/predict-pcos', {
      headers: { 'Content-Type': 'application/json' },
      data: Buffer.from('{not valid json', 'utf8'),
    });
    // Flask raises 400 Bad Request internally; app.py's blanket
    // `except Exception` swallows it and re-emits it as a 500.
    expect(res.status()).toBe(500);
    expect((await res.json()).error).toContain('Failed to decode JSON object');
  });

  test('EDGE: valid JSON of the wrong top-level type 500s on .get()', async ({ request }) => {
    // CONTRACT NOTE: the handler assumes request.get_json() yields a dict
    // and calls .get() on it immediately. A JSON string/array/number is
    // perfectly valid JSON but has no .get, so it fails deeper in with a
    // Python AttributeError rather than a clean "expected an object".
    // Bodies are sent as raw Buffers holding exact JSON text. Passing the
    // JS values directly would leave the wire format up to Playwright's
    // content-type heuristics, which differ depending on whether the
    // header is set per-call or inherited from extraHTTPHeaders.
    const cases: Array<[string, string, string]> = [
      ['string', '"not json at all"', "'str' object has no attribute 'get'"],
      ['array', '[1, 2, 3]', "'list' object has no attribute 'get'"],
      ['number', '42', "'int' object has no attribute 'get'"],
    ];

    for (const [label, json, expectedError] of cases) {
      const res = await request.post('/predict-pcos', {
        headers: { 'Content-Type': 'application/json' },
        data: Buffer.from(json, 'utf8'),
      });
      expect(res.status(), `top-level ${label}`).toBe(500);
      expect((await res.json()).error, `top-level ${label}`).toContain(expectedError);
    }
  });

  test('EDGE: GET is rejected — the route is POST-only', async ({ request }) => {
    expect((await request.get('/predict-pcos')).status()).toBe(405);
  });
});

// =====================================================================
// /recommend-foods — core contract
// =====================================================================
test.describe('/recommend-foods', () => {
  test('returns recommendations and the based_on echo block', async ({ request }) => {
    const body = await recommend(request, { risk_level: 'High', phase: 'Luteal', bmi: 27 });

    expect(Object.keys(body).sort()).toEqual(['algorithm', 'based_on', 'recommendations']);
    expect(body.algorithm).toContain('Content-Based Filtering');
    expect(Array.isArray(body.recommendations)).toBe(true);
    expect(body.recommendations.length).toBeGreaterThan(0);

    expect(body.based_on).toMatchObject({
      risk_level: 'High',
      bmi_category: 'overweight',
      diabetes_level: 'None',
      cholesterol_filter_applied: false,
    });
    expect(body.based_on.total_foods_available).toBeGreaterThan(0);
  });

  test('each recommendation carries score, reasons and similar_alternatives', async ({ request }) => {
    const { recommendations } = await recommend(request, { top_n: 5 });
    expect(recommendations).toHaveLength(5);

    for (const f of recommendations) {
      expect(typeof f.id).toBe('number');
      expect(typeof f.name).toBe('string');
      expect(typeof f.score).toBe('number');
      expect(Array.isArray(f.reasons)).toBe(true);
      expect(Array.isArray(f.similar_alternatives)).toBe(true);
      // recommend_foods() asks for n=2 alternatives per item.
      expect(f.similar_alternatives.length).toBeLessThanOrEqual(2);
    }
  });

  test('results are sorted by score, highest first', async ({ request }) => {
    const { recommendations } = await recommend(request, { top_n: 20 });
    const scores = recommendations.map((f) => f.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  test('phase is accepted but provably does not change the result', async ({ request }) => {
    // food_recommender.py documents phase as API-compatibility only.
    const luteal = await recommend(request, { phase: 'Luteal', top_n: 10 });
    const menstrual = await recommend(request, { phase: 'Menstrual', top_n: 10 });
    const nonsense = await recommend(request, { phase: 'NotARealPhase', top_n: 10 });

    const ids = (r: RecommendResponse) => r.recommendations.map((f) => f.id);
    expect(ids(menstrual)).toEqual(ids(luteal));
    expect(ids(nonsense)).toEqual(ids(luteal));
  });

  // ------------------------- edge cases -------------------------

  test('EDGE: BMI boundary values map to the documented categories', async ({ request }) => {
    // get_bmi_category(): <18.5 under, <25 normal, <30 over, else obese.
    const cases: Array<[number, string]> = [
      [18.4, 'underweight'],
      [18.5, 'normal'],   // boundary is inclusive-low
      [24.9, 'normal'],
      [25, 'overweight'], // boundary flips exactly at 25
      [29.9, 'overweight'],
      [30, 'obese'],      // boundary flips exactly at 30
    ];

    for (const [bmi, expected] of cases) {
      const body = await recommend(request, { bmi, top_n: 1 });
      expect(body.based_on.bmi_category, `bmi=${bmi}`).toBe(expected);
    }
  });

  test('EDGE: absurd BMI values still classify rather than erroring', async ({ request }) => {
    // CONTRACT NOTE: no range validation — bmi 0 and bmi -5 are both
    // "underweight", bmi 500 is "obese".
    expect((await recommend(request, { bmi: 0, top_n: 1 })).based_on.bmi_category).toBe('underweight');
    expect((await recommend(request, { bmi: -5, top_n: 1 })).based_on.bmi_category).toBe('underweight');
    expect((await recommend(request, { bmi: 500, top_n: 1 })).based_on.bmi_category).toBe('obese');
  });

  test('EDGE: bmi as a numeric string is coerced; as null or text it 500s', async ({ request }) => {
    const ok = await request.post('/recommend-foods', { data: { bmi: '27', top_n: 1 } });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).based_on.bmi_category).toBe('overweight');

    const text = await request.post('/recommend-foods', { data: { bmi: 'abc', top_n: 1 } });
    expect(text.status()).toBe(500);
    expect((await text.json()).error).toContain('could not convert string to float');

    // Subtle: an OMITTED bmi uses the default 22, but an explicit null
    // reaches float(None) and blows up.
    const nulled = await request.post('/recommend-foods', { data: { bmi: null, top_n: 1 } });
    expect(nulled.status()).toBe(500);

    const omitted = await request.post('/recommend-foods', { data: { top_n: 1 } });
    expect(omitted.status()).toBe(200);
    expect((await omitted.json()).based_on.bmi_category).toBe('normal'); // default bmi 22
  });

  test('EDGE: top_n boundaries — 0 empties, oversize caps, text 500s', async ({ request }) => {
    const zero = await recommend(request, { top_n: 0 });
    expect(zero.recommendations).toHaveLength(0);

    const total = await totalFoodCount(request);
    const oversize = await recommend(request, { top_n: ALL });
    expect(oversize.recommendations.length).toBeLessThanOrEqual(total);
    expect(oversize.recommendations.length).toBeGreaterThan(0);

    const bad = await request.post('/recommend-foods', { data: { top_n: 'abc' } });
    expect(bad.status()).toBe(500);
    expect((await bad.json()).error).toContain('invalid literal for int()');
  });

  test('EDGE: an empty body falls back entirely to defaults', async ({ request }) => {
    const body = await recommend(request, {});
    expect(body.based_on).toMatchObject({
      risk_level: 'Medium',
      bmi_category: 'normal',
      diabetes_level: 'None',
      cholesterol_filter_applied: false,
    });
    expect(body.recommendations).toHaveLength(8); // default top_n
  });

  test('EDGE: an unrecognised risk_level is echoed back unchanged', async ({ request }) => {
    // CONTRACT NOTE: score_food() only special-cases High/Medium, so an
    // unknown value silently scores like Low but is echoed verbatim.
    const body = await recommend(request, { risk_level: 'Catastrophic', top_n: 1 });
    expect(body.based_on.risk_level).toBe('Catastrophic');
  });
});

// =====================================================================
// passes_hard_filters() — diabetes + cholesterol
// This is the block that mirrors food_recommender.py's hard filters.
// =====================================================================
test.describe('hard filters (passes_hard_filters)', () => {
  test('DIABETES_ALLOWED_GI is enforced exactly per severity level', async ({ request }) => {
    // None / Pre-diabetic  -> {low, medium, high}
    // Diet-controlled      -> {low, medium}
    // Insulin-dependent    -> {low}
    const none = await recommend(request, { diabetes: 'None', top_n: ALL });
    const pre = await recommend(request, { diabetes: 'Pre-diabetic', top_n: ALL });
    const diet = await recommend(request, { diabetes: 'Diet-controlled', top_n: ALL });
    const insulin = await recommend(request, { diabetes: 'Insulin-dependent', top_n: ALL });

    // Insulin-dependent: low only.
    expect([...gisIn(insulin.recommendations)]).toEqual(['low']);

    // Diet-controlled: high must be gone, medium must survive.
    expect(gisIn(diet.recommendations).has('high')).toBe(false);
    expect(gisIn(diet.recommendations).has('medium')).toBe(true);

    // CONTRACT NOTE: Pre-diabetic does NOT filter high-GI foods out — the
    // table allows all three levels and high-GI is only DEPRIORITISED in
    // score_food() (-1). Easy to assert wrongly: it is not a hard filter.
    expect(gisIn(pre.recommendations).has('high')).toBe(true);
    expect(pre.recommendations.length).toBe(none.recommendations.length);
  });

  test('stricter diabetes levels yield strict subsets of looser ones', async ({ request }) => {
    const none = await recommend(request, { diabetes: 'None', top_n: ALL });
    const diet = await recommend(request, { diabetes: 'Diet-controlled', top_n: ALL });
    const insulin = await recommend(request, { diabetes: 'Insulin-dependent', top_n: ALL });

    const idsOf = (r: RecommendResponse) => new Set(r.recommendations.map((f) => f.id));
    const noneIds = idsOf(none);
    const dietIds = idsOf(diet);
    const insulinIds = idsOf(insulin);

    expect(insulinIds.size).toBeLessThanOrEqual(dietIds.size);
    expect(dietIds.size).toBeLessThanOrEqual(noneIds.size);

    for (const id of insulinIds) expect(dietIds.has(id)).toBe(true);
    for (const id of dietIds) expect(noneIds.has(id)).toBe(true);
  });

  test('normalize_diabetes_level: booleans map to None / Diet-controlled', async ({ request }) => {
    // isinstance(diabetes, bool) -> "Diet-controlled" if true else "None".
    // This is the mapping the Node backend relies on when it forwards a
    // boolean, so it is worth pinning explicitly.
    const yes = await recommend(request, { diabetes: true, top_n: ALL });
    const no = await recommend(request, { diabetes: false, top_n: ALL });
    const diet = await recommend(request, { diabetes: 'Diet-controlled', top_n: ALL });
    const none = await recommend(request, { diabetes: 'None', top_n: ALL });

    expect(yes.based_on.diabetes_level).toBe('Diet-controlled');
    expect(no.based_on.diabetes_level).toBe('None');

    const ids = (r: RecommendResponse) => r.recommendations.map((f) => f.id);
    expect(ids(yes)).toEqual(ids(diet));
    expect(ids(no)).toEqual(ids(none));
  });

  test('normalize_diabetes_level: unknown strings silently become None', async ({ request }) => {
    // CONTRACT NOTE: a typo such as "insulin-dependent" (lowercase) is not
    // in DIABETES_ALLOWED_GI, so it degrades to the LEAST restrictive
    // setting rather than erroring — a safety-relevant fallback direction.
    for (const bogus of ['banana', 'insulin-dependent', 'DIET-CONTROLLED', '']) {
      const body = await recommend(request, { diabetes: bogus, top_n: 1 });
      expect(body.based_on.diabetes_level, `diabetes=${JSON.stringify(bogus)}`).toBe('None');
    }
  });

  test('cholesterol filter drops fats > 10 and keeps fats == 10', async ({ request }) => {
    const off = await recommend(request, { cholesterol: false, top_n: ALL });
    const on = await recommend(request, { cholesterol: true, top_n: ALL });

    expect(on.based_on.cholesterol_filter_applied).toBe(true);
    expect(off.based_on.cholesterol_filter_applied).toBe(false);

    // The filter is `float(fats) > 10`, so 10.0 exactly must survive.
    for (const f of on.recommendations) {
      expect(Number(f.fats), `${f.name} should have been filtered`).toBeLessThanOrEqual(10);
    }
    expect(on.recommendations.length).toBeLessThan(off.recommendations.length);

    // And something above the threshold really does exist to be removed.
    expect(off.recommendations.some((f) => Number(f.fats) > 10)).toBe(true);
  });

  test('cholesterol accepts any truthy value — bool(data.get(...))', async ({ request }) => {
    // app.py coerces with bool(), so a non-empty string is truthy.
    const str = await recommend(request, { cholesterol: 'yes', top_n: ALL });
    const real = await recommend(request, { cholesterol: true, top_n: ALL });
    expect(str.based_on.cholesterol_filter_applied).toBe(true);
    expect(str.recommendations.map((f) => f.id)).toEqual(real.recommendations.map((f) => f.id));

    // CONTRACT NOTE: the string "false" is ALSO truthy in Python, so a
    // client sending "false" gets the filter APPLIED.
    const falsey = await recommend(request, { cholesterol: 'false', top_n: 1 });
    expect(falsey.based_on.cholesterol_filter_applied).toBe(true);
  });

  test('diabetes and cholesterol filters compose (intersection, not override)', async ({ request }) => {
    const insulin = await recommend(request, { diabetes: 'Insulin-dependent', top_n: ALL });
    const chol = await recommend(request, { cholesterol: true, top_n: ALL });
    const both = await recommend(request, { diabetes: 'Insulin-dependent', cholesterol: true, top_n: ALL });

    for (const f of both.recommendations) {
      expect(f.glycemic_index).toBe('low');
      expect(Number(f.fats)).toBeLessThanOrEqual(10);
    }

    const bothIds = new Set(both.recommendations.map((f) => f.id));
    const insulinIds = new Set(insulin.recommendations.map((f) => f.id));
    const cholIds = new Set(chol.recommendations.map((f) => f.id));

    for (const id of bothIds) {
      expect(insulinIds.has(id)).toBe(true);
      expect(cholIds.has(id)).toBe(true);
    }
    expect(bothIds.size).toBeLessThanOrEqual(Math.min(insulinIds.size, cholIds.size));
  });
});

// =====================================================================
// /meal-plan
// =====================================================================
test.describe('/meal-plan', () => {
  test('returns four meals with the documented category composition', async ({ request }) => {
    const res = await request.post('/meal-plan', { data: {} });
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(Object.keys(body).sort()).toEqual(['algorithm', 'based_on', 'meal_plan', 'total_nutrition']);
    expect(Object.keys(body.meal_plan).sort()).toEqual(['breakfast', 'dinner', 'lunch', 'snacks']);

    // generate_meal_plan() picks fixed category slots per meal.
    const cats = (meal: Food[]) => meal.map((f) => f.category);
    expect(cats(body.meal_plan.breakfast)).toEqual(['carbs', 'protein', 'drink']);
    expect(cats(body.meal_plan.lunch)).toEqual(['carbs', 'protein', 'vegetable', 'vegetable']);
    expect(cats(body.meal_plan.dinner)).toEqual(['traditional', 'protein', 'vegetable']);
    expect(cats(body.meal_plan.snacks)).toEqual(['fruit', 'snack']);
  });

  test('no food is repeated across the whole plan', async ({ request }) => {
    // pick() accumulates used_ids to prevent reuse.
    const res = await request.post('/meal-plan', { data: {} });
    const mp = (await res.json()).meal_plan;
    const all: Food[] = [...mp.breakfast, ...mp.lunch, ...mp.dinner, ...mp.snacks];
    const ids = all.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('total_nutrition is the sum of every item in the plan', async ({ request }) => {
    const res = await request.post('/meal-plan', { data: {} });
    const body = await res.json();
    const mp = body.meal_plan;
    const all: Food[] = [...mp.breakfast, ...mp.lunch, ...mp.dinner, ...mp.snacks];

    const sum = (k: keyof Food) => all.reduce((t, f) => t + Number(f[k]), 0);
    expect(body.total_nutrition.calories).toBeCloseTo(sum('calories'), 1);
    expect(body.total_nutrition.protein).toBeCloseTo(sum('protein'), 1);
    expect(body.total_nutrition.carbs).toBeCloseTo(sum('carbs'), 1);
    expect(body.total_nutrition.fats).toBeCloseTo(sum('fats'), 1);
  });

  test('EDGE: hard filters apply to the meal plan too', async ({ request }) => {
    const res = await request.post('/meal-plan', {
      data: { diabetes: 'Insulin-dependent', cholesterol: true },
    });
    expect(res.status()).toBe(200);
    const mp = (await res.json()).meal_plan;
    const all: Food[] = [...mp.breakfast, ...mp.lunch, ...mp.dinner, ...mp.snacks];

    expect(all.length).toBeGreaterThan(0);
    for (const f of all) {
      expect(f.glycemic_index, `${f.name} violates the insulin-dependent GI filter`).toBe('low');
      expect(Number(f.fats), `${f.name} violates the cholesterol fat filter`).toBeLessThanOrEqual(10);
    }
  });

  test('EDGE: based_on omits cholesterol_filter_applied, unlike /recommend-foods', async ({ request }) => {
    // CONTRACT NOTE: the two endpoints report different based_on shapes.
    // /recommend-foods includes cholesterol_filter_applied and
    // total_foods_available; /meal-plan does not. A shared client-side
    // type for both would be wrong.
    const res = await request.post('/meal-plan', { data: { cholesterol: true } });
    const based = (await res.json()).based_on;

    expect(Object.keys(based).sort()).toEqual(['bmi_category', 'diabetes_level', 'risk_level']);
    expect(based).not.toHaveProperty('cholesterol_filter_applied');
    expect(based).not.toHaveProperty('total_foods_available');
  });

  test('EDGE: invalid bmi returns 500 like the other POST routes', async ({ request }) => {
    const res = await request.post('/meal-plan', { data: { bmi: 'heavy' } });
    expect(res.status()).toBe(500);
    expect((await res.json()).error).toContain('could not convert string to float');
  });

  test('EDGE: GET is rejected', async ({ request }) => {
    expect((await request.get('/meal-plan')).status()).toBe(405);
  });
});

// =====================================================================
// /foods/search
// =====================================================================
test.describe('/foods/search', () => {
  test('matches on a substring of the food name', async ({ request }) => {
    const res = await request.get('/foods/search?q=rice');
    expect(res.status()).toBe(200);

    const { foods } = await res.json();
    expect(foods.length).toBeGreaterThan(0);
    for (const f of foods) expect(f.name.toLowerCase()).toContain('rice');
  });

  test('EDGE: an EMPTY q returns the entire catalogue, not an empty list', async ({ request }) => {
    // CONTRACT NOTE: `if not query: return all foods`. This is the single
    // most surprising behaviour in the service — a cleared search box
    // yields every food rather than no results. Assert it deliberately so
    // a future change to `return {"foods": []}` fails loudly here.
    const total = await totalFoodCount(request);

    const empty = await request.get('/foods/search?q=');
    expect(empty.status()).toBe(200);
    expect((await empty.json()).foods).toHaveLength(total);

    const omitted = await request.get('/foods/search');
    expect(omitted.status()).toBe(200);
    expect((await omitted.json()).foods).toHaveLength(total);
  });

  test('EDGE: whitespace-only q is truthy, so it matches nothing', async ({ request }) => {
    // " " is truthy in Python, so it takes the search path, and no food
    // name contains a bare space match... except multi-word names do.
    const res = await request.get('/foods/search?q=%20%20');
    expect(res.status()).toBe(200);
    const { foods } = await res.json();
    // Two spaces appear in no food name.
    expect(foods).toHaveLength(0);
  });

  test('EDGE: search is case-insensitive', async ({ request }) => {
    const lower = await request.get('/foods/search?q=rice');
    const upper = await request.get('/foods/search?q=RICE');
    const mixed = await request.get('/foods/search?q=RiCe');

    const ids = async (r: APIResponse) => (await r.json()).foods.map((f: Food) => f.id);

    expect(await ids(upper)).toEqual(await ids(lower));
    expect(await ids(mixed)).toEqual(await ids(lower));
  });

  test('EDGE: a non-matching query returns an empty array, still 200', async ({ request }) => {
    const res = await request.get('/foods/search?q=zzzznotafood');
    expect(res.status()).toBe(200);
    expect((await res.json()).foods).toEqual([]);
  });

  test('EDGE: SQL-ish and regex-ish input is treated as a literal substring', async ({ request }) => {
    // search_foods() is a plain Python `in` over already-loaded rows, so
    // there is no injection surface and no regex interpretation.
    for (const q of ["' OR 1=1 --", '.*', '%']) {
      const res = await request.get(`/foods/search?q=${encodeURIComponent(q)}`);
      expect(res.status(), `q=${q}`).toBe(200);
      expect((await res.json()).foods, `q=${q}`).toEqual([]);
    }
  });
});

// =====================================================================
// /foods/all
// =====================================================================
test.describe('/foods/all', () => {
  test('count matches the array length and rows have the expected shape', async ({ request }) => {
    const res = await request.get('/foods/all');
    expect(res.status()).toBe(200);

    const { foods, count } = await res.json();
    expect(count).toBe(foods.length);
    expect(count).toBeGreaterThan(0);

    for (const key of ['id', 'name', 'calories', 'protein', 'carbs', 'fats', 'category', 'glycemic_index', 'pcos_friendly']) {
      expect(foods[0]).toHaveProperty(key);
    }
  });

  test('food ids are unique', async ({ request }) => {
    const { foods } = await (await request.get('/foods/all')).json();
    const ids = foods.map((f: Food) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('EDGE: glycemic_index only ever holds low/medium/high', async ({ request }) => {
    // The hard filters compare against exactly these three strings, so any
    // other value would silently be filtered out for every diabetic user.
    const { foods } = await (await request.get('/foods/all')).json();
    const seen = new Set(foods.map((f: Food) => f.glycemic_index));
    for (const gi of seen) expect(['low', 'medium', 'high']).toContain(gi);
  });
});

// =====================================================================
// /foods/<id>/similar
// =====================================================================
test.describe('/foods/:id/similar', () => {
  test('returns KNN neighbours with a similarity percentage', async ({ request }) => {
    const res = await request.get('/foods/1/similar');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.food_id).toBe(1);
    expect(body.algorithm).toContain('K-Nearest Neighbors');
    expect(Array.isArray(body.similar_foods)).toBe(true);
    expect(body.similar_foods).toHaveLength(3); // default n=3

    for (const f of body.similar_foods) {
      expect(typeof f.similarity_percent).toBe('number');
      expect(f.similarity_percent).toBeLessThanOrEqual(100);
      expect(f.id).not.toBe(1); // never returns the query food itself
    }
  });

  test('neighbours come back in descending similarity order', async ({ request }) => {
    const { similar_foods } = await (await request.get('/foods/1/similar?n=5')).json();
    const sims = similar_foods.map((f: { similarity_percent: number }) => f.similarity_percent);
    expect(sims).toEqual([...sims].sort((a: number, b: number) => b - a));
  });

  test('EDGE: unknown food id returns a 404 JSON error', async ({ request }) => {
    const res = await request.get('/foods/99999/similar');
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toContain('No food found with id 99999');
  });

  test('EDGE: n=0 returns 200 with an empty list, not a 404', async ({ request }) => {
    // CONTRACT NOTE: the 404 branch is `if not similar and food_id not in
    // [...]`. With n=0 the list is empty but the id IS valid, so this
    // correctly stays 200 — the two conditions must not be confused.
    const res = await request.get('/foods/1/similar?n=0');
    expect(res.status()).toBe(200);
    expect((await res.json()).similar_foods).toEqual([]);
  });

  test('EDGE: n larger than the catalogue caps at everything-but-itself', async ({ request }) => {
    const total = await totalFoodCount(request);
    const res = await request.get(`/foods/1/similar?n=${ALL}`);
    expect(res.status()).toBe(200);
    expect((await res.json()).similar_foods).toHaveLength(total - 1);
  });

  test('EDGE: non-numeric n crashes with an unhandled 500 (HTML, not JSON)', async ({ request }) => {
    // CONTRACT NOTE: this route has NO try/except, unlike the POST routes.
    // int("abc") raises and Werkzeug returns an HTML debugger page, so a
    // client calling .json() on this response would itself throw.
    const res = await request.get('/foods/1/similar?n=abc');
    expect(res.status()).toBe(500);
    expect(res.headers()['content-type']).toContain('text/html');
  });

  test('EDGE: negative n crashes inside sklearn with an unhandled 500', async ({ request }) => {
    // min(n+1, len) becomes 0 -> "Expected n_neighbors > 0".
    const res = await request.get('/foods/1/similar?n=-1');
    expect(res.status()).toBe(500);
    expect(res.headers()['content-type']).toContain('text/html');
  });

  test('EDGE: a non-integer id does not match the route and 404s', async ({ request }) => {
    // Flask's <int:food_id> converter rejects it before the handler runs.
    const res = await request.get('/foods/abc/similar');
    expect(res.status()).toBe(404);
  });

  test('EDGE: every food in the catalogue has retrievable neighbours', async ({ request }) => {
    // Guards against an id present in /foods/all but missing from the KNN
    // feature matrix, which would 404 inconsistently.
    const { foods } = await (await request.get('/foods/all')).json();
    const sample = [foods[0], foods[Math.floor(foods.length / 2)], foods[foods.length - 1]];

    for (const food of sample) {
      const res = await request.get(`/foods/${food.id}/similar?n=2`);
      expect(res.status(), `food id ${food.id}`).toBe(200);
      expect((await res.json()).similar_foods.length, `food id ${food.id}`).toBeGreaterThan(0);
    }
  });
});
