/**
 * Pose and style reference: hairstyles, expressions, hand gestures, outfits, poses and camera angles,
 * under `/{locale}/reference/{id}/`. Each entry explains the look and shows photos hotlinked from mfan8.com
 * (never copied to cv.cm). Code says ref, URLs say reference.
 */
export const REF_SEGMENT = "reference";

export const REF_GROUPS = [
  { id: "hairstyles", entries: ["twin-tails", "hime-cut", "braids", "blunt-bangs", "m-bangs", "ahoge", "hair-bow"] },
  { id: "hair-colors", entries: ["black-hair", "brown-hair", "blonde-hair", "pink-hair", "blue-hair", "purple-hair", "green-hair", "white-hair", "gray-hair"] },
  { id: "expressions", entries: ["wink", "pout", "tongue-out", "crybaby", "tennen", "dojikko"] },
  { id: "gestures", entries: ["peace-sign", "heart-hands", "ily-sign", "chin-pose", "cat-paw-pose", "cheek-poke", "shush"] },
  { id: "outfits", entries: ["maid-outfit", "sailor-uniform", "school-uniform", "uniform", "dress", "puffy-skirt", "gown", "victorian-dress", "lolita-fashion", "pajamas", "nurse-outfit", "christmas-outfit", "cat-ears", "bunny-ears"] },
  { id: "traditional", entries: ["hanfu", "qipao", "kimono", "guzhuang"] },
  { id: "poses", entries: ["standing-pose", "sitting-pose", "kneeling-pose", "squatting-pose", "leaning-pose", "hugging-pose", "jumping-pose", "lying-down-pose", "lying-on-stomach-pose"] },
  { id: "angles", entries: ["front-view", "three-quarter-view", "side-view", "back-view", "side-profile", "looking-back-pose"] },
] as const;

export type RefGroupId = (typeof REF_GROUPS)[number]["id"];
export type RefId = (typeof REF_GROUPS)[number]["entries"][number];

export const REF_ENTRIES: readonly RefId[] = REF_GROUPS.flatMap((group) => group.entries);

/** A reference page: the hub, one entry, or none. */
export type RefPage = RefId | "hub" | null;

export type RefMeta = {
  /** Tag path on mfan8.com for "more photos" (unencoded; encodeURI when linking). */
  mfan8: string;
  /** Plain English prompt keywords for AI image tools, shown as copyable text; not translated. */
  prompt: string[];
  related: RefId[];
};

export const REF_PUBLISHED = "2026-10-31";

