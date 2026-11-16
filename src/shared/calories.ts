/**
 * The Calories channel under `/{locale}/calories/{id}/`: calories and nutrients per 100 g and per typical serving for
 * common foods, answering "calories in banana / バナナ カロリー / 香蕉熱量" searches. Numbers are a snapshot of USDA
 * FoodData Central (public domain, CC0 1.0) written by `node scripts/fetch-calories.mjs` to `calories-data.json`,
 * which rides in the calories pack (never the main bundle). Ids are English slugs; raw vs cooked is part of the id
 * where it matters (`white-rice-cooked`, `chicken-breast-raw`).
 */

export const CALORIES_SEGMENT = "calories";

export const CALORIE_GROUPS = [
  {
    id: "fruits",
    foods: [
      "apple", "banana", "orange", "grapes", "strawberries", "blueberries", "watermelon", "mango", "pineapple", "pear",
      "peach", "cherries", "kiwi", "avocado", "lemon", "grapefruit", "papaya", "raspberries", "blackberries", "plum",
      "cantaloupe", "honeydew", "pomegranate", "dates", "lychee", "persimmon", "tangerine", "guava", "jackfruit",
      "durian", "coconut-meat", "figs", "apricot", "raisins",
    ],
  },
  {
    id: "vegetables",
    foods: [
      "broccoli", "carrot", "potato-baked", "potato-boiled", "sweet-potato-baked", "tomato", "cucumber", "spinach",
      "lettuce", "cabbage", "onion", "garlic", "red-bell-pepper", "sweet-corn-cooked", "green-peas", "cauliflower",
      "zucchini", "mushrooms", "eggplant", "celery", "kale", "asparagus", "green-beans", "pumpkin", "bok-choy",
      "bean-sprouts", "kimchi", "wakame", "daikon", "taro-cooked",
    ],
  },
  {
    id: "grains",
    foods: [
      "white-rice-cooked", "white-rice-uncooked", "brown-rice-cooked", "short-grain-rice-cooked", "glutinous-rice-cooked",
      "oats", "oatmeal-cooked", "white-bread", "whole-wheat-bread", "rye-bread", "bagel", "croissant", "pancake",
      "spaghetti-cooked", "pasta-dry", "egg-noodles-cooked", "rice-noodles-cooked", "soba-cooked", "somen-cooked",
      "instant-ramen", "quinoa-cooked", "couscous-cooked", "barley-cooked", "corn-tortilla", "flour-tortilla",
      "popcorn", "flour",
    ],
  },
  {
    id: "meat",
    foods: [
      "chicken-breast-roasted", "chicken-breast-raw", "chicken-thigh-roasted", "chicken-wing-roasted", "ground-beef-cooked",
      "sirloin-steak", "pork-chop", "pork-belly-raw", "ground-pork-cooked", "bacon", "ham", "lamb-leg-roasted",
      "turkey-breast-roasted", "duck-roasted", "hot-dog", "beef-jerky",
    ],
  },
  {
    id: "seafood",
    foods: [
      "salmon-cooked", "salmon-raw", "tuna-canned", "tuna-raw", "cod-cooked", "tilapia-cooked", "mackerel-cooked",
      "sardines-canned", "eel-cooked", "shrimp-cooked", "crab-cooked", "lobster-cooked", "scallops-cooked", "squid-raw",
      "oysters-raw", "clams-cooked",
    ],
  },
  {
    id: "dairy",
    foods: [
      "egg", "egg-boiled", "egg-fried", "egg-scrambled", "egg-white", "egg-yolk", "whole-milk", "milk-2-percent",
      "skim-milk", "greek-yogurt", "plain-yogurt", "cheddar", "mozzarella", "cottage-cheese", "cream-cheese", "butter",
      "ice-cream",
    ],
  },
  {
    id: "legumes",
    foods: [
      "tofu-firm", "tofu-soft", "soy-milk", "edamame", "natto", "tempeh", "black-beans", "chickpeas", "lentils",
      "kidney-beans", "mung-beans", "adzuki-beans", "hummus",
    ],
  },
  {
    id: "nuts",
    foods: [
      "almonds", "walnuts", "peanuts", "cashews", "pistachios", "macadamia", "pecans", "chestnuts-roasted",
      "peanut-butter", "sunflower-seeds", "pumpkin-seeds", "chia-seeds", "flaxseed", "sesame-seeds",
    ],
  },
  { id: "fats", foods: ["olive-oil", "canola-oil", "coconut-oil", "sesame-oil", "lard", "mayonnaise"] },
  {
    id: "drinks",
    foods: [
      "coffee", "black-tea", "green-tea", "orange-juice", "apple-juice", "cola", "beer", "red-wine", "coconut-water",
      "almond-milk",
    ],
  },
  { id: "sweets", foods: ["sugar", "honey", "maple-syrup", "jam", "dark-chocolate", "milk-chocolate", "soy-sauce", "ketchup"] },
] as const;

export type CalorieGroupId = (typeof CALORIE_GROUPS)[number]["id"];
export type FoodId = (typeof CALORIE_GROUPS)[number]["foods"][number];

export const FOODS: readonly FoodId[] = CALORIE_GROUPS.flatMap((group) => group.foods);

/** A calories page: the hub, one food, or none. */
export type CaloriesPage = FoodId | "hub" | null;

export function isFoodId(value: string): value is FoodId {
  return (FOODS as readonly string[]).includes(value);
}

export function foodGroupOf(id: FoodId): CalorieGroupId {
  return CALORIE_GROUPS.find((group) => (group.foods as readonly string[]).includes(id))!.id;
}

/** The day `scripts/fetch-calories.mjs` last wrote calories-data.json (sitemap lastmod, the "data as of" line). */
export const CALORIES_SNAPSHOT = "2026-11-16";

/** Foods the site footer links directly (Keyword Planner volume); names are core-pack `caloriesFocus.*`. */
export const CALORIES_FOCUS = [
  "apple",
  "banana",
  "white-rice-cooked",
  "egg",
  "avocado",
  "chicken-breast-roasted",
  "tofu-firm",
  "sweet-potato-baked",
] as const satisfies readonly FoodId[];

/** The health tools every calories page links to (and that link back to the hub). */
export const CALORIES_TOOLS = ["tdee", "macro", "calories-burned", "bmi", "water-intake"] as const;
