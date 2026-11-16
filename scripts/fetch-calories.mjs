// Snapshots the numbers behind /{locale}/calories/ into src/shared/calories-data.json (and the CALORIES_SNAPSHOT
// date in src/shared/calories.ts). Run by hand to refresh (`npm run calories:fetch`), then commit. Pages never call
// FoodData Central.
//
// Source: USDA FoodData Central bulk downloads (https://fdc.nal.usda.gov/download-datasets). FDC data are in the
// public domain under CC0 1.0 (https://fdc.nal.usda.gov/api-guide, "Licensing"); USDA asks to be listed as the source.
//
// Rule per food (FOODS below names the SR Legacy record by its NDB number):
//   - nutrients come from the Foundation Foods record with the same NDB number when one exists and has an energy
//     value (Energy kcal, else Atwater Specific, else Atwater General); otherwise from the SR Legacy record;
//   - the serving's gram weight always comes from the SR Legacy record's portion data (household measures such as
//     "medium (7" to 7-7/8" long)"), picked by `portion` (a case-insensitive substring of the portion text) and shown
//     with a translated unit (`unit`, `n`); no portion, no serving (the page shows per 100 g only);
//   - a missing nutrient is stored as null and shown as "—"; nothing is estimated (kJ is converted from kcal at
//     4.184 kJ/kcal only when the record has no kJ value).
// Set FDC_DIR to a folder that already holds the two unzipped JSON files to skip the downloads.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FOUNDATION_RELEASE = "2026-10-29";
const SR_RELEASE = "2018-04";
const FOUNDATION_ZIP = `https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_${FOUNDATION_RELEASE}.zip`;
const SR_ZIP = `https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_${SR_RELEASE}.zip`;

