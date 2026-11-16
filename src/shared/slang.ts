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
] as const;

export type SlangGroupId = (typeof SLANG_GROUPS)[number]["id"];
export type SlangId = (typeof SLANG_GROUPS)[number]["entries"][number];

export const SLANG_ENTRIES: readonly SlangId[] = SLANG_GROUPS.flatMap((group) => group.entries);

/** A slang page: the hub, one entry, or none. */
export type SlangPage = SlangId | "hub" | null;

export type SlangSource = { name: string; url: string };

export type SlangMeta = {
  /** The term as written where it comes from (the catalog key readers search; pages show each locale's `name`). */
  term: string;
  /** Where it comes from: Chinese internet, English internet, a Cantonese song lyric, or a meme spread worldwide. */
  origin: "zh" | "en" | "yue" | "web";
  /** When it first appeared ("YYYY-MM" or "YYYY"), shown on meme entries. */
  born?: string;
  related: SlangId[];
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
};

/** When an entry went live. */
export function slangPublished(id: SlangId): string {
  return SLANG_ADDED[id] ?? SLANG_PUBLISHED;
}

/** Entries edited after they were published, for dateModified and the sitemap. */
export const SLANG_UPDATED: Partial<Record<SlangId, string>> = {
  // 2026-11-14: freely licensed pictures added.
  "ballerina-cappuccina": "2026-11-14", "brr-brr-patapim": "2026-11-14", "cappuccino-assassino": "2026-11-14", doge: "2026-11-14", goutou: "2026-11-14", "grimace-shake": "2026-11-14", harambe: "2026-11-14", huaji: "2026-11-14", "italian-brainrot": "2026-11-14", mewing: "2026-11-14", "moo-deng": "2026-11-14", rickroll: "2026-11-14", "skibidi-toilet": "2026-11-14", stonks: "2026-11-14", "tralalero-tralala": "2026-11-14", trollface: "2026-11-14", "tung-tung-tung-sahur": "2026-11-14",
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
};

export function isSlangId(value: string): value is SlangId {
  return (SLANG_ENTRIES as readonly string[]).includes(value);
}

export function slangGroupOf(id: SlangId): SlangGroupId {
  return SLANG_GROUPS.find((group) => (group.entries as readonly string[]).includes(id))!.id;
}
