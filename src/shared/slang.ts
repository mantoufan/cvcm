import type { Locale } from "./locale";

/**
 * The Memes channel under `/{locale}/memes/{id}/` (the slang dictionary until 2026-11-13; `/slang/` 301s here): what a
 * meme or an internet word means, where and when it started and how people use it, written for "what is X" searches. Entries were chosen from Google Ads
 * Keyword Planner volume (2026-11), plus 334424044, a Cantonese song lyric people ask about.
 */
export const SLANG_SEGMENT = "memes";

/**
 * Earlier URL segments that 301 to SLANG_SEGMENT (the column launched at /slang/ on 2026-11-10). Not "meme": that is the
 * meme generator tool's path.
 */
export const LEGACY_SLANG_SEGMENTS: readonly string[] = ["slang"];

export const SLANG_GROUPS = [
  { id: "numbers", entries: ["334424044", "666", "520"] },
  { id: "abbreviations", entries: ["yyds", "xswl", "awsl", "dbq", "cpdd"] },
  { id: "society", entries: ["neijuan", "tangping", "bailan", "niuma", "caotai-banzi", "fanersai", "chigua"] },
  { id: "mood", entries: ["emo", "pofang", "qingxu-jiazhi", "i-ren-e-ren", "sheniu", "hajimi"] },
  { id: "love", entries: ["baiyueguang", "haiwang", "zhanan", "puxinnan", "lianainao", "tiangou", "pua"] },
  { id: "english", entries: ["67", "rizz", "fomo", "crush", "ootd", "situationship", "npc", "delulu", "iykyk", "smh", "simp", "no-cap"] },
  { id: "brainrot", entries: ["italian-brainrot", "tung-tung-tung-sahur", "tralalero-tralala", "ballerina-cappuccina", "brr-brr-patapim", "cappuccino-assassino", "skibidi-toilet", "john-pork", "smurf-cat"] },
  { id: "classic", entries: ["pepe", "doge", "wojak", "gigachad", "trollface", "rickroll", "nyan-cat", "harambe", "this-is-fine", "stonks"] },
  { id: "viral", entries: ["chill-guy", "moo-deng", "popcat", "huh-cat", "banana-cat", "grimace-shake"] },
  { id: "gen-alpha", entries: ["aura", "mewing", "sigma", "bussin", "unc", "mog", "brainrot", "sus", "chopped", "ohio", "fanum-tax"] },
  { id: "zh-memes", entries: ["aoligei", "huaji", "goutou", "xiaochou", "jinitaimei", "yaoyao-lingxian", "songchigan", "xianyanbao", "juejuezi"] },
  { id: "short-video", entries: ["labubu", "dubai-chocolate", "demure", "bing-chilling", "brat-summer", "mob-wife", "jet2-holiday", "kemusan", "city-bu-city", "duobaan-chuanda", "yingkong", "banwei", "tuituitui"] },
  { id: "viral-songs", entries: ["apt", "golden", "soda-pop", "pedro", "sigma-boy", "bling-bang-bang-born", "see-tinh", "gata-only", "gnarly", "moye-moye", "bac-bling", "ojo-dibandingke", "guyongzhe", "yelang-disco", "xue-mao-jiao", "yixiao-jianghu"] },
] as const;

export type SlangGroupId = (typeof SLANG_GROUPS)[number]["id"];
export type SlangId = (typeof SLANG_GROUPS)[number]["entries"][number];

export const SLANG_ENTRIES: readonly SlangId[] = SLANG_GROUPS.flatMap((group) => group.entries);

/** A slang page: the hub, one entry, or none. */
export type SlangPage = SlangId | "hub" | null;

export type SlangSource = { name: string; url: string };

export type SlangPlatform = "douyin" | "tiktok" | "both";

/**
 * A credited artist: `name` as credited (shown in zh-CN) and `names` by locale. Without its own name a locale falls back:
 * zh-TW and ja to `names["zh-TW"]` then `name` (Chinese characters, closest to their own script), others to `names.en`.
 */
export type SlangArtist = { name: string; names?: Partial<Record<Locale, string>>; type: "Person" | "MusicGroup" };

export type SlangMeta = {
  /** The term as written where it comes from (the catalog key readers search; pages show each locale's `name`). */
  term: string;
  /** Where it comes from: Chinese internet, English internet, a Cantonese song lyric, or a meme spread worldwide. */
  origin: "zh" | "en" | "yue" | "web";
  /** When it first appeared ("YYYY-MM" or "YYYY"), shown on meme entries; for a song, its release (shown as "Released"). */
  born?: string;
  related: SlangId[];
  /** The short-video platform where it took off, shown next to the date (short-video memes and viral songs). */
  platform?: SlangPlatform;
  /** A viral song: the credited artists, for the kicker and the MusicRecording the article is about. */
  song?: { by: SlangArtist[] };
  /** Primary or well-known references; every URL was opened and checked. */
  sources: SlangSource[];
};

export const SLANG_PUBLISHED = "2026-11-10";

/** Entries added after the first batch, by id, with the day each went live (set by hand when adding entries). */
export const SLANG_ADDED: Partial<Record<SlangId, string>> = {
  "italian-brainrot": "2026-11-13", "tung-tung-tung-sahur": "2026-11-13", "tralalero-tralala": "2026-11-13",
  "ballerina-cappuccina": "2026-11-13", "brr-brr-patapim": "2026-11-13", "cappuccino-assassino": "2026-11-13",
  "skibidi-toilet": "2026-11-13", "john-pork": "2026-11-13", "smurf-cat": "2026-11-13", pepe: "2026-11-13",
  doge: "2026-11-13", wojak: "2026-11-13", gigachad: "2026-11-13", trollface: "2026-11-13", rickroll: "2026-11-13",
  "nyan-cat": "2026-11-13", harambe: "2026-11-13", "this-is-fine": "2026-11-13", stonks: "2026-11-13",
  "chill-guy": "2026-11-13", "moo-deng": "2026-11-13", popcat: "2026-11-13", "huh-cat": "2026-11-13",
  "banana-cat": "2026-11-13", "grimace-shake": "2026-11-13", aura: "2026-11-13", mewing: "2026-11-13",
  sigma: "2026-11-13", bussin: "2026-11-13", unc: "2026-11-13", mog: "2026-11-13", brainrot: "2026-11-13",
  sus: "2026-11-13", chopped: "2026-11-13", ohio: "2026-11-13", "fanum-tax": "2026-11-13", aoligei: "2026-11-13",
  huaji: "2026-11-13", goutou: "2026-11-13", xiaochou: "2026-11-13", jinitaimei: "2026-11-13",
  "yaoyao-lingxian": "2026-11-13", songchigan: "2026-11-13", xianyanbao: "2026-11-13", juejuezi: "2026-11-13",
  // 2026-11-18: short-video memes and viral songs.
  labubu: "2026-11-18", "dubai-chocolate": "2026-11-18", demure: "2026-11-18", "bing-chilling": "2026-11-18", "brat-summer": "2026-11-18",
  "mob-wife": "2026-11-18", "jet2-holiday": "2026-11-18", kemusan: "2026-11-18", "city-bu-city": "2026-11-18", "duobaan-chuanda": "2026-11-18", yingkong: "2026-11-18",
  banwei: "2026-11-18", tuituitui: "2026-11-18", apt: "2026-11-18", golden: "2026-11-18", "soda-pop": "2026-11-18", pedro: "2026-11-18",
  "sigma-boy": "2026-11-18", "bling-bang-bang-born": "2026-11-18", "see-tinh": "2026-11-18", "gata-only": "2026-11-18", gnarly: "2026-11-18", "moye-moye": "2026-11-18",
  "bac-bling": "2026-11-18", "ojo-dibandingke": "2026-11-18", guyongzhe: "2026-11-18", "yelang-disco": "2026-11-18", "xue-mao-jiao": "2026-11-18", "yixiao-jianghu": "2026-11-18",
};