/** slug → SR Legacy NDB number, the portion to use as the serving, and how the page names it. */
const FOODS = {
  // Fruits
  apple: { ndb: "9003", portion: 'medium (3" dia)', unit: "medium" },
  banana: { ndb: "9040", portion: "medium (7", unit: "medium" },
  orange: { ndb: "9200", portion: 'fruit (2-5/8" dia)', unit: "whole" },
  grapes: { ndb: "9132", portion: "cup", unit: "cup" },
  strawberries: { ndb: "9316", portion: "cup, halves", unit: "cup" },
  blueberries: { ndb: "9050", portion: "cup", unit: "cup" },
  watermelon: { ndb: "9326", portion: "cup, diced", unit: "cup" },
  mango: { ndb: "9176", portion: "fruit without refuse", unit: "whole" },
  pineapple: { ndb: "9266", portion: "cup, chunks", unit: "cup" },
  pear: { ndb: "9252", portion: "medium", unit: "medium" },
  peach: { ndb: "9236", portion: "medium", unit: "medium" },
  cherries: { ndb: "9070", portion: "cup, without pits", unit: "cup" },
  kiwi: { ndb: "9148", portion: "fruit (2", unit: "whole" },
  avocado: { ndb: "9037", portion: "avocado, NS", unit: "whole" },
  lemon: { ndb: "9150", portion: 'fruit (2-1/8" dia)', unit: "whole" },
  grapefruit: { ndb: "9112", portion: "fruit (3-3/4", amount: 0.5, unit: "half", n: 1 },
  papaya: { ndb: "9226", portion: 'cup 1" pieces', unit: "cup" },
  raspberries: { ndb: "9302", portion: "cup", unit: "cup" },
  blackberries: { ndb: "9042", portion: "cup", unit: "cup" },
  plum: { ndb: "9279", portion: "fruit (2-1/8", unit: "whole" },
  cantaloupe: { ndb: "9181", portion: "cup, cubes", unit: "cup" },
  honeydew: { ndb: "9184", portion: "cup, diced", unit: "cup" },
  pomegranate: { ndb: "9286", portion: "pomegranate (4", unit: "whole" },
  dates: { ndb: "9421", portion: "date, pitted", unit: "piece" },
  lychee: { ndb: "9164", portion: "fruit without refuse", unit: "piece" },
  persimmon: { ndb: "9263", portion: "fruit (2-1/2", unit: "whole" },
  tangerine: { ndb: "9218", portion: "medium", unit: "medium" },
  guava: { ndb: "9139", portion: "fruit, without refuse", unit: "whole" },
  jackfruit: { ndb: "9144", portion: "cup, sliced", unit: "cup" },
  durian: { ndb: "9422", portion: "cup, chopped or diced", unit: "cup" },
  "coconut-meat": { ndb: "12104", portion: 'piece (2" x 2"', unit: "piece" },
  figs: { ndb: "9089", portion: "medium", unit: "medium" },
  apricot: { ndb: "9021", portion: "apricot", unit: "whole" },
  raisins: { ndb: "9298", portion: "oz (60 raisins)", unit: "oz" },
  // Vegetables
  broccoli: { ndb: "11090", portion: "cup chopped", unit: "cup" },
  carrot: { ndb: "11124", portion: "medium", unit: "medium" },
  "potato-baked": { ndb: "11674", portion: "potato medium", unit: "medium" },
  "potato-boiled": { ndb: "11367", portion: "medium", unit: "medium" },
  "sweet-potato-baked": { ndb: "11508", portion: "medium", unit: "medium" },
  tomato: { ndb: "11529", portion: "medium whole", unit: "medium" },
  cucumber: { ndb: "11205", portion: "cucumber (8", unit: "whole" },
  spinach: { ndb: "11457", portion: "cup", unit: "cup" },
  lettuce: { ndb: "11251", portion: "cup shredded", unit: "cup" },
  cabbage: { ndb: "11109", portion: "cup, chopped", unit: "cup" },
  onion: { ndb: "11282", portion: "medium", unit: "medium" },
  garlic: { ndb: "11215", portion: "clove", unit: "clove" },
  "red-bell-pepper": { ndb: "11821", portion: "medium", unit: "medium" },
  "sweet-corn-cooked": { ndb: "11168", portion: "ear medium", unit: "ear" },
  "green-peas": { ndb: "11304", portion: "cup", unit: "cup" },
  cauliflower: { ndb: "11135", portion: "cup chopped", unit: "cup" },
  zucchini: { ndb: "11477", portion: "medium", unit: "medium" },
  mushrooms: { ndb: "11260", portion: "cup, pieces or slices", unit: "cup" },
  eggplant: { ndb: "11209", portion: "cup, cubes", unit: "cup" },
  celery: { ndb: "11143", portion: "stalk, medium", unit: "stalk" },
  kale: { ndb: "11233", portion: "cup", unit: "cup" },
  asparagus: { ndb: "11011", portion: "cup", unit: "cup" },
  "green-beans": { ndb: "11052", portion: 'cup 1/2" pieces', unit: "cup" },
  pumpkin: { ndb: "11422", portion: "cup", unit: "cup" },
  "bok-choy": { ndb: "11116", portion: "cup, shredded", unit: "cup" },
  "bean-sprouts": { ndb: "11043", portion: "cup", unit: "cup" },
  kimchi: { ndb: "11118", portion: "cup", unit: "cup" },
  wakame: { ndb: "11669", portion: "tbsp", amount: 2, unit: "tbsp", n: 2 },
  daikon: { ndb: "11430", portion: "cup slices", unit: "cup" },
  "taro-cooked": { ndb: "11519", portion: "cup, sliced", unit: "cup" },
  // Grains, rice, noodles and bread
  "white-rice-cooked": { ndb: "20045", portion: "cup", unit: "cup" },
  "white-rice-uncooked": { ndb: "20044", portion: "cup", unit: "cup" },
  "brown-rice-cooked": { ndb: "20037", portion: "cup", unit: "cup" },
  "short-grain-rice-cooked": { ndb: "20053", portion: "cup", unit: "cup" },
  "glutinous-rice-cooked": { ndb: "20055", portion: "cup", unit: "cup" },
  oats: { ndb: "8120", portion: "cup", amount: 1, unit: "cup" },
  "oatmeal-cooked": { ndb: "8180", portion: "cup", amount: 1, unit: "cup" },
  "white-bread": { ndb: "18069", portion: "slice", unit: "slice" },
  "whole-wheat-bread": { ndb: "18075", portion: "slice", unit: "slice" },
  "rye-bread": { ndb: "18060", portion: "slice, regular", unit: "slice" },
  bagel: { ndb: "18001", portion: "medium bagel", unit: "medium" },
  croissant: { ndb: "18239", portion: "croissant, medium", unit: "medium" },
  pancake: { ndb: "18293", portion: 'pancake (6" dia)', unit: "piece" },
  "spaghetti-cooked": { ndb: "20121", portion: "cup spaghetti not packed", unit: "cup" },
  "pasta-dry": { ndb: "20120", portion: "oz", amount: 2, unit: "oz", n: 2 },
  "egg-noodles-cooked": { ndb: "20110", portion: "cup", unit: "cup" },
  "rice-noodles-cooked": { ndb: "20134", portion: "cup", unit: "cup" },
  "soba-cooked": { ndb: "20115", portion: "cup", unit: "cup" },
  "somen-cooked": { ndb: "20117", portion: "cup", unit: "cup" },
  "instant-ramen": { ndb: "6583", portion: "package without flavor packet", unit: "block" },
  "quinoa-cooked": { ndb: "20137", portion: "cup", unit: "cup" },
  "couscous-cooked": { ndb: "20029", portion: "cup, cooked", unit: "cup" },
  "barley-cooked": { ndb: "20006", portion: "cup", unit: "cup" },
  "corn-tortilla": { ndb: "18363", portion: "tortilla", unit: "piece" },
  "flour-tortilla": { ndb: "18364", portion: "tortilla medium", unit: "piece" },
  popcorn: { ndb: "19034", portion: "cup", unit: "cup" },
  flour: { ndb: "20081", portion: "cup", unit: "cup" },
  // Meat and poultry
  "chicken-breast-roasted": { ndb: "5064", portion: "breast, bone and skin removed", amount: 0.5, unit: "half-breast", n: 1 },
  "chicken-breast-raw": { ndb: "5062", portion: "oz", amount: 4, unit: "oz", n: 4 },
  "chicken-thigh-roasted": { ndb: "5098", portion: "thigh without skin", unit: "piece" },
  "chicken-wing-roasted": { ndb: "5103", portion: "oz", amount: 3, unit: "oz", n: 3 },
  "ground-beef-cooked": { ndb: "23568", portion: "patty", unit: "patty" },
  "sirloin-steak": { ndb: "13930", portion: "oz", amount: 3, unit: "oz", n: 3 },
  "pork-chop": { ndb: "10038", portion: "chop without refuse", unit: "piece" },
  "pork-belly-raw": { ndb: "10005", portion: "oz", amount: 4, unit: "oz", n: 4 },
  "ground-pork-cooked": { ndb: "10220", portion: "oz", amount: 3, unit: "oz", n: 3 },
  bacon: { ndb: "10860", portion: "slice cooked", unit: "slice" },
  ham: { ndb: "7029", portion: "slice", unit: "slice" },
  "lamb-leg-roasted": { ndb: "17016", portion: "oz", amount: 3, unit: "oz", n: 3 },
  "turkey-breast-roasted": { ndb: "5220", portion: "oz", amount: 3, unit: "oz", n: 3 },
  "duck-roasted": { ndb: "5142", portion: "cup, chopped or diced", unit: "cup" },
  "hot-dog": { ndb: "7022", portion: "hot dog", unit: "piece" },
  "beef-jerky": { ndb: "19002", portion: "piece, large", unit: "piece" },
  // Fish and seafood
  "salmon-cooked": { ndb: "15237", portion: "oz", amount: 3, unit: "oz", n: 3 },
  "salmon-raw": { ndb: "15236", portion: "oz", amount: 3, unit: "oz", n: 3 },
  "tuna-canned": { ndb: "15121", portion: "can", amount: 1, unit: "can", exact: true },
  "tuna-raw": { ndb: "15127", portion: "oz", amount: 3, unit: "oz", n: 3 },
  "cod-cooked": { ndb: "15016", portion: "fillet", unit: "fillet" },
  "tilapia-cooked": { ndb: "15262", portion: "fillet", unit: "fillet" },
  "mackerel-cooked": { ndb: "15047", portion: "fillet", unit: "fillet" },
  "sardines-canned": { ndb: "15088", portion: "can (3.75 oz)", unit: "can" },
  "eel-cooked": { ndb: "15026", portion: "fillet", unit: "fillet" },
  "shrimp-cooked": { ndb: "15271", portion: "oz", amount: 3, unit: "oz", n: 3 },
  "crab-cooked": { ndb: "15137", portion: "oz", amount: 3, unit: "oz", n: 3 },
  "lobster-cooked": { ndb: "15148", portion: "oz", amount: 3, unit: "oz", n: 3 },
  "scallops-cooked": { ndb: "90240", portion: "oz", amount: 3, unit: "oz", n: 3 },
  "squid-raw": { ndb: "15175", portion: "oz", amount: 3, unit: "oz", n: 3 },
  "oysters-raw": { ndb: "15167", portion: "medium", amount: 6, unit: "medium", n: 6 },
  "clams-cooked": { ndb: "15159", portion: "oz", amount: 3, unit: "oz", n: 3 },
  // Eggs and dairy
  egg: { ndb: "1123", portion: "large", unit: "large" },
  "egg-boiled": { ndb: "1129", portion: "large", unit: "large" },
  "egg-fried": { ndb: "1128", portion: "large", unit: "large" },
  "egg-scrambled": { ndb: "1132", portion: "large", unit: "large" },
  "egg-white": { ndb: "1124", portion: "large", unit: "large" },
  "egg-yolk": { ndb: "1125", portion: "large", unit: "large" },
  "whole-milk": { ndb: "1077", portion: "cup", unit: "cup" },
  "milk-2-percent": { ndb: "1079", portion: "cup", unit: "cup" },
  "skim-milk": { ndb: "1085", portion: "cup", unit: "cup" },
  "greek-yogurt": { ndb: "1256", portion: "container", unit: "container" },
  "plain-yogurt": { ndb: "1116", portion: "container (6 oz)", unit: "container" },
  cheddar: { ndb: "1009", portion: "slice (1 oz)", unit: "slice" },
  mozzarella: { ndb: "1026", portion: "oz", amount: 1, unit: "oz" },
  "cottage-cheese": { ndb: "1012", portion: "oz", amount: 4, unit: "oz", n: 4 },
  "cream-cheese": { ndb: "1017", portion: "tbsp", exact: true, unit: "tbsp" },
  butter: { ndb: "1001", portion: "tbsp", unit: "tbsp" },
  "ice-cream": { ndb: "19095", portion: "serving 1/2 cup", unit: "cup", n: 0.5 },
  // Legumes and soy
  "tofu-firm": { ndb: "16126", portion: "cup", amount: 0.5, unit: "cup", n: 0.5 },
  "tofu-soft": { ndb: "16127", portion: "piece", unit: "piece" },
  "soy-milk": { ndb: "16120", portion: "cup", unit: "cup" },
  edamame: { ndb: "11212", portion: "cup", unit: "cup" },
  natto: { ndb: "16113", portion: "cup", unit: "cup" },
  tempeh: { ndb: "16114", portion: "cup", unit: "cup" },
  "black-beans": { ndb: "16015", portion: "cup", unit: "cup" },
  chickpeas: { ndb: "16057", portion: "cup", unit: "cup" },
  lentils: { ndb: "16070", portion: "cup", unit: "cup" },
  "kidney-beans": { ndb: "16028", portion: "cup", unit: "cup" },
  "mung-beans": { ndb: "16081", portion: "cup", unit: "cup" },
  "adzuki-beans": { ndb: "16002", portion: "cup", unit: "cup" },
  hummus: { ndb: "16158", portion: "tbsp", unit: "tbsp" },
  // Nuts and seeds
  almonds: { ndb: "12061", portion: "oz", amount: 1, unit: "oz" },
  walnuts: { ndb: "12155", portion: "oz", amount: 1, unit: "oz" },
  peanuts: { ndb: "16390", portion: "oz", amount: 1, unit: "oz" },
  cashews: { ndb: "12087", portion: "oz", amount: 1, unit: "oz" },
  pistachios: { ndb: "12151", portion: "oz", amount: 1, unit: "oz" },
  macadamia: { ndb: "12131", portion: "oz", amount: 1, unit: "oz" },
  pecans: { ndb: "12142", portion: "oz", amount: 1, unit: "oz" },
  "chestnuts-roasted": { ndb: "12167", portion: "kernels", amount: 10, unit: "piece", n: 10 },
  "peanut-butter": { ndb: "16398", portion: "tbsp", amount: 2, unit: "tbsp", n: 2 },
  "sunflower-seeds": { ndb: "12036", portion: "cup", exact: true, unit: "cup" },
  "pumpkin-seeds": { ndb: "12014", portion: "oz", amount: 1, unit: "oz" },
  "chia-seeds": { ndb: "12006", portion: "oz", amount: 1, unit: "oz" },
  flaxseed: { ndb: "12220", portion: "tbsp, ground", unit: "tbsp" },
  "sesame-seeds": { ndb: "12023", portion: "tbsp", unit: "tbsp" },
  // Oils and fats
  "olive-oil": { ndb: "4053", portion: "tablespoon", unit: "tbsp" },
  "canola-oil": { ndb: "4582", portion: "tbsp", unit: "tbsp" },
  "coconut-oil": { ndb: "4047", portion: "tbsp", unit: "tbsp" },
  "sesame-oil": { ndb: "4058", portion: "tablespoon", unit: "tbsp" },
  lard: { ndb: "4002", portion: "tbsp", unit: "tbsp" },
  mayonnaise: { ndb: "4025", portion: "tbsp", unit: "tbsp" },
  // Drinks
  coffee: { ndb: "14209", portion: "cup (8 fl oz)", unit: "cup" },
  "black-tea": { ndb: "14355", portion: "cup (8 fl oz)", unit: "cup" },
  "green-tea": { ndb: "14278", portion: "cup", unit: "cup" },
  "orange-juice": { ndb: "9206", portion: "cup", unit: "cup" },
  "apple-juice": { ndb: "9016", portion: "cup", unit: "cup" },
  cola: { ndb: "14148", portion: "can or bottle (12 fl oz)", unit: "can" },
  beer: { ndb: "14003", portion: "can", unit: "can" },
  "red-wine": { ndb: "14096", portion: "serving (5 fl oz)", unit: "glass" },
  "coconut-water": { ndb: "12119", portion: "cup", unit: "cup" },
  "almond-milk": { ndb: "14091", portion: "cup", unit: "cup" },
  // Sweets and condiments
  sugar: { ndb: "19335", portion: "tsp", unit: "tsp" },
  honey: { ndb: "19296", portion: "tbsp", unit: "tbsp" },
  "maple-syrup": { ndb: "19353", portion: "tbsp", unit: "tbsp" },
  jam: { ndb: "19297", portion: "tbsp", unit: "tbsp" },
  "dark-chocolate": { ndb: "19904", portion: "oz", amount: 1, unit: "oz" },
  "milk-chocolate": { ndb: "19120", portion: "bar (1.55 oz)", unit: "bar" },
  "soy-sauce": { ndb: "16123", portion: "tbsp", unit: "tbsp" },
  ketchup: { ndb: "11935", portion: "tbsp", unit: "tbsp" },
};

