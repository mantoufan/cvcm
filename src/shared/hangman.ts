/**
 * Hangman: word lists, letter matching and game state. The page keeps the state and draws it; nothing here touches
 * the DOM, so tests can play whole games.
 */

export const WORD_LANGS = ["en", "es", "id"] as const;
export type WordLang = (typeof WORD_LANGS)[number];

export const CATEGORIES = ["animals", "food", "countries", "sports", "jobs", "home"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Wrong guesses allowed: head, body, two arms, two legs. */
export const MAX_MISSES = 6;

const LIST = (s: string): readonly string[] => s.trim().split(/\s*,\s*/);

/** Everyday words a child would know, upper case. Accents stay (they are shown); matching folds them away. */
export const WORDS: Record<WordLang, Record<Category, readonly string[]>> = {
  en: {
    animals: LIST(`ELEPHANT, GIRAFFE, KANGAROO, PENGUIN, DOLPHIN, OCTOPUS, BUTTERFLY, SQUIRREL, CROCODILE, CHEETAH, HAMSTER,
      RABBIT, TURTLE, ZEBRA, MONKEY, PANDA, KOALA, LOBSTER, PEACOCK, HEDGEHOG, FLAMINGO, JELLYFISH, OSTRICH, CAMEL, OWL`),
    food: LIST(`PINEAPPLE, STRAWBERRY, BANANA, AVOCADO, BROCCOLI, SANDWICH, PANCAKE, SPAGHETTI, CHOCOLATE, POPCORN,
      CARROT, CUCUMBER, MUSHROOM, WATERMELON, BLUEBERRY, NOODLES, CHEESE, BURGER, COOKIE, YOGURT, PUMPKIN, LEMON, PIZZA`),
    countries: LIST(`AUSTRALIA, BRAZIL, CANADA, EGYPT, FRANCE, GERMANY, ICELAND, INDIA, INDONESIA, JAPAN, KENYA, MEXICO,
      MOROCCO, NORWAY, PERU, PORTUGAL, SPAIN, SWEDEN, THAILAND, VIETNAM, NEW ZEALAND, ARGENTINA, SOUTH KOREA`),
    sports: LIST(`BASKETBALL, FOOTBALL, BASEBALL, VOLLEYBALL, BADMINTON, TENNIS, SWIMMING, CYCLING, SKATEBOARDING,
      SURFING, BOXING, KARATE, ARCHERY, BOWLING, GOLF, HOCKEY, RUGBY, CRICKET, MARATHON, GYMNASTICS, SKIING, FENCING`),
    jobs: LIST(`TEACHER, DOCTOR, NURSE, FIREFIGHTER, ASTRONAUT, CARPENTER, PLUMBER, PILOT, FARMER, BAKER, DENTIST,
      LIBRARIAN, ENGINEER, SCIENTIST, PHOTOGRAPHER, MUSICIAN, ARCHITECT, MECHANIC, JOURNALIST, CHEF, LAWYER, PAINTER`),
    home: LIST(`UMBRELLA, BLANKET, PILLOW, CANDLE, MIRROR, CURTAIN, KETTLE, TOASTER, BOOKSHELF, WARDROBE, LADDER,
      SCISSORS, TOOTHBRUSH, BACKPACK, CALENDAR, CUSHION, DOORBELL, LANTERN, TELEPHONE, ENVELOPE, KEYBOARD, TEAPOT`),
  },
  es: {
    animals: LIST(`ELEFANTE, JIRAFA, CANGURO, PINGÜINO, DELFÍN, PULPO, MARIPOSA, ARDILLA, COCODRILO, GUEPARDO, HÁMSTER,
      CONEJO, TORTUGA, CEBRA, MONO, PANDA, LANGOSTA, PAVO REAL, ERIZO, FLAMENCO, MEDUSA, AVESTRUZ, CAMELLO, BÚHO, ARAÑA`),
    food: LIST(`PIÑA, FRESA, PLÁTANO, AGUACATE, BRÓCOLI, BOCADILLO, TORTILLA, ESPAGUETIS, CHOCOLATE, PALOMITAS,
      ZANAHORIA, PEPINO, CHAMPIÑÓN, SANDÍA, ARÁNDANO, QUESO, GALLETA, YOGUR, CALABAZA, LIMÓN, EMPANADA, MANZANA, CEREZA`),
    countries: LIST(`AUSTRALIA, BRASIL, CANADÁ, EGIPTO, FRANCIA, ALEMANIA, ISLANDIA, INDIA, INDONESIA, JAPÓN, KENIA,
      MÉXICO, MARRUECOS, NORUEGA, PERÚ, PORTUGAL, ESPAÑA, SUECIA, TAILANDIA, VIETNAM, ARGENTINA, COLOMBIA, CHILE`),
    sports: LIST(`BALONCESTO, FÚTBOL, BÉISBOL, VOLEIBOL, BÁDMINTON, TENIS, NATACIÓN, CICLISMO, SURF, BOXEO, KÁRATE,
      TIRO CON ARCO, BOLOS, GOLF, HOCKEY, RUGBY, MARATÓN, GIMNASIA, ESQUÍ, ESGRIMA, ATLETISMO, PATINAJE, AJEDREZ`),
    jobs: LIST(`MAESTRO, MÉDICO, ENFERMERA, BOMBERO, ASTRONAUTA, CARPINTERO, FONTANERO, PILOTO, AGRICULTOR, PANADERO,
      DENTISTA, BIBLIOTECARIO, INGENIERO, CIENTÍFICO, FOTÓGRAFO, MÚSICO, ARQUITECTO, MECÁNICO, PERIODISTA, COCINERO, ABOGADO`),
    home: LIST(`PARAGUAS, MANTA, ALMOHADA, VELA, ESPEJO, CORTINA, TETERA, TOSTADORA, ESTANTERÍA, ARMARIO, ESCALERA,
      TIJERAS, CEPILLO DE DIENTES, MOCHILA, CALENDARIO, COJÍN, TIMBRE, LINTERNA, TELÉFONO, SOBRE, TECLADO, SILLA, CUCHARA`),
  },
  id: {
    animals: LIST(`GAJAH, JERAPAH, KANGGURU, PENGUIN, LUMBA-LUMBA, GURITA, KUPU-KUPU, TUPAI, BUAYA, HARIMAU, KELINCI,
      KURA-KURA, ZEBRA, MONYET, PANDA, KOALA, LOBSTER, MERAK, LANDAK, FLAMINGO, UBUR-UBUR, BURUNG UNTA, UNTA, BURUNG HANTU`),
    food: LIST(`NANAS, STROBERI, PISANG, ALPUKAT, BROKOLI, ROTI LAPIS, PANEKUK, NASI GORENG, COKELAT, BERONDONG JAGUNG,
      WORTEL, MENTIMUN, JAMUR, SEMANGKA, BAKSO, KEJU, BURGER, KUE KERING, YOGURT, LABU, JERUK NIPIS, RENDANG, MARTABAK`),
    countries: LIST(`AUSTRALIA, BRASIL, KANADA, MESIR, PRANCIS, JERMAN, ISLANDIA, INDIA, INDONESIA, JEPANG, KENYA, MEKSIKO,
      MAROKO, NORWEGIA, PERU, PORTUGAL, SPANYOL, SWEDIA, THAILAND, VIETNAM, SELANDIA BARU, ARGENTINA, KOREA SELATAN`),
    sports: LIST(`BOLA BASKET, SEPAK BOLA, BISBOL, BOLA VOLI, BULU TANGKIS, TENIS, RENANG, BERSEPEDA, SELANCAR, TINJU,
      KARATE, PANAHAN, BOWLING, GOLF, HOKI, RUGBI, KRIKET, MARATON, SENAM, SKI, ANGGAR, PENCAK SILAT, SEPAK TAKRAW`),
    jobs: LIST(`GURU, DOKTER, PERAWAT, PEMADAM KEBAKARAN, ASTRONAUT, TUKANG KAYU, PILOT, PETANI, TUKANG ROTI, DOKTER GIGI,
      PUSTAKAWAN, INSINYUR, ILMUWAN, FOTOGRAFER, MUSISI, ARSITEK, MONTIR, WARTAWAN, KOKI, PENGACARA, PELUKIS, NELAYAN`),
    home: LIST(`PAYUNG, SELIMUT, BANTAL, LILIN, CERMIN, GORDEN, CEREK, PEMANGGANG ROTI, RAK BUKU, LEMARI, TANGGA, GUNTING,
      SIKAT GIGI, RANSEL, KALENDER, BEL PINTU, LENTERA, TELEPON, AMPLOP, PAPAN KETIK, TEKO, SAPU, KIPAS ANGIN`),
  },
};

export const ALPHABET: Record<WordLang, readonly string[]> = {
  en: [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
  es: [..."ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"],
  id: [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
};

/**
 * The key a letter is guessed with: upper case, accents folded (Á → A, Ü → U), but Ñ stays its own letter in every
 * language (it has its own key in Spanish; in a typed English word it still needs Ñ). Anything else is "".
 */
export function letterKey(ch: string): string {
  const up = ch.toLocaleUpperCase("en");
  if (up === "Ñ") return "Ñ";
  // Đ (Vietnamese) has no decomposition; it is guessed with D like the accented vowels with their base letter.
  if (up === "Đ") return "D";
  const base = up.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /^[A-Z]$/.test(base) ? base : "";
}

/**
 * A secret word someone typed for a friend: letters and single spaces or hyphens, 2–30 letters. Returns the word in
 * upper case with spaces collapsed, or null when it holds digits or symbols, or is too short or too long.
 */
export function cleanWord(raw: string): string | null {
  // NFC first: text pasted from a macOS file name keeps Ñ and accents as two code points.
  // One hyphen joins two parts ("X-RAY"); runs of hyphens or hyphens at the ends would show as symbols.
  const word = raw.normalize("NFC").replace(/\s+/g, " ").replace(/ ?-[ -]*/g, "-").replace(/^[ -]+|[ -]+$/g, "")
    .toLocaleUpperCase("en");
  const chars = [...word];
  const letters = chars.filter((c) => letterKey(c));
  if (letters.length < 2 || letters.length > 30) return null;
  if (chars.some((c) => !letterKey(c) && c !== " " && c !== "-")) return null;
  return word;
}

export type Status = "playing" | "won" | "lost";

export type Game = {
  readonly word: string;
  /** Letters guessed so far, as letter keys, in order (hinted letters too). */
  readonly guessed: readonly string[];
  /** Hints taken; each costs one wrong guess. */
  readonly hints: number;
};

export function newGame(word: string): Game {
  return { word, guessed: [], hints: 0 };
}

/** The distinct letter keys in a word. */
export function lettersOf(word: string): Set<string> {
  const out = new Set<string>();
  for (const c of word) {
    const k = letterKey(c);
    if (k) out.add(k);
  }
  return out;
}

export function misses(g: Game): string[] {
  const inWord = lettersOf(g.word);
  return g.guessed.filter((k) => !inWord.has(k));
}

/** Wrong guesses plus hints: the parts of the drawing shown. */
export function strikes(g: Game): number {
  return misses(g).length + g.hints;
}

export function status(g: Game): Status {
  if (strikes(g) >= MAX_MISSES) return "lost";
  const got = new Set(g.guessed);
  for (const k of lettersOf(g.word)) if (!got.has(k)) return "playing";
  return "won";
}

/** Adds a guess. A letter already tried, a non-letter, or any guess after the game ended leaves the game as it was. */
export function guess(g: Game, ch: string): Game {
  const k = letterKey(ch);
  if (!k || g.guessed.includes(k) || status(g) !== "playing") return g;
  return { ...g, guessed: [...g.guessed, k] };
}

/**
 * The word as the player sees it: one entry per character, the letter when it has been guessed (or the game is over),
 * null for a hidden letter. Spaces and hyphens are always shown.
 */
export function reveal(g: Game, all = false): (string | null)[] {
  const got = new Set(g.guessed);
  return [...g.word].map((c) => {
    const k = letterKey(c);
    return !k || all || got.has(k) ? c : null;
  });
}

/**
 * Reveals one hidden letter, chosen by `pick(n)`, for the price of one strike. Refused (game unchanged) when the hint
 * would use the last strike, or when one letter is left (the hint would just win the game).
 */
export function takeHint(g: Game, pick: (n: number) => number): Game {
  if (!canHint(g)) return g;
  const left = unguessed(g);
  return { ...g, guessed: [...g.guessed, left[pick(left.length)]!], hints: g.hints + 1 };
}

export function canHint(g: Game): boolean {
  return status(g) === "playing" && strikes(g) < MAX_MISSES - 1 && unguessed(g).length > 1;
}

/** The word's letters not tried yet. */
function unguessed(g: Game): string[] {
  const got = new Set(g.guessed);
  return [...lettersOf(g.word)].filter((k) => !got.has(k));
}

/** Every word for a language and category ("all" = every category), each with its category. */
export function pool(lang: WordLang, category: Category | "all"): { word: string; category: Category }[] {
  const cats = category === "all" ? CATEGORIES : [category];
  return cats.flatMap((c) => WORDS[lang][c].map((word) => ({ word, category: c })));
}
