/**
 * apply_food_audit.js   (v2 - GI values verified against a citable source)
 * ---------------------------------------------------------------
 * Applies the food database audit to backend/data/foods_seed.json.
 *
 * WHAT CHANGED IN v2
 * Six glycaemic index values were previously proposed from general
 * knowledge. They have now been checked against measured values from:
 *
 *   Prof. Sagarika Ekanayake, "Glycaemic Indices of Sri Lankan Foods",
 *   Department of Biochemistry, Faculty of Medical Sciences,
 *   University of Sri Jayewardenepura.
 *   https://medical.sjp.ac.lk/my-scripts/glycaemic-index/index.html
 *
 * THREE of the six earlier proposals were WRONG and are corrected here.
 * Thresholds used by that source (glucose standard):
 *   Low = 55 or less | Medium = 56-69 | High = 70 or above
 *
 * USAGE
 *   node apply_food_audit.js --report    # show changes, write nothing
 *   node apply_food_audit.js             # write foods_seed_audited.json
 */

const fs = require("fs");
const path = require("path");

const IN = path.join(__dirname, "data", "foods_seed.json");
const OUT = path.join(__dirname, "data", "foods_seed_audited.json");
const reportOnly = process.argv.includes("--report");

const DROP = [
  [74, 36, "Guava Raw duplicates Guava"],
  [71, 37, "Pomegranate Raw duplicates Pomegranate"],
  [32, 72, "Papaya 55 kcal is an unlabelled portion; keep per-100g row 72"],
  [73, 35, "Avocado Raw duplicates Avocado; 160 kcal/100g is standard"],
  [47, 53, "Coconut Sambol and Pol Sambol are the same dish"],
  [39, 69, "Coconut Water 46 kcal is a 240ml glass; keep per-100g row 69"],
];

const RENAME = { 72: "Papaya", 69: "Coconut Water", 26: "Bitter Gourd Curry" };

const PER_100G = [31, 33, 34, 35, 36, 37, 38, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 72];
const PER_ITEM = { 10: "1 egg, approx. 50 g", 8: "approx. 2 slices, 40-50 g" };
const PER_SNACK = {
  13: "approx. 28 g (groundnuts are 567 kcal/100 g)",
  45: "approx. 30 g (dark chocolate is 546 kcal/100 g)",
  46: "approx. 28 g (almonds are 579 kcal/100 g)",
  48: "approx. 28 g (walnuts are 654 kcal/100 g)",
  49: "approx. 10 g, 1 tbsp (flaxseed is 534 kcal/100 g)",
  50: "approx. 32 g (pumpkin seeds are 559 kcal/100 g)",
};

const SJP = "Ekanayake S., Glycaemic Indices of Sri Lankan Foods, Univ. of Sri Jayewardenepura";

// id: [value, measuredGI, source, note]
const GI_VERIFIED = {
  3: ["high", "67-91",
      SJP + "; Hettiaratchi, Ekanayake & Welihinda (2009) Ceylon Med J 54(2):39-43",
      "String hopper meal, red rice flour. Measured as a MEAL with coconut sambol, egg and kiri hodi."],

  5: ["high", "72-82",
      SJP + "; Widanagamage, Ekanayake & Welihinda (2009) Int J Food Sci Nutr 60(S4):215-223",
      "Pittu, rice flour with coconut. Kurakkan pittu would differ; specify the flour."],

  8: ["high", "70-82",
      SJP + "; Hettiaratchi, Ekanayake & Welihinda (2009) Int J Food Sci Nutr 60(S4):21-30",
      "Wholemeal bread. Sits just above the 70 threshold."],

  52: ["medium", "62-74",
      SJP + "; Widanagamage, Ekanayake & Welihinda (2009) Int J Food Sci Nutr 60(S4):215-223",
      "PROXY: Olu milk rice, not true kiribath (olu flour, not white rice). Earlier 'high' proposal REVERSED; original 'medium' stands."],

  55: ["low", "42-52",
      SJP + "; Widanagamage, Ekanayake & Welihinda (2009) Int J Food Sci Nutr 60(S4):215-223",
      "Boiled breadfruit with coconut scrapings. Earlier 'high' proposal REVERSED; measured LOW."],

  54: ["low", "48-64",
      SJP + "; jack fruit meal",
      "Boiled jack fruit, seeds, coconut scrapings, onion salad. Measured LOW; original 'medium' lowered."],
};