/** When an entry went live. */
export function slangPublished(id: SlangId): string {
  return SLANG_ADDED[id] ?? SLANG_PUBLISHED;
}

/** Entries edited after they were published, for dateModified and the sitemap. */
export const SLANG_UPDATED: Partial<Record<SlangId, string>> = {
  // 2026-11-14: freely licensed pictures added.
  "ballerina-cappuccina": "2026-11-14", "brr-brr-patapim": "2026-11-14", "cappuccino-assassino": "2026-11-14", doge: "2026-11-14", goutou: "2026-11-14", "grimace-shake": "2026-11-14", harambe: "2026-11-14", huaji: "2026-11-14", "italian-brainrot": "2026-11-14", mewing: "2026-11-14", "moo-deng": "2026-11-14", "skibidi-toilet": "2026-11-14", stonks: "2026-11-14", "tralalero-tralala": "2026-11-14", trollface: "2026-11-14", "tung-tung-tung-sahur": "2026-11-14",
  // 2026-11-18: the picture's alt names Rick Astley.
  rickroll: "2026-11-18",
};

/** Entries the site footer links directly (highest Keyword Planner volume); their names are core-pack `slangFocus.*`. */
export const SLANG_FOCUS = [
  "tung-tung-tung-sahur",
  "67",
  "italian-brainrot",
  "skibidi-toilet",
  "pepe",
  "chill-guy",
  "aura",
  "i-ren-e-ren",
  "hajimi",
  "pua",
] as const satisfies readonly SlangId[];