export const REF_META: Record<RefId, RefMeta> = {
  "twin-tails": { mfan8: "萌点:双马尾", prompt: ["twintails", "low twintails", "hair ribbon"], related: ["braids", "hair-bow", "blunt-bangs", "pink-hair"] },
  "hime-cut": { mfan8: "萌点:黑长直", prompt: ["hime cut", "long hair", "straight hair", "black hair", "blunt bangs", "sidelocks"], related: ["blunt-bangs", "black-hair", "kimono", "side-profile"] },
  braids: { mfan8: "萌点:麻花辫", prompt: ["braid", "twin braids", "single braid", "side braid"], related: ["twin-tails", "hair-bow", "hanfu", "brown-hair"] },
  "blunt-bangs": { mfan8: "萌点:齐刘海", prompt: ["blunt bangs", "straight-cut bangs"], related: ["hime-cut", "m-bangs", "twin-tails", "black-hair"] },
  "m-bangs": { mfan8: "萌点:M字刘海", prompt: ["m-shaped bangs", "bangs", "hair between eyes"], related: ["blunt-bangs", "ahoge", "hime-cut"] },
  ahoge: { mfan8: "萌点:呆毛", prompt: ["ahoge", "single hair strand sticking up"], related: ["tennen", "m-bangs", "twin-tails", "dojikko"] },
  "hair-bow": { mfan8: "萌点:蝴蝶结", prompt: ["hair bow", "hair ribbon", "large bow"], related: ["twin-tails", "lolita-fashion", "braids", "puffy-skirt"] },
  "black-hair": { mfan8: "发色:黑色头发", prompt: ["black hair"], related: ["hime-cut", "brown-hair", "blunt-bangs", "hanfu"] },
  "brown-hair": { mfan8: "发色:棕色头发", prompt: ["brown hair", "light brown hair"], related: ["black-hair", "blonde-hair", "braids"] },
  "blonde-hair": { mfan8: "发色:金色头发", prompt: ["blonde hair", "golden hair"], related: ["brown-hair", "white-hair", "victorian-dress"] },
  "pink-hair": { mfan8: "发色:粉色头发", prompt: ["pink hair", "light pink hair"], related: ["purple-hair", "blue-hair", "twin-tails"] },
  "blue-hair": { mfan8: "发色:蓝色头发", prompt: ["blue hair", "light blue hair"], related: ["green-hair", "purple-hair", "white-hair"] },
  "purple-hair": { mfan8: "发色:紫色头发", prompt: ["purple hair", "lavender hair"], related: ["pink-hair", "blue-hair", "black-hair"] },
  "green-hair": { mfan8: "发色:绿色头发", prompt: ["green hair", "aqua hair"], related: ["blue-hair", "twin-tails", "white-hair"] },
  "white-hair": { mfan8: "发色:白色头发", prompt: ["white hair", "silver hair"], related: ["gray-hair", "blonde-hair", "blue-hair"] },
  "gray-hair": { mfan8: "发色:灰色头发", prompt: ["grey hair", "ash grey hair"], related: ["white-hair", "black-hair", "purple-hair"] },
  wink: { mfan8: "萌点:眨眼", prompt: ["one eye closed", "wink"], related: ["tongue-out", "peace-sign", "pout"] },
  pout: { mfan8: "萌点:嘟嘴", prompt: ["pout", "puffed cheeks"], related: ["wink", "crybaby", "cheek-poke"] },
  "tongue-out": { mfan8: "萌点:吐舌头", prompt: ["tongue out", "tehepero", "one eye closed"], related: ["wink", "peace-sign", "dojikko"] },
  crybaby: { mfan8: "萌点:爱哭鬼", prompt: ["tears", "teary eyes", "crying"], related: ["pout", "tennen", "dojikko"] },
  tennen: { mfan8: "萌点:天然呆", prompt: ["dazed", "head tilt", "blank expression"], related: ["dojikko", "ahoge", "crybaby"] },
  dojikko: { mfan8: "萌点:平地摔", prompt: ["tripping", "sitting on floor", "embarrassed"], related: ["tennen", "tongue-out", "crybaby"] },
  "peace-sign": { mfan8: "萌点:剪刀手", prompt: ["v", "peace sign", "double v"], related: ["heart-hands", "wink", "chin-pose"] },
  "heart-hands": { mfan8: "萌点:心形手势", prompt: ["heart hands", "finger heart"], related: ["peace-sign", "ily-sign", "cheek-poke"] },
  "ily-sign": { mfan8: "萌点:ILOVEYOU手势", prompt: ["i love you hand sign", "thumb index and pinky raised"], related: ["heart-hands", "peace-sign", "shush"] },
  "chin-pose": { mfan8: "萌点:八字手势", prompt: ["hand on own chin", "l-shaped hand under chin"], related: ["peace-sign", "heart-hands", "three-quarter-view"] },
  "cat-paw-pose": { mfan8: "萌点:猫爪爪", prompt: ["paw pose", "cat pose", "curled fingers"], related: ["cat-ears", "bunny-ears", "cheek-poke"] },
  "cheek-poke": { mfan8: "萌点:戳戳脸", prompt: ["finger to cheek", "cheek poking"], related: ["pout", "heart-hands", "cat-paw-pose"] },
  shush: { mfan8: "萌点:嘘", prompt: ["shushing", "index finger to lips"], related: ["wink", "ily-sign", "side-profile"] },
  "maid-outfit": { mfan8: "服饰:女仆装", prompt: ["maid", "maid headdress", "apron", "frilled apron"], related: ["lolita-fashion", "puffy-skirt", "cat-ears", "hair-bow"] },
  "sailor-uniform": { mfan8: "服饰:水手服", prompt: ["serafuku", "sailor collar", "neckerchief", "pleated skirt"], related: ["school-uniform", "uniform", "twin-tails"] },
  "school-uniform": { mfan8: "服饰:校服", prompt: ["school uniform", "blazer", "pleated skirt", "necktie"], related: ["sailor-uniform", "uniform", "braids"] },
  uniform: { mfan8: "服饰:制服", prompt: ["uniform", "military uniform", "idol clothes"], related: ["school-uniform", "sailor-uniform", "nurse-outfit"] },
  dress: { mfan8: "服饰:连衣裙", prompt: ["dress", "sundress", "frilled dress"], related: ["puffy-skirt", "gown", "victorian-dress"] },
  "puffy-skirt": { mfan8: "服饰:蓬蓬裙", prompt: ["puffy skirt", "petticoat", "frilled skirt"], related: ["lolita-fashion", "dress", "maid-outfit"] },
  gown: { mfan8: "服饰:礼服", prompt: ["ball gown", "evening gown", "wedding dress"], related: ["dress", "victorian-dress", "standing-pose"] },
  "victorian-dress": { mfan8: "服饰:洋装", prompt: ["victorian", "frilled dress", "long sleeves", "bonnet"], related: ["lolita-fashion", "gown", "puffy-skirt"] },
  "lolita-fashion": { mfan8: "服饰:洛丽塔", prompt: ["lolita fashion", "sweet lolita", "classic lolita", "gothic lolita"], related: ["victorian-dress", "puffy-skirt", "hair-bow", "maid-outfit"] },
  pajamas: { mfan8: "服饰:睡衣", prompt: ["pajamas", "sleepwear", "animal hood"], related: ["hugging-pose", "cat-ears", "bunny-ears"] },
  "nurse-outfit": { mfan8: "服饰:护士服", prompt: ["nurse", "nurse cap"], related: ["uniform", "maid-outfit", "school-uniform"] },
  "christmas-outfit": { mfan8: "服饰:圣诞服", prompt: ["santa costume", "santa hat", "fur trim"], related: ["dress", "bunny-ears", "puffy-skirt"] },
  "cat-ears": { mfan8: "萌点:猫耳朵", prompt: ["cat ears", "fake animal ears", "kemonomimi"], related: ["cat-paw-pose", "bunny-ears", "maid-outfit"] },
  "bunny-ears": { mfan8: "萌点:兔耳朵", prompt: ["rabbit ears", "fake animal ears", "animal ear hairband"], related: ["cat-ears", "pajamas", "hair-bow"] },
  hanfu: { mfan8: "服饰:汉服", prompt: ["hanfu", "ruqun", "chinese clothes", "hair stick"], related: ["guzhuang", "qipao", "kimono", "braids"] },
  qipao: { mfan8: "服饰:旗袍", prompt: ["china dress", "qipao", "mandarin collar"], related: ["hanfu", "kimono", "gown"] },
  kimono: { mfan8: "服饰:和服", prompt: ["kimono", "yukata", "obi"], related: ["hanfu", "qipao", "hime-cut"] },
  guzhuang: { mfan8: "服饰:古装", prompt: ["chinese clothes", "wuxia", "hair ornament", "flowing sleeves"], related: ["hanfu", "qipao", "looking-back-pose"] },
  "standing-pose": { mfan8: "站姿", prompt: ["standing", "full body", "contrapposto"], related: ["leaning-pose", "front-view", "three-quarter-view"] },
  "sitting-pose": { mfan8: "坐姿", prompt: ["sitting", "on chair", "crossed legs"], related: ["kneeling-pose", "squatting-pose", "standing-pose"] },
  "kneeling-pose": { mfan8: "跪姿", prompt: ["kneeling", "seiza", "on one knee"], related: ["sitting-pose", "squatting-pose", "kimono"] },
  "squatting-pose": { mfan8: "蹲姿", prompt: ["squatting", "crouching"], related: ["kneeling-pose", "sitting-pose", "cat-paw-pose"] },
  "leaning-pose": { mfan8: "靠姿", prompt: ["leaning", "against wall", "leaning forward"], related: ["standing-pose", "side-view", "looking-back-pose"] },
  "hugging-pose": { mfan8: "抱姿", prompt: ["hug", "hugging object", "stuffed toy"], related: ["pajamas", "sitting-pose", "heart-hands"] },
  "jumping-pose": { mfan8: "跳姿", prompt: ["jumping", "midair", "dynamic pose"], related: ["standing-pose", "peace-sign", "front-view"] },
  "lying-down-pose": { mfan8: "躺姿", prompt: ["lying", "on back", "on grass"], related: ["lying-on-stomach-pose", "sitting-pose", "side-profile"] },
  "lying-on-stomach-pose": { mfan8: "趴姿", prompt: ["lying on stomach", "on stomach", "head rest"], related: ["lying-down-pose", "kneeling-pose", "chin-pose"] },
  "front-view": { mfan8: "正面照", prompt: ["facing viewer", "straight-on", "from front"], related: ["three-quarter-view", "side-view", "standing-pose"] },
  "three-quarter-view": { mfan8: "斜侧面照", prompt: ["three-quarter view", "looking at viewer"], related: ["front-view", "side-view", "side-profile"] },
  "side-view": { mfan8: "侧面照", prompt: ["from side", "full body"], related: ["side-profile", "three-quarter-view", "back-view"] },
  "back-view": { mfan8: "背面照", prompt: ["from behind", "back"], related: ["looking-back-pose", "side-view", "hime-cut"] },
  "side-profile": { mfan8: "侧脸照", prompt: ["profile", "from side", "face in profile"], related: ["side-view", "three-quarter-view", "shush"] },
  "looking-back-pose": { mfan8: "回眸照", prompt: ["looking back", "looking over shoulder", "from behind"], related: ["back-view", "three-quarter-view", "guzhuang"] },
};

export function isRefId(value: string): value is RefId {
  return (REF_ENTRIES as readonly string[]).includes(value);
}

export function refGroupOf(id: RefId): RefGroupId {
  return REF_GROUPS.find((group) => (group.entries as readonly string[]).includes(id))!.id;
}

export function mfan8Href(path: string): string {
  return `https://www.mfan8.com/${encodeURI(path)}`;
}