const GI_UNVERIFIED = {
  44: "Jak Fruit Juice: no measured value. The jack fruit MEAL value does not transfer, since juicing removes fibre. Original label retained.",
  2:  "Red Rice: a red rice meal value exists in the SJP database but was not retrieved. Check manually.",
  57: "Manioc Curry: a manioc meal value exists in the SJP database but was not retrieved. Check manually.",
  22: "Beetroot Curry: not in the SJP database. Original label retained.",
  34: "Wood Apple: not in the SJP database. Original label retained.",
  59: "Ash Plantain Curry: not in the SJP database. Original label retained.",
  80: "Jackfruit Seeds Curry: seeds featured in the jack fruit meal but were not measured alone.",
};

function basisFor(id) {
  if (PER_100G.includes(id)) return ["per_100g", "100 g"];
  if (PER_ITEM[id]) return ["per_item", PER_ITEM[id]];
  if (PER_SNACK[id]) return ["per_portion", PER_SNACK[id]];
  return ["per_portion", "NOT RECORDED - must be weighed"];
}

if (!fs.existsSync(IN)) {
  console.error("Cannot find " + IN + "\nRun export_foods.js first.");
  process.exit(1);
}

const rows = JSON.parse(fs.readFileSync(IN, "utf8"));
console.log("Loaded " + rows.length + " rows\n");

const dropIds = new Set(DROP.map(function (d) { return d[0]; }));
const out = [];
let renamed = 0, verified = 0, reversed = 0, unweighed = 0;

console.log("REMOVED (exact duplicates):");
DROP.forEach(function (d) {
  const row = rows.find(function (r) { return r.id === d[0]; });
  console.log("  " + d[0] + " " + (row ? row.name : "(missing)").padEnd(22) + " -> keep " + d[1] + ". " + d[2]);
});

console.log("\nGI VALUES VERIFIED AGAINST A CITABLE SOURCE:");
rows.forEach(function (r) {
  if (!GI_VERIFIED[r.id]) return;
  const v = GI_VERIFIED[r.id];
  const flag = v[3].indexOf("REVERSED") >= 0 ? "   <-- earlier proposal REVERSED" : "";
  console.log("  " + String(r.id).padEnd(3) + " " + r.name.padEnd(22) +
              r.glycemic_index.padEnd(8) + "-> " + v[0].padEnd(8) + "(GI " + v[1] + ")" + flag);
  if (flag) reversed++;
  verified++;
});

rows.forEach(function (r) {
  if (dropIds.has(r.id)) return;
  const g = Object.assign({}, r);

  if (RENAME[r.id]) { g.name = RENAME[r.id]; renamed++; }

  const b = basisFor(r.id);
  g.serving_basis = b[0];
  g.serving_size_note = b[1];
  if (b[1].indexOf("NOT RECORDED") === 0) unweighed++;

  g.gi_original = r.glycemic_index;

  if (GI_VERIFIED[r.id]) {
    const v = GI_VERIFIED[r.id];
    g.gi_proposed = v[0];
    g.gi_measured = v[1];
    g.gi_source = v[2];
    g.gi_review_note = v[3];
  } else {
    g.gi_proposed = r.glycemic_index;
    g.gi_measured = null;
    g.gi_source = "";
    g.gi_review_note = GI_UNVERIFIED[r.id] || "Not checked against a measured source.";
  }

  g.fibre_g = null;
  out.push(g);
});

console.log("\nSUMMARY");
console.log("  rows in                   : " + rows.length);
console.log("  duplicates removed        : " + (rows.length - out.length));
console.log("  rows out                  : " + out.length);
console.log("  renamed                   : " + renamed);
console.log("  GI values now SOURCED     : " + verified);
console.log("  earlier proposals REVERSED: " + reversed);
console.log("  GI still unsourced        : " + (out.length - verified));
console.log("  rows with no weight       : " + unweighed + " of " + out.length);

console.log("\nCAVEAT: the source measures MEALS (string hoppers served with sambol,");
console.log("egg and kiri hodi; jack fruit served with seeds and coconut). Your");
console.log("database records single foods. State this mismatch in the thesis.");

if (reportOnly) {
  console.log("\n--report set, no file written.");
} else {
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
  console.log("\nWrote " + OUT);
}