export const SLANG_META: Record<SlangId, SlangMeta> = {
  "334424044": { term: "334424044", origin: "yue", related: ["666", "520", "yyds"], sources: [{ name: "HK01: 填詞其實唔難 粵語歌愛好者話你知填詞冷知識", url: "https://www.hk01.com/%E7%A4%BE%E5%8D%80%E5%B0%88%E9%A1%8C/118873/%E5%A1%AB%E8%A9%9E%E5%85%B6%E5%AF%A6%E5%94%94%E9%9B%A3-%E7%B2%B5%E8%AA%9E%E6%AD%8C%E6%84%9B%E5%A5%BD%E8%80%85%E8%A9%B1%E4%BD%A0%E7%9F%A5%E5%A1%AB%E8%A9%9E%E5%86%B7%E7%9F%A5%E8%AD%98" }] },
  "666": { term: "666", origin: "zh", related: ["520", "yyds", "xswl"], sources: [{ name: "Wiktionary: 666", url: "https://en.wiktionary.org/wiki/666" }, { name: "澎湃新闻（转载中国青年报）: 00后靠说「黑话」提高社交效率", url: "https://m.thepaper.cn/newsDetail_forward_2579894" }] },
  "520": { term: "520", origin: "zh", related: ["666", "334424044", "baiyueguang"], sources: [{ name: "Wikipedia: Chinese Internet slang", url: "https://en.wikipedia.org/wiki/Chinese_Internet_slang" }, { name: "京报网: 今天，微信红包额度上调至520元", url: "https://news.bjd.com.cn/2026/05/20/11755716.shtml" }] },
  yyds: { term: "yyds", origin: "zh", related: ["xswl", "awsl", "666"], sources: [{ name: "Wiktionary: yyds", url: "https://en.wiktionary.org/wiki/yyds" }, { name: "腾讯新闻: 2021年十大流行语和网络用语出炉", url: "https://news.qq.com/rain/a/20211209A045LF00" }, { name: "澎湃新闻: 《咬文嚼字》年度流行语为何不选「YYDS」和「绝绝子」", url: "https://m.thepaper.cn/newsDetail_forward_15762358" }] },
  xswl: { term: "xswl", origin: "zh", related: ["yyds", "awsl", "dbq"], sources: [{ name: "Wiktionary: xswl", url: "https://en.wiktionary.org/wiki/xswl" }, { name: "澎湃新闻（转载中国青年报）: 00后靠说「黑话」提高社交效率", url: "https://m.thepaper.cn/newsDetail_forward_2579894" }] },
  awsl: { term: "awsl", origin: "zh", related: ["xswl", "yyds", "hajimi"], sources: [{ name: "Wiktionary: awsl", url: "https://en.wiktionary.org/wiki/awsl" }, { name: "经济观察网: AWSL成B站年度弹幕词", url: "https://www.eeo.com.cn/2019/1205/371135.shtml" }, { name: "数英网: 「AWSL」当选B站年度弹幕", url: "https://www.digitaling.com/articles/240204.html" }] },
  dbq: { term: "dbq", origin: "zh", related: ["xswl", "cpdd", "pofang"], sources: [{ name: "澎湃新闻（转载中国青年报）: 00后靠说「黑话」提高社交效率", url: "https://m.thepaper.cn/newsDetail_forward_2579894" }] },
  cpdd: { term: "cpdd", origin: "zh", related: ["dbq", "crush", "situationship"], sources: [] },
  neijuan: { term: "内卷", origin: "zh", related: ["tangping", "bailan", "niuma"], sources: [{ name: "Wikipedia: Neijuan", url: "https://en.wikipedia.org/wiki/Neijuan" }, { name: "中国新闻网: 2020年十大流行语出炉 打工人、凡尔赛文学等上榜", url: "https://www.chinanews.com.cn/m/cul/2020/12-04/9354293.shtml" }] },
  tangping: { term: "躺平", origin: "zh", related: ["neijuan", "bailan", "niuma"], sources: [{ name: "Wikipedia: Tang ping", url: "https://en.wikipedia.org/wiki/Tang_ping" }, { name: "腾讯新闻: 2021年十大流行语和网络用语出炉", url: "https://news.qq.com/rain/a/20211209A045LF00" }] },
  bailan: { term: "摆烂", origin: "zh", related: ["tangping", "neijuan", "emo"], sources: [{ name: "腾讯新闻: 「摆烂」一词很火，什么意思？英语怎么说？", url: "https://news.qq.com/rain/a/20220414A04MZY00" }, { name: "津云: 《咬文嚼字》主编答疑：为何这些网络热词没入选2022年十大流行语", url: "https://www.tjyun.com/system/2022/12/26/053479577.shtml" }] },
  niuma: { term: "牛马", origin: "zh", related: ["neijuan", "tangping", "caotai-banzi"], sources: [{ name: "Wiktionary: 牛马", url: "https://en.wiktionary.org/wiki/牛马" }] },
  "caotai-banzi": { term: "草台班子", origin: "zh", related: ["niuma", "neijuan", "fanersai"], sources: [{ name: "Wiktionary: 草台班子", url: "https://en.wiktionary.org/wiki/草台班子" }, { name: "新浪财经（语言文字周报）: 偷感很重、草台班子、那咋了？2024网络流行语", url: "https://finance.sina.com.cn/jjxw/2024-12-13/doc-inczhxxx5957067.shtml" }] },
  fanersai: { term: "凡尔赛", origin: "zh", related: ["caotai-banzi", "chigua", "puxinnan"], sources: [{ name: "维基百科: 凡尔赛文学", url: "https://zh.wikipedia.org/wiki/凡尔赛文学" }, { name: "中国新闻网: 2020年十大流行语出炉 打工人、凡尔赛文学等上榜", url: "https://www.chinanews.com.cn/m/cul/2020/12-04/9354293.shtml" }, { name: "Wiktionary: 凡爾賽", url: "https://en.wiktionary.org/wiki/凡爾賽" }] },
  chigua: { term: "吃瓜", origin: "zh", related: ["fanersai", "haiwang", "xswl"], sources: [{ name: "新华网: 《咬文嚼字》公布2016年十大流行语", url: "https://www.xinhuanet.com/politics/2016-12/15/c_1120121641.htm" }, { name: "维基百科: 吃瓜群众", url: "https://zh.wikipedia.org/wiki/吃瓜群众" }, { name: "Wikipedia: Chinese Internet slang", url: "https://en.wikipedia.org/wiki/Chinese_Internet_slang" }] },
  emo: { term: "emo", origin: "zh", related: ["pofang", "qingxu-jiazhi", "bailan"], sources: [{ name: "Wikipedia: Emo", url: "https://en.wikipedia.org/wiki/Emo" }, { name: "中新网：满屏都是「我emo了」 网友们到底在说些啥？", url: "https://www.chinanews.com/sh/2021/10-11/9583344.shtml" }, { name: "中国日报双语：「我emo了」到底是什么梗？", url: "https://language.chinadaily.com.cn/a/202108/09/WS6110c4d9a310efa1bd667a30.html" }] },
  pofang: { term: "破防", origin: "zh", related: ["emo", "qingxu-jiazhi", "dbq"], sources: [{ name: "新华网：2021年度十大网络用语发布", url: "https://www.news.cn/politics/2021-12/07/c_1128137881.htm" }, { name: "人民网：《咬文嚼字》发布今年十大流行语", url: "http://bj.people.com.cn/n2/2021/1209/c82846-35042692.html" }] },
  "qingxu-jiazhi": { term: "情绪价值", origin: "zh", related: ["emo", "lianainao", "pua"], sources: [{ name: "光明网：2023年十大流行语发布", url: "https://m.gmw.cn/2023-12/04/content_1303590844.htm" }, { name: "中国江苏网：《咬文嚼字》2023年「十大流行语」发布", url: "https://edu.jschina.com.cn/jy/202312/t20231205_8163375.shtml" }] },
  "i-ren-e-ren": { term: "i人 / e人", origin: "zh", related: ["sheniu", "npc", "qingxu-jiazhi"], sources: [{ name: "腾讯新闻（东方网）：2023年10大网络流行语出炉", url: "https://news.qq.com/rain/a/20231208A04OQR00" }, { name: "The Myers-Briggs Foundation: Myers-Briggs Overview", url: "https://www.myersbriggs.org/my-mbti-personality-type/myers-briggs-overview/" }] },
  sheniu: { term: "社牛", origin: "zh", related: ["i-ren-e-ren", "emo", "npc"], sources: [{ name: "人民论坛网：从社恐到社牛：青年人社交议题背后的心理分析", url: "https://www.rmlt.com.cn/2022/0117/637836.shtml" }, { name: "澎湃新闻：别惹我，我社交牛逼", url: "https://m.thepaper.cn/newsDetail_forward_14610726" }] },
  hajimi: { term: "哈基米", origin: "zh", related: ["awsl", "yyds", "emo"], sources: [{ name: "维基百科：哈基米 (网络用语)", url: "https://zh.wikipedia.org/zh-hans/%E5%93%88%E5%9F%BA%E7%B1%B3_(%E7%BD%91%E7%BB%9C%E7%94%A8%E8%AF%AD)" }, { name: "游研社：讹变成猫的「哈基米」，会演化成新时代的「只因」吗？", url: "https://www.yystv.cn/p/11048" }, { name: "人民网：这些源自短视频的「流行语」，为何能风行一时？", url: "http://ent.people.com.cn/n1/2023/1210/c1012-40135526.html" }] },
  baiyueguang: { term: "白月光", origin: "zh", related: ["lianainao", "crush", "haiwang"], sources: [{ name: "维基百科：红玫瑰与白玫瑰", url: "https://zh.wikipedia.org/zh-cn/%E7%BA%A2%E7%8E%AB%E7%91%B0%E4%B8%8E%E7%99%BD%E7%8E%AB%E7%91%B0" }, { name: "Wiktionary: 白月光", url: "https://en.wiktionary.org/wiki/%E7%99%BD%E6%9C%88%E5%85%89" }] },
  haiwang: { term: "海王", origin: "zh", related: ["zhanan", "tiangou", "situationship"], sources: [{ name: "Wiktionary: 海王", url: "https://en.wiktionary.org/wiki/%E6%B5%B7%E7%8E%8B" }] },
  zhanan: { term: "渣男", origin: "zh", related: ["haiwang", "pua", "puxinnan"], sources: [{ name: "Wiktionary: 渣男", url: "https://en.wiktionary.org/wiki/%E6%B8%A3%E7%94%B7" }] },
  puxinnan: { term: "普信男", origin: "zh", related: ["zhanan", "fanersai", "delulu"], sources: [{ name: "维基百科：杨笠", url: "https://zh.wikipedia.org/zh-cn/%E6%9D%A8%E7%AC%A0" }] },
  lianainao: { term: "恋爱脑", origin: "zh", related: ["baiyueguang", "tiangou", "delulu"], sources: [{ name: "Wiktionary: 恋爱脑", url: "https://en.wiktionary.org/wiki/%E6%81%8B%E7%88%B1%E8%84%91" }] },
  tiangou: { term: "舔狗", origin: "zh", related: ["simp", "lianainao", "haiwang"], sources: [{ name: "Wiktionary: 舔狗", url: "https://en.wiktionary.org/wiki/%E8%88%94%E7%8B%97" }] },
  pua: { term: "PUA", origin: "zh", related: ["zhanan", "qingxu-jiazhi", "lianainao"], sources: [{ name: "Wikipedia: Pickup artist", url: "https://en.wikipedia.org/wiki/Pickup_artist" }, { name: "人民网：人民来论：杜绝职场PUA，需要全社会的合力", url: "http://opinion.people.com.cn/n1/2020/0924/c431649-31873400.html" }] },
  "67": { term: "6 7", origin: "en", related: ["rizz", "npc", "iykyk"], sources: [{ name: "Dictionary.com: Word of the Year 2025", url: "https://www.dictionary.com/e/word-of-the-year-2025/" }, { name: "Wikipedia: 6-7 (meme)", url: "https://en.wikipedia.org/wiki/6-7_(meme)" }] },
  rizz: { term: "rizz", origin: "en", related: ["simp", "crush", "no-cap"], sources: [{ name: "Oxford Languages: Word of the Year", url: "https://corp.oup.com/word-of-the-year/" }, { name: "Dictionary.com: rizz", url: "https://www.dictionary.com/culture/slang/rizz" }, { name: "Cambridge Dictionary: rizz", url: "https://dictionary.cambridge.org/dictionary/english/rizz" }] },
  fomo: { term: "FOMO", origin: "en", related: ["neijuan", "iykyk", "ootd"], sources: [{ name: "Cambridge Dictionary: FOMO", url: "https://dictionary.cambridge.org/dictionary/english/fomo" }, { name: "Wikipedia: Fear of missing out", url: "https://en.wikipedia.org/wiki/Fear_of_missing_out" }] },
  crush: { term: "crush", origin: "en", related: ["situationship", "baiyueguang", "rizz"], sources: [{ name: "Cambridge Dictionary: crush", url: "https://dictionary.cambridge.org/dictionary/english/crush" }] },
  ootd: { term: "OOTD", origin: "en", related: ["fomo", "iykyk", "rizz"], sources: [{ name: "Cambridge Dictionary: OOTD", url: "https://dictionary.cambridge.org/dictionary/english/ootd" }] },
  situationship: { term: "situationship", origin: "en", related: ["crush", "delulu", "haiwang"], sources: [{ name: "Dictionary.com: situationship", url: "https://www.dictionary.com/culture/slang/situationship" }, { name: "Cambridge Dictionary: situationship", url: "https://dictionary.cambridge.org/dictionary/english/situationship" }, { name: "Oxford Languages: Word of the Year", url: "https://corp.oup.com/word-of-the-year/" }] },
  npc: { term: "NPC", origin: "en", related: ["i-ren-e-ren", "67", "sheniu"], sources: [{ name: "Cambridge Dictionary: NPC", url: "https://dictionary.cambridge.org/dictionary/english/npc" }, { name: "Wikipedia: NPC (meme)", url: "https://en.wikipedia.org/wiki/NPC_(meme)" }] },
  delulu: { term: "delulu", origin: "en", related: ["lianainao", "situationship", "puxinnan"], sources: [{ name: "Dictionary.com: delulu", url: "https://www.dictionary.com/culture/slang/delulu" }, { name: "Cambridge Dictionary: delulu", url: "https://dictionary.cambridge.org/dictionary/english/delulu" }] },
  iykyk: { term: "IYKYK", origin: "en", related: ["smh", "no-cap", "67"], sources: [{ name: "Dictionary.com: iykyk", url: "https://www.dictionary.com/culture/slang/iykyk" }, { name: "Cambridge Dictionary: IYKYK", url: "https://dictionary.cambridge.org/dictionary/english/iykyk" }] },
  smh: { term: "SMH", origin: "en", related: ["iykyk", "no-cap", "dbq"], sources: [{ name: "Cambridge Dictionary: SMH", url: "https://dictionary.cambridge.org/dictionary/english/smh" }, { name: "Wiktionary: SMH", url: "https://en.wiktionary.org/wiki/SMH" }] },
  simp: { term: "simp", origin: "en", related: ["tiangou", "rizz", "crush"], sources: [{ name: "Dictionary.com: simp", url: "https://www.dictionary.com/culture/slang/simp" }, { name: "Cambridge Dictionary: simp", url: "https://dictionary.cambridge.org/dictionary/english/simp" }] },
  "italian-brainrot": { term: "Italian brainrot", origin: "web", born: "2025-01", related: ["tralalero-tralala", "tung-tung-tung-sahur", "brainrot"], sources: [{ name: "Wikipedia: Italian brainrot", url: "https://en.wikipedia.org/wiki/Italian_brainrot" }, { name: "Know Your Meme: Italian Brainrot / AI Italian Animals", url: "https://knowyourmeme.com/memes/italian-brainrot-ai-italian-animals" }] },
  "tung-tung-tung-sahur": { term: "Tung Tung Tung Sahur", origin: "web", born: "2025-02", related: ["italian-brainrot", "brr-brr-patapim", "ballerina-cappuccina"], sources: [{ name: "Wikipedia: Tung Tung Tung Sahur", url: "https://en.wikipedia.org/wiki/Tung_Tung_Tung_Sahur" }, { name: "Know Your Meme: Tung Tung Tung Sahur", url: "https://knowyourmeme.com/memes/tung-tung-tung-sahur" }, { name: "Know Your Meme: Tung Tung Tung Sahur Removed From Steal a Brainrot", url: "https://knowyourmeme.com/memes/events/tung-tung-tung-sahur-removed-from-steal-a-brainrot" }] },
  "tralalero-tralala": { term: "Tralalero Tralala", origin: "web", born: "2025-01", related: ["italian-brainrot", "ballerina-cappuccina", "tung-tung-tung-sahur"], sources: [{ name: "Know Your Meme: Tralalero Tralala", url: "https://knowyourmeme.com/memes/tralalero-tralala" }, { name: "Wikipedia: Italian brainrot", url: "https://en.wikipedia.org/wiki/Italian_brainrot" }] },
  "ballerina-cappuccina": { term: "Ballerina Cappuccina", origin: "web", born: "2025-03", related: ["cappuccino-assassino", "tralalero-tralala", "italian-brainrot"], sources: [{ name: "Daily Dot: Ballerina Cappuccina meme", url: "https://dailydot.com/ballerina-cappuccina-meme-italian-brainrot" }, { name: "Wikipedia: Italian brainrot", url: "https://en.wikipedia.org/wiki/Italian_brainrot" }] },
  "brr-brr-patapim": { term: "Brr Brr Patapim", origin: "web", born: "2025-02", related: ["tung-tung-tung-sahur", "italian-brainrot", "tralalero-tralala"], sources: [{ name: "Know Your Meme: Brr Brr Patapim", url: "https://knowyourmeme.com/memes/brr-brr-patapim" }, { name: "Know Your Meme: Italian Brainrot / AI Italian Animals", url: "https://knowyourmeme.com/memes/italian-brainrot-ai-italian-animals" }] },
  "cappuccino-assassino": { term: "Cappuccino Assassino", origin: "web", born: "2025-03", related: ["ballerina-cappuccina", "italian-brainrot", "tung-tung-tung-sahur"], sources: [{ name: "Know Your Meme: Cappuccino Assassino (Italian Brainrot)", url: "https://knowyourmeme.com/memes/cappuccino-assassino-italian-brainrot" }, { name: "Wikipedia: Italian brainrot", url: "https://en.wikipedia.org/wiki/Italian_brainrot" }] },
  "skibidi-toilet": { term: "Skibidi Toilet", origin: "web", born: "2023-02", related: ["brainrot", "ohio", "italian-brainrot"], sources: [{ name: "Wikipedia: Skibidi Toilet", url: "https://en.wikipedia.org/wiki/Skibidi_Toilet" }, { name: "NPR: Cambridge Dictionary adds more than 6,000 words, including skibidi and delulu", url: "https://www.npr.org/2025/08/19/nx-s1-5506163/cambridge-dictionary-adds-more-than-6-000-words-including-skibidi-and-delulu" }] },
  "john-pork": { term: "John Pork", origin: "web", born: "2018-09", related: ["smurf-cat", "skibidi-toilet", "brainrot"], sources: [{ name: "Know Your Meme: John Pork", url: "https://knowyourmeme.com/memes/john-pork" }] },
  "smurf-cat": { term: "Шайлушай (Smurf Cat)", origin: "web", born: "2023-08", related: ["john-pork", "skibidi-toilet", "brainrot"], sources: [{ name: "Know Your Meme: Smurf Cat / Шайлушай", url: "https://knowyourmeme.com/memes/smurf-cat-%D1%88%D0%B0%D0%B9%D0%BB%D1%83%D1%88%D0%B0%D0%B9" }] },
  pepe: { term: "Pepe the Frog", origin: "web", born: "2005", related: ["wojak", "doge", "trollface"], sources: [{ name: "Wikipedia: Pepe the Frog", url: "https://en.wikipedia.org/wiki/Pepe_the_Frog" }, { name: "Know Your Meme: Pepe the Frog", url: "https://knowyourmeme.com/memes/pepe-the-frog" }, { name: "Wikipedia: Feels Good Man", url: "https://en.wikipedia.org/wiki/Feels_Good_Man" }] },
  doge: { term: "Doge", origin: "web", born: "2010-02", related: ["pepe", "nyan-cat", "stonks"], sources: [{ name: "Wikipedia: Doge (meme)", url: "https://en.wikipedia.org/wiki/Doge_(meme)" }, { name: "Know Your Meme: Doge", url: "https://knowyourmeme.com/memes/doge" }, { name: "Wikipedia: Kabosu (dog)", url: "https://en.wikipedia.org/wiki/Kabosu_(dog)" }] },
  wojak: { term: "Wojak", origin: "web", born: "2009-12", related: ["pepe", "gigachad", "npc"], sources: [{ name: "Wikipedia: Wojak", url: "https://en.wikipedia.org/wiki/Wojak" }] },
  gigachad: { term: "GigaChad", origin: "web", born: "2017-10", related: ["sigma", "wojak", "mewing"], sources: [{ name: "Know Your Meme: GigaChad", url: "https://knowyourmeme.com/memes/gigachad" }, { name: "Wikipedia: Chad (slang)", url: "https://en.wikipedia.org/wiki/Chad_(slang)" }] },
  trollface: { term: "Trollface", origin: "web", born: "2008-09", related: ["rickroll", "pepe", "wojak"], sources: [{ name: "Wikipedia: Trollface", url: "https://en.wikipedia.org/wiki/Trollface" }] },
  rickroll: { term: "Rickroll", origin: "web", born: "2007-05", related: ["trollface", "nyan-cat", "doge"], sources: [{ name: "Wikipedia: Rickrolling", url: "https://en.wikipedia.org/wiki/Rickrolling" }] },
  "nyan-cat": { term: "Nyan Cat", origin: "web", born: "2011-04", related: ["rickroll", "doge", "popcat"], sources: [{ name: "Wikipedia: Nyan Cat", url: "https://en.wikipedia.org/wiki/Nyan_Cat" }] },
  harambe: { term: "Harambe", origin: "web", born: "2016-05", related: ["this-is-fine", "doge", "rickroll"], sources: [{ name: "Wikipedia: Killing of Harambe", url: "https://en.wikipedia.org/wiki/Killing_of_Harambe" }] },
  "this-is-fine": { term: "This is fine", origin: "web", born: "2013-01", related: ["stonks", "wojak", "pepe"], sources: [{ name: "Wikipedia: This is fine", url: "https://en.wikipedia.org/wiki/This_is_fine" }, { name: "Know Your Meme: This Is Fine", url: "https://knowyourmeme.com/memes/this-is-fine" }] },
  stonks: { term: "Stonks", origin: "web", born: "2017-06", related: ["this-is-fine", "doge", "wojak"], sources: [{ name: "Know Your Meme: Stonks", url: "https://knowyourmeme.com/memes/stonks" }, { name: "Wikipedia: Meme Man", url: "https://en.wikipedia.org/wiki/Meme_Man" }] },
  "chill-guy": { term: "Chill Guy", origin: "web", born: "2023-10", related: ["aura", "moo-deng", "npc"], sources: [{ name: "Wikipedia: Chill Guy", url: "https://en.wikipedia.org/wiki/Chill_Guy" }, { name: "Know Your Meme: Just a Chill Guy / My New Character", url: "https://knowyourmeme.com/memes/just-a-chill-guy-my-new-character" }] },
  "moo-deng": { term: "Moo Deng (หมูเด้ง)", origin: "web", born: "2024-07", related: ["chill-guy", "popcat", "huh-cat"], sources: [{ name: "Wikipedia: Moo Deng", url: "https://en.wikipedia.org/wiki/Moo_Deng" }, { name: "CBS News (AP): Moo Deng the baby hippo finds fame as a small Thai zoo's online \"bouncy pork\" sensation", url: "https://www.cbsnews.com/news/moo-deng-baby-hippo-thailand-zoo-bouncy-pork-goes-viral/" }] },
  popcat: { term: "Popcat", origin: "web", born: "2020-10", related: ["huh-cat", "banana-cat", "nyan-cat"], sources: [{ name: "Wikipedia: Popcat", url: "https://en.wikipedia.org/wiki/Popcat" }, { name: "Know Your Meme: Pop Cat", url: "https://knowyourmeme.com/memes/pop-cat" }] },
  "huh-cat": { term: "Huh? Cat", origin: "web", born: "2021-09", related: ["banana-cat", "popcat", "smurf-cat"], sources: [{ name: "Know Your Meme: Huh? Cat", url: "https://knowyourmeme.com/memes/huh-cat" }] },
  "banana-cat": { term: "Banana Cat", origin: "web", born: "2021-03", related: ["huh-cat", "popcat", "smurf-cat"], sources: [{ name: "Know Your Meme: Sad Banana Cat", url: "https://knowyourmeme.com/memes/sad-banana-cat" }] },
  "grimace-shake": { term: "Grimace Shake", origin: "web", born: "2023-06", related: ["ohio", "skibidi-toilet", "chill-guy"], sources: [{ name: "Wikipedia: Grimace Shake", url: "https://en.wikipedia.org/wiki/Grimace_Shake" }, { name: "CBS News: What are people doing with the Grimace shake?", url: "https://www.cbsnews.com/news/grimace-shake-mcdonalds-tiktok-meme/" }] },
  aura: { term: "aura", origin: "en", born: "2024-05", related: ["rizz", "sigma", "mewing"], sources: [{ name: "Know Your Meme: Aura Points", url: "https://knowyourmeme.com/memes/aura-points" }, { name: "Wikipedia: Aura farming", url: "https://en.wikipedia.org/wiki/Aura_farming" }] },
  mewing: { term: "mewing", origin: "en", born: "2014-10", related: ["mog", "gigachad", "sigma"], sources: [{ name: "Wikipedia: Mewing (orthotropics)", url: "https://en.wikipedia.org/wiki/Mewing_(orthotropics)" }, { name: "Know Your Meme: Mewing", url: "https://knowyourmeme.com/memes/mewing" }] },
  sigma: { term: "sigma", origin: "en", born: "2010-05", related: ["gigachad", "aura", "rizz"], sources: [{ name: "Know Your Meme: Sigma Males", url: "https://knowyourmeme.com/memes/sigma-males" }, { name: "Wikipedia: Alpha and beta male", url: "https://en.wikipedia.org/wiki/Alpha_and_beta_male" }, { name: "Know Your Meme: What Is The Sigma Face, And Who Is The Sigma Girl?", url: "https://knowyourmeme.com/editorials/guides/what-is-the-sigma-face-and-who-is-the-sigma-girl-the-meme-explained" }] },
  bussin: { term: "bussin'", origin: "en", born: "2017", related: ["no-cap", "rizz", "unc"], sources: [{ name: "Dictionary.com: bussin'", url: "https://www.dictionary.com/browse/bussin" }, { name: "Wiktionary: bussin'", url: "https://en.wiktionary.org/wiki/bussin%27" }, { name: "Know Your Meme: What Does 'Bussin' Mean? The Slang Term Explained", url: "https://knowyourmeme.com/editorials/guides/what-does-bussin-mean-the-slang-term-explained" }] },
  unc: { term: "unc", origin: "en", born: "2021-06", related: ["chopped", "bussin", "aura"], sources: [{ name: "Dictionary.com: unc", url: "https://www.dictionary.com/culture/slang/unc" }, { name: "Know Your Meme: Unc / Unc Status", url: "https://knowyourmeme.com/memes/unc-unc-status" }, { name: "HuffPost UK: What Does Gen Alpha Slang 'Unc' Mean And Is It Bad?", url: "https://www.huffingtonpost.co.uk/entry/unc-slang-explained_uk_69451144e4b039c32bac2977" }] },
  mog: { term: "mog", origin: "en", born: "2016", related: ["aura", "sigma", "mewing"], sources: [{ name: "Know Your Meme: Mogging", url: "https://knowyourmeme.com/memes/mogging" }, { name: "Wiktionary: mog", url: "https://en.wiktionary.org/wiki/mog" }, { name: "Dictionary.com: mog", url: "https://www.dictionary.com/culture/slang/mog" }] },
  brainrot: { term: "brain rot", origin: "en", born: "1854", related: ["italian-brainrot", "skibidi-toilet", "67"], sources: [{ name: "Wikipedia: Brain rot", url: "https://en.wikipedia.org/wiki/Brain_rot" }] },
  sus: { term: "sus", origin: "en", born: "1972", related: ["npc", "ohio", "no-cap"], sources: [{ name: "Know Your Meme: Sus", url: "https://knowyourmeme.com/memes/sus" }, { name: "Wiktionary: sus", url: "https://en.wiktionary.org/wiki/sus" }] },
  chopped: { term: "chopped", origin: "en", born: "2014-12", related: ["unc", "mog", "aura"], sources: [{ name: "Dictionary.com: chopped", url: "https://www.dictionary.com/culture/slang/chopped" }, { name: "Know Your Meme: Chopped", url: "https://knowyourmeme.com/memes/chopped-slang" }] },
  ohio: { term: "Ohio", origin: "en", born: "2016", related: ["skibidi-toilet", "brainrot", "rizz"], sources: [{ name: "Wikipedia: Ohio (meme)", url: "https://en.wikipedia.org/wiki/Ohio_(meme)" }] },
  "fanum-tax": { term: "Fanum tax", origin: "en", born: "2022-12", related: ["rizz", "sigma", "brainrot"], sources: [{ name: "Know Your Meme: Fanum Tax", url: "https://knowyourmeme.com/memes/fanum-tax" }] },
  aoligei: { term: "奥利给", origin: "zh", born: "2019", related: ["666", "yyds", "xianyanbao"], sources: [{ name: "维基百科: 朝阳冬泳怪鸽", url: "https://zh.wikipedia.org/wiki/朝阳冬泳怪鸽" }, { name: "澎湃新闻: 我们去了辽宁朝阳，并和冬泳怪鸽一起喊了「奥利给」", url: "https://www.thepaper.cn/newsDetail_forward_5504050" }] },
  huaji: { term: "滑稽", origin: "zh", born: "2012", related: ["goutou", "doge", "xiaochou"], sources: [{ name: "维基百科: 滑稽 (表情)", url: "https://zh.wikipedia.org/wiki/滑稽_(表情)" }] },
  goutou: { term: "狗头", origin: "zh", born: "2013", related: ["doge", "huaji", "xiaochou"], sources: [{ name: "Wikipedia: Doge (meme)", url: "https://en.wikipedia.org/wiki/Doge_(meme)" }, { name: "快科技: 微博十年表情使用次数统计", url: "https://news.mydrivers.com/1/644/644085.htm" }] },
  xiaochou: { term: "小丑竟是我自己", origin: "zh", born: "2020-07", related: ["tiangou", "pofang", "huaji"], sources: [{ name: "新周刊（腾讯新闻）: 小丑竟是我自己？是的没错！", url: "https://news.qq.com/rain/a/20210111A0ABYC00" }] },
  jinitaimei: { term: "鸡你太美", origin: "zh", born: "2019-01", related: ["huaji", "xiaochou", "chigua"], sources: [{ name: "维基百科: 蔡徐坤篮球视频事件", url: "https://zh.wikipedia.org/wiki/蔡徐坤篮球视频事件" }] },
  "yaoyao-lingxian": { term: "遥遥领先", origin: "zh", born: "2020-10", related: ["xianyanbao", "juejuezi", "yyds"], sources: [{ name: "每日经济新闻: 「遥遥领先」被调侃成热梗，余承东回应", url: "https://www.nbd.com.cn/articles/2023-12-11/3157493.html" }, { name: "东方网（腾讯新闻）: 2023年10大网络流行语出炉", url: "https://news.qq.com/rain/a/20231208A04OQR00" }] },
  songchigan: { term: "松弛感", origin: "zh", born: "2022", related: ["neijuan", "qingxu-jiazhi", "tangping"], sources: [{ name: "澎湃新闻: 变「松弛」的第一步，竟然是……", url: "https://m.thepaper.cn/newsDetail_forward_19729200" }, { name: "文汇报: 那个机场没发火的妈妈，引46万人点赞！家庭关系中的松弛感", url: "http://wenhui.whb.cn/zhuzhan/xue/20221018/491043.html" }] },
  xianyanbao: { term: "显眼包", origin: "zh", born: "2023", related: ["sheniu", "i-ren-e-ren", "juejuezi"], sources: [{ name: "光明网: 2023年十大流行语发布", url: "https://m.gmw.cn/2023-12/04/content_1303590844.htm" }, { name: "光明网: 2023年度十大网络用语发布", url: "https://m.gmw.cn/2023-12/13/content_1303599315.htm" }, { name: "东方网（腾讯新闻）: 2023年10大网络流行语出炉", url: "https://news.qq.com/rain/a/20231208A04OQR00" }] },
  juejuezi: { term: "绝绝子", origin: "zh", born: "2020", related: ["yyds", "xswl", "awsl"], sources: [{ name: "新华网: 2021年度十大网络用语发布", url: "https://www.news.cn/politics/2021-12/07/c_1128137881.htm" }, { name: "中国新闻网: 《咬文嚼字》：年度流行语为何不选「YYDS」和「绝绝子」", url: "https://www.chinanews.com.cn/cul/2021/12-08/9625066.shtml" }] },
  "no-cap": { term: "no cap", origin: "en", related: ["smh", "iykyk", "rizz"], sources: [{ name: "Dictionary.com: no cap", url: "https://www.dictionary.com/culture/slang/no-cap" }, { name: "Cambridge Dictionary: no cap", url: "https://dictionary.cambridge.org/dictionary/english/no-cap" }] },
  labubu: { term: "Labubu (拉布布)", origin: "web", born: "2015", platform: "both", related: ["dubai-chocolate", "moo-deng", "chill-guy"], sources: [{ name: "Wikipedia: Labubu", url: "https://en.wikipedia.org/wiki/Labubu" }, { name: "维基百科：拉布布", url: "https://zh.wikipedia.org/zh-cn/Labubu" }] },
  "dubai-chocolate": { term: "Dubai chocolate", origin: "web", born: "2023-12", platform: "tiktok", related: ["labubu", "grimace-shake", "mob-wife"], sources: [{ name: "Wikipedia: Dubai chocolate", url: "https://en.wikipedia.org/wiki/Dubai_chocolate" }, { name: "Daily Meal: The Viral Dubai Chocolate Bar, Explained", url: "https://www.thedailymeal.com/1674281/viral-dubai-chocolate-bar-explained/" }] },
  demure: { term: "very demure, very mindful", origin: "en", born: "2024-08", platform: "tiktok", related: ["brat-summer", "aura", "mob-wife"], sources: [{ name: "Dictionary.com: Word of the Year 2024", url: "https://www.dictionary.com/e/word-of-the-year-2024/" }, { name: "Wikipedia: Jools Lebron", url: "https://en.wikipedia.org/wiki/Jools_Lebron" }, { name: "Know Your Meme: Very Demure, Very Mindful", url: "https://knowyourmeme.com/memes/very-demure-very-mindful" }] },
  "bing-chilling": { term: "Bing Chilling (冰淇淋)", origin: "web", born: "2021-05", platform: "tiktok", related: ["kemusan", "huaji", "rickroll"], sources: [{ name: "Know Your Meme: John Cena Speaking Chinese and Eating Ice Cream / Bing Chilling", url: "https://knowyourmeme.com/memes/john-cena-speaking-chinese-and-eating-ice-cream-bing-chilling" }] },
  "brat-summer": { term: "Brat Summer", origin: "en", born: "2024-06", platform: "tiktok", related: ["demure", "mob-wife", "apt"], sources: [{ name: "Wikipedia: Brat (album)", url: "https://en.wikipedia.org/wiki/Brat_(album)" }, { name: "CBS News: Collins Dictionary's 2024 word of the year is brat", url: "https://www.cbsnews.com/news/collins-dictionarys-2024-word-of-year-brat" }, { name: "Wikipedia: Apple (song)", url: "https://en.wikipedia.org/wiki/Apple_(song)" }] },
  "mob-wife": { term: "mob wife aesthetic", origin: "en", born: "2024-01", platform: "tiktok", related: ["demure", "brat-summer", "duobaan-chuanda"], sources: [{ name: "Refinery29: What's Behind TikTok's Mob Wife Aesthetic Trend", url: "https://www.refinery29.com/en-us/mob-wife-aesthetic-fashion-trend-tiktok" }, { name: "TODAY: What is Mob Wife Winter? The Latest TikTok Aesthetic, Explained", url: "https://www.today.com/popculture/mob-wife-winter-aesthetic-tiktok-trend-rcna134377" }] },
  "jet2-holiday": { term: "Nothing beats a Jet2 holiday", origin: "web", born: "2024-11", platform: "tiktok", related: ["rickroll", "chill-guy", "pedro"], sources: [{ name: "Know Your Meme: Nothing Beats a Jet2 Holiday", url: "https://knowyourmeme.com/memes/nothing-beats-a-jet2-holiday" }, { name: "NBC News: 'Nothing beats a Jet2 holiday.' Except maybe viral fame.", url: "https://www.nbcnews.com/pop-culture/pop-culture-news/nothing-beats-jet2-holiday-viral-tiktok-audio-voice-actress-zoe-lister-rcna220620" }] },
  kemusan: { term: "科目三", origin: "zh", born: "2023-10", platform: "both", related: ["yixiao-jianghu", "city-bu-city", "see-tinh"], sources: [{ name: "维基百科：廣西科目三", url: "https://zh.wikipedia.org/wiki/%E5%BB%A3%E8%A5%BF%E7%A7%91%E7%9B%AE%E4%B8%89" }, { name: "新华网：中国故事｜“科目三”掀起“摇摆热潮”", url: "https://www.news.cn/local/20240112/6d933ae3e7f04ae6bf22e16f0af21f7d/c.html" }, { name: "China Daily: Haidilao's 'Subject Three' sparks debate", url: "https://www.chinadaily.com.cn/a/202311/30/WS65689257a31090682a5f0d42.html" }] },
  "city-bu-city": { term: "city不city", origin: "zh", born: "2024-06", platform: "douyin", related: ["kemusan", "bing-chilling", "yingkong"], sources: [{ name: "澎湃新闻：2024年“十大流行语”发布，“数智化”“city不city”等入选", url: "https://m.thepaper.cn/newsDetail_forward_29523813" }, { name: "澎湃新闻：“City不City”，美国小伙用混搭幽默演绎跨文化故事", url: "https://m.thepaper.cn/newsDetail_forward_29705105" }, { name: "21财经：互联网挤满了“City”的老外", url: "https://m.21jingji.com/article/20240712/herald/f5b4d5c12f5d3f03838179fba5daf758.html" }] },
  "duobaan-chuanda": { term: "多巴胺穿搭", origin: "zh", born: "2023", platform: "douyin", related: ["mob-wife", "banwei", "songchigan"], sources: [{ name: "光明网：2023年度十大网络用语出炉", url: "https://m.gmw.cn/2023-12/13/content_1303599593.htm" }, { name: "澎湃新闻：“多巴胺穿搭”爆火，消费市场需要简单的快乐", url: "https://m.thepaper.cn/newsDetail_forward_23728939" }] },
  yingkong: { term: "硬控", origin: "zh", born: "2024-04", platform: "douyin", related: ["banwei", "city-bu-city", "pofang"], sources: [{ name: "南方+：“硬控”是什么梗？", url: "https://static.nfnews.com/content/202404/11/c8774995.html" }, { name: "新华网：《咬文嚼字》“2024年十大流行语”", url: "http://www.news.cn/politics/20241202/59496b2d344b4382b6c12d03d78b8f13/c.html" }] },
  banwei: { term: "班味", origin: "zh", born: "2024", platform: "douyin", related: ["niuma", "yingkong", "neijuan"], sources: [{ name: "澎湃新闻：2024年“十大流行语”发布", url: "https://m.thepaper.cn/newsDetail_forward_29523813" }, { name: "海丝商报：“班味”背后的三重意蕴", url: "https://hssb.fjdaily.com/pad/con/202412/09/content_416727.html" }] },
  tuituitui: { term: "退！退！退！", origin: "zh", born: "2022-05", platform: "douyin", related: ["aoligei", "yingkong", "jinitaimei"], sources: [{ name: "封面新闻：“退退退”到底是一个怎样的网络热梗", url: "https://finance.sina.cn/2022-05-25/detail-imizirau4670127.d.html" }, { name: "海峡网：抖音退退退是什么梗和意思", url: "http://www.hxnews.com/news/yule/202205/24/2069326.shtml" }, { name: "网易：一夜4亿播放，全网模仿的“退退退”到底是什么？", url: "https://c.m.163.com/news/a/H8B0PJT70529SM26.html" }] },
  apt: { term: "APT.", origin: "web", born: "2024-10", platform: "both", song: { by: [{ name: "ROSÉ", type: "Person" }, { name: "Bruno Mars", type: "Person" }] }, related: ["golden", "soda-pop", "brat-summer"], sources: [{ name: "Wikipedia: APT. (song)", url: "https://en.wikipedia.org/wiki/APT._(song)" }, { name: "Food Republic: How To Play Korea's Trendy APT Drinking Game", url: "https://www.foodrepublic.com/1698747/korea-apt-drinking-game-explained/" }, { name: "太平洋科技: 播放量超70亿，《APT.》为何全网爆红？", url: "https://www.pconline.com.cn/focus/1837/18377728.html" }] },
  golden: { term: "Golden", origin: "web", born: "2025-06", platform: "tiktok", song: { by: [{ name: "HUNTR/X", type: "MusicGroup" }] }, related: ["soda-pop", "apt", "bling-bang-bang-born"], sources: [{ name: "Wikipedia: Golden (Huntrix song)", url: "https://en.wikipedia.org/wiki/Golden_(Huntrix_song)" }, { name: "Wikipedia（中文）: 灿金 (歌曲)", url: "https://zh.wikipedia.org/wiki/燦金_(歌曲)" }] },
  "soda-pop": { term: "Soda Pop", origin: "web", born: "2025-06", platform: "tiktok", song: { by: [{ name: "Saja Boys", type: "MusicGroup" }] }, related: ["golden", "apt", "gnarly"], sources: [{ name: "Wikipedia: Soda Pop (song)", url: "https://en.wikipedia.org/wiki/Soda_Pop_(song)" }, { name: "Wikipedia: KPop Demon Hunters", url: "https://en.wikipedia.org/wiki/KPop_Demon_Hunters" }] },
  pedro: { term: "Pedro", origin: "web", born: "2024-02", platform: "tiktok", song: { by: [{ name: "Jaxomy", type: "Person" }, { name: "Agatino Romero", type: "Person" }, { name: "Raffaella Carrà", type: "Person" }] }, related: ["moye-moye", "sigma-boy", "jet2-holiday"], sources: [{ name: "Know Your Meme: Raccoon Dancing in a Circle / \"Pedro Pedro Pedro\"", url: "https://knowyourmeme.com/memes/raccoon-dancing-in-a-circle-pedro-pedro-pedro" }, { name: "Wikipedia: Pedro (song)", url: "https://en.wikipedia.org/wiki/Pedro_(song)" }, { name: "Daily Dot: Pedro Raccoon Is TikTok's Favorite Dancer", url: "https://www.dailydot.com/memes/pedro-raccoon/" }] },
  "sigma-boy": { term: "Sigma Boy", origin: "web", born: "2024-10", platform: "tiktok", song: { by: [{ name: "Betsy", type: "Person" }, { name: "Maria Yankovskaya", type: "Person" }] }, related: ["sigma", "pedro", "gata-only"], sources: [{ name: "Wikipedia: Sigma Boy", url: "https://en.wikipedia.org/wiki/Sigma_Boy" }, { name: "Meduza: The Russian brainrot coming for your children", url: "https://meduza.io/en/feature/2025/02/08/the-russian-brainrot-coming-for-your-children" }] },
  "bling-bang-bang-born": { term: "Bling-Bang-Bang-Born", origin: "web", born: "2024-01", platform: "tiktok", song: { by: [{ name: "Creepy Nuts", type: "MusicGroup" }] }, related: ["golden", "apt", "gnarly"], sources: [{ name: "Wikipedia: Bling-Bang-Bang-Born", url: "https://en.wikipedia.org/wiki/Bling-Bang-Bang-Born" }, { name: "Know Your Meme: Bling-Bang-Bang-Born", url: "https://knowyourmeme.com/memes/bling-bang-bang-born" }, { name: "ComicBook.com: Mashle Season 2 Marks One of Anime's Most Viral Songs", url: "https://comicbook.com/anime/news/mashle-season-2-opening-creepy-nuts/" }] },
  "see-tinh": { term: "See tình", origin: "web", born: "2022-02", platform: "both", song: { by: [{ name: "Hoàng Thùy Linh", type: "Person" }] }, related: ["bac-bling", "kemusan", "xue-mao-jiao"], sources: [{ name: "Wikipedia: See Tình", url: "https://en.wikipedia.org/wiki/See_T%C3%ACnh" }, { name: "腾讯新闻：越南流行歌曲为何在短视频平台成爆款", url: "https://news.qq.com/rain/a/20220919A0059400" }, { name: "中時新聞網：連蔡依林都忍不住嗨跳 越南抖音神曲", url: "https://www.chinatimes.com/realtimenews/20230208003189-260404" }] },
  "gata-only": { term: "Gata Only", origin: "web", born: "2024-02", platform: "tiktok", song: { by: [{ name: "FloyyMenor", type: "Person" }, { name: "Cris MJ", type: "Person" }] }, related: ["pedro", "sigma-boy", "moye-moye"], sources: [{ name: "Wikipedia: Gata Only", url: "https://en.wikipedia.org/wiki/Gata_Only" }] },
  gnarly: { term: "Gnarly", origin: "web", born: "2025-04", platform: "tiktok", song: { by: [{ name: "Katseye", type: "MusicGroup" }] }, related: ["soda-pop", "golden", "bling-bang-bang-born"], sources: [{ name: "Wikipedia: Gnarly (song)", url: "https://en.wikipedia.org/wiki/Gnarly_(song)" }, { name: "Capital FM: What does 'Gnarly' mean? Katseye explain", url: "https://www.capitalfm.com/news/music/katseye-gnarly-lyrics-meaning/" }, { name: "Wikipedia: Katseye", url: "https://en.wikipedia.org/wiki/Katseye" }] },
  "moye-moye": { term: "Moye Moye (Džanum)", origin: "web", born: "2023", platform: "tiktok", song: { by: [{ name: "Teya Dora", type: "Person" }] }, related: ["pedro", "sigma-boy", "ojo-dibandingke"], sources: [{ name: "Wikipedia: Moye moye", url: "https://en.wikipedia.org/wiki/Moye_moye" }, { name: "Wikipedia: Džanum", url: "https://en.wikipedia.org/wiki/D%C5%BEanum" }] },
  "bac-bling": { term: "Bắc Bling", origin: "web", born: "2025-03", platform: "tiktok", song: { by: [{ name: "Hòa Minzy", type: "Person" }, { name: "Xuân Hinh", type: "Person" }, { name: "Tuấn Cry", type: "Person" }] }, related: ["see-tinh", "ojo-dibandingke", "apt"], sources: [{ name: "Wikipedia: Bắc Bling", url: "https://en.wikipedia.org/wiki/B%E1%BA%AFc_Bling" }, { name: "VTC News: Trào lưu 'biến hình' thành liền chị quan họ sau MV 'Bắc Bling'", url: "https://vtcnews.vn/trao-luu-bien-hinh-thanh-lien-chi-quan-ho-sau-mv-bac-bling-cua-hoa-minzy-ar929542.html" }] },
  "ojo-dibandingke": { term: "Ojo Dibandingke", origin: "web", born: "2022", platform: "tiktok", song: { by: [{ name: "Abah Lala", type: "Person" }, { name: "Denny Caknan", type: "Person" }] }, related: ["bac-bling", "moye-moye", "see-tinh"], sources: [{ name: "CNN Indonesia: Haru Pencipta Lagu 'Ojo Dibandingke' yang Dinyanyikan Farel di Istana", url: "https://www.cnnindonesia.com/hiburan/20220817181500-227-835780/haru-pencipta-lagu-ojo-dibandingke-yang-dinyanyikan-farel-di-istana" }, { name: "Kompas: Mengenal Farel Prayoga, Bocah Asal Banyuwangi", url: "https://regional.kompas.com/read/2022/08/17/144905778/mengenal-farel-prayoga-bocah-asal-banyuwangi-yang-goyang-istana-dengan-lagu" }, { name: "detikJateng: Perjalanan Lagu 'Ojo Dibandingke'", url: "https://www.detik.com/jateng/berita/d-6246556/perjalanan-lagu-ojo-dibandingke-dibikin-di-warung-hingga-ngetop-di-istana" }] },
  guyongzhe: { term: "孤勇者", origin: "zh", born: "2021-11", platform: "douyin", song: { by: [{ name: "陈奕迅", names: { en: "Eason Chan", "zh-TW": "陳奕迅", ja: "イーソン・チャン", vi: "Trần Dịch Tấn" }, type: "Person" }] }, related: ["yelang-disco", "xue-mao-jiao", "yixiao-jianghu"], sources: [{ name: "维基百科：孤勇者", url: "https://zh.wikipedia.org/wiki/%E5%AD%A4%E5%8B%87%E8%80%85" }, { name: "搜狐（《财经》）：《孤勇者》是如何征服小学生的？", url: "https://www.sohu.com/a/565966430_115571" }] },
  "yelang-disco": { term: "野狼disco", origin: "zh", born: "2019-09", platform: "douyin", song: { by: [{ name: "宝石Gem", names: { en: "Gem", "zh-TW": "寶石Gem" }, type: "Person" }] }, related: ["guyongzhe", "xue-mao-jiao", "yixiao-jianghu"], sources: [{ name: "维基百科：野狼disco", url: "https://zh.wikipedia.org/wiki/%E9%87%8E%E7%8B%BCdisco" }, { name: "新浪娱乐（界面新闻）：《野狼disco》老舅：对着镜头啃大肘子很可笑吗？", url: "https://ent.sina.cn/zy/2019-09-25/detail-iicezueu8255409.d.html" }, { name: "澎湃新闻：别再问我什么是《野狼disco》", url: "https://m.thepaper.cn/baijiahao_4837981" }] },
  "xue-mao-jiao": { term: "学猫叫", origin: "zh", born: "2018-04", platform: "douyin", song: { by: [{ name: "小潘潘", names: { en: "Xiao Panpan" }, type: "Person" }, { name: "小峰峰", names: { en: "Xiao Fengfeng" }, type: "Person" }] }, related: ["yelang-disco", "guyongzhe", "hajimi"], sources: [{ name: "Wikipedia（中文）: 学猫叫", url: "https://zh.wikipedia.org/wiki/学猫叫" }, { name: "搜狐（转载人民网）: 主播小潘潘《学猫叫》引发全民卖萌热潮", url: "https://www.sohu.com/a/240296366_652038" }] },
  "yixiao-jianghu": { term: "一笑江湖", origin: "zh", born: "2020-02", platform: "douyin", song: { by: [{ name: "闻人听書_", names: { en: "Wenren Tingshu_", "zh-TW": "聞人聽書_" }, type: "Person" }] }, related: ["kemusan", "guyongzhe", "yelang-disco"], sources: [{ name: "Wikipedia（中文）: 一笑江湖", url: "https://zh.wikipedia.org/wiki/一笑江湖" }, { name: "Wikipedia（中文）: 科目三 (舞蹈)", url: "https://zh.wikipedia.org/wiki/科目三_(舞蹈)" }] },
};

/** A viral song (it has credited artists), not a meme or a word. */
export function isSong(id: SlangId): boolean {
  return Boolean(SLANG_META[id].song);
}

export function isSlangId(value: string): value is SlangId {
  return (SLANG_ENTRIES as readonly string[]).includes(value);
}

export function slangGroupOf(id: SlangId): SlangGroupId {
  return SLANG_GROUPS.find((group) => (group.entries as readonly string[]).includes(id))!.id;
}