/** Nutrient numbers (FDC `nutrient.number`) per field, first present wins. */
const NUTRIENTS = {
  protein: ["203"],
  fat: ["204"],
  satFat: ["606"],
  carbs: ["205", "205.2"],
  fiber: ["291"],
  sugars: ["269", "269.3"],
  sodium: ["307"],
  potassium: ["306"],
  calcium: ["301"],
  iron: ["303"],
  vitC: ["401"],
  alcohol: ["221"],
};

const cacheDir = process.env.FDC_DIR ?? join(tmpdir(), "cvcm-fdc");
mkdirSync(cacheDir, { recursive: true });

async function jsonFile(url) {
  const name = url.split("/").at(-1).replace(/\.zip$/, ".json");
  const found = readdirSync(cacheDir, { recursive: true }).find((f) => String(f).endsWith(name));
  if (found) return JSON.parse(readFileSync(join(cacheDir, String(found)), "utf8"));
  const zip = join(cacheDir, url.split("/").at(-1));
  if (!existsSync(zip)) {
    console.log(`fetch-calories: downloading ${url}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(600_000) });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  }
  execFileSync("unzip", ["-o", "-q", zip, "-d", cacheDir]);
  const unzipped = readdirSync(cacheDir, { recursive: true }).find((f) => String(f).endsWith(name));
  if (!unzipped) throw new Error(`fetch-calories: ${name} not found in ${zip}`);
  return JSON.parse(readFileSync(join(cacheDir, String(unzipped)), "utf8"));
}

const round = (value, digits = 3) => (value == null ? null : Math.round(value * 10 ** digits) / 10 ** digits);

function amounts(food) {
  const out = new Map();
  for (const n of food.foodNutrients ?? []) {
    if (typeof n.amount === "number" && n.nutrient?.number) out.set(String(n.nutrient.number), n.amount);
  }
  return out;
}

function energy(values) {
  for (const number of ["208", "958", "957"]) if (values.has(number)) return { kcal: values.get(number), field: number };
  return null;
}

/** The portion text as FDC writes it ("medium (3" dia)", "cup, chopped", "slice cooked"). */
function portionText(p) {
  const unit = p.measureUnit?.name && p.measureUnit.name !== "undetermined" ? p.measureUnit.name : "";
  return [unit, p.modifier ?? "", p.portionDescription ?? ""].filter(Boolean).join(" ").trim();
}

function pickPortion(slug, spec, sr) {
  const want = spec.portion.toLowerCase();
  const amount = spec.amount ?? 1;
  const candidates = (sr.foodPortions ?? []).filter((p) => (p.amount ?? p.value ?? 1) === amount && p.gramWeight > 0);
  const text = (p) => portionText(p).toLowerCase();
  const hit = spec.exact
    ? candidates.find((p) => text(p) === want)
    : candidates.find((p) => text(p) === want) ?? candidates.find((p) => text(p).startsWith(want)) ?? candidates.find((p) => text(p).includes(want));
  if (!hit) {
    throw new Error(`fetch-calories: ${slug}: no portion "${spec.portion}" × ${amount} in SR ${sr.fdcId}; has ${(sr.foodPortions ?? []).map((p) => `${p.amount} ${portionText(p)} = ${p.gramWeight} g`).join(" | ")}`);
  }
  return { unit: spec.unit, n: spec.n ?? amount, g: round(hit.gramWeight, 1), usda: `${hit.amount ?? 1} ${portionText(hit)}` };
}

const foundation = (await jsonFile(FOUNDATION_ZIP)).FoundationFoods;
const sr = (await jsonFile(SR_ZIP)).SRLegacyFoods;
const srByNdb = new Map(sr.map((f) => [String(f.ndbNumber), f]));
const foundationByNdb = new Map();
for (const f of foundation) {
  if (f.ndbNumber == null) continue;
  const key = String(f.ndbNumber);
  if (foundationByNdb.has(key)) throw new Error(`fetch-calories: two Foundation foods share NDB ${key}`);
  foundationByNdb.set(key, f);
}

const catalog = readFileSync(join(root, "src/shared/calories.ts"), "utf8");
const groupsSrc = /export const CALORIE_GROUPS = \[([\s\S]*?)\] as const;/.exec(catalog)?.[1] ?? "";
const slugs = [...groupsSrc.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]).filter((s) => !/^(fruits|vegetables|grains|meat|seafood|dairy|legumes|nuts|fats|drinks|sweets)$/.test(s));
for (const slug of slugs) if (!FOODS[slug]) throw new Error(`fetch-calories: ${slug} is in calories.ts but not in FOODS`);
for (const slug of Object.keys(FOODS)) if (!slugs.includes(slug)) throw new Error(`fetch-calories: ${slug} is in FOODS but not in calories.ts`);

const foods = {};
const problems = [];
let fromFoundation = 0;
for (const slug of slugs) {
  const spec = FOODS[slug];
  const legacy = srByNdb.get(spec.ndb);
  if (!legacy) throw new Error(`fetch-calories: ${slug}: no SR Legacy food with NDB ${spec.ndb}`);
  const newer = foundationByNdb.get(spec.ndb);
  const newerValues = newer ? amounts(newer) : null;
  const useFoundation = Boolean(newer && energy(newerValues));
  const record = useFoundation ? newer : legacy;
  const values = useFoundation ? newerValues : amounts(legacy);
  const e = energy(values);
  if (!e) throw new Error(`fetch-calories: ${slug}: no energy value in FDC ${record.fdcId}`);
  if (useFoundation) fromFoundation++;
  const n = { kcal: round(e.kcal, 1), kj: values.has("268") ? round(values.get("268"), 0) : Math.round(e.kcal * 4.184) };
  for (const [field, numbers] of Object.entries(NUTRIENTS)) {
    const number = numbers.find((num) => values.has(num));
    n[field] = number ? round(values.get(number)) : null;
  }
  if (!n.alcohol) delete n.alcohol;
  foods[slug] = {
    fdc: record.fdcId,
    type: useFoundation ? "foundation" : "sr",
    desc: record.description,
    energy: e.field,
    n,
    serving: null,
  };
  try {
    foods[slug].serving = { ...pickPortion(slug, spec, legacy), fdc: legacy.fdcId };
  } catch (err) {
    problems.push(err.message);
  }
}
if (problems.length) throw new Error(problems.join("\n"));

const today = new Date().toISOString().slice(0, 10);
const out = {
  snapshot: today,
  releases: { foundation: FOUNDATION_RELEASE, sr: SR_RELEASE },
  foods,
};
writeFileSync(join(root, "src/shared/calories-data.json"), `${JSON.stringify(out, null, 1)}\n`);
writeFileSync(
  join(root, "src/shared/calories.ts"),
  catalog.replace(/export const CALORIES_SNAPSHOT = "[^"]*";/, `export const CALORIES_SNAPSHOT = "${today}";`),
);
console.log(`fetch-calories: ${slugs.length} foods (${fromFoundation} from Foundation Foods ${FOUNDATION_RELEASE}, ${slugs.length - fromFoundation} from SR Legacy ${SR_RELEASE}), snapshot ${today}`);
