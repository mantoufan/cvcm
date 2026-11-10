/**
 * Internet slang dictionary under `/{locale}/slang/{id}/`: what a Chinese or English internet word means, where it
 * came from and how people use it, written for "what does X mean" searches. Entries were chosen from Google Ads
 * Keyword Planner volume (2026-11), plus 334424044, a Cantonese song lyric people ask about.
 */
export const SLANG_SEGMENT = "slang";

export const SLANG_GROUPS = [
  { id: "numbers", entries: ["334424044", "666", "520"] },
  { id: "abbreviations", entries: ["yyds", "xswl", "awsl", "dbq", "cpdd"] },
  { id: "society", entries: ["neijuan", "tangping", "bailan", "niuma", "caotai-banzi", "fanersai", "chigua"] },
  { id: "mood", entries: ["emo", "pofang", "qingxu-jiazhi", "i-ren-e-ren", "sheniu", "hajimi"] },
  { id: "love", entries: ["baiyueguang", "haiwang", "zhanan", "puxinnan", "lianainao", "tiangou", "pua"] },
  { id: "english", entries: ["67", "rizz", "fomo", "crush", "ootd", "situationship", "npc", "delulu", "iykyk", "smh", "simp", "no-cap"] },
] as const;

export type SlangGroupId = (typeof SLANG_GROUPS)[number]["id"];
export type SlangId = (typeof SLANG_GROUPS)[number]["entries"][number];

export const SLANG_ENTRIES: readonly SlangId[] = SLANG_GROUPS.flatMap((group) => group.entries);

/** A slang page: the hub, one entry, or none. */
export type SlangPage = SlangId | "hub" | null;

export type SlangSource = { name: string; url: string };

export type SlangMeta = {
  /** The term as written where it comes from (shown untranslated in every locale). */
  term: string;
  /** Where the word comes from: Chinese internet, English internet or a Cantonese song lyric. */
  origin: "zh" | "en" | "yue";
  related: SlangId[];
  /** Primary or well-known references; every URL was opened and checked. */
  sources: SlangSource[];
};

export const SLANG_PUBLISHED = "2026-11-10";

/** Entries edited after SLANG_PUBLISHED, for dateModified and the sitemap. */
export const SLANG_UPDATED: Partial<Record<SlangId, string>> = {};

/** Entries the site footer links directly (highest Keyword Planner volume); their terms are SLANG_META[id].term. */
export const SLANG_FOCUS = [
  "334424044",
  "67",
  "pua",
  "i-ren-e-ren",
  "emo",
  "qingxu-jiazhi",
  "neijuan",
  "yyds",
  "fomo",
  "baiyueguang",
] as const satisfies readonly SlangId[];

export const SLANG_META: Record<SlangId, SlangMeta> = {
  "334424044": { term: "334424044", origin: "yue", related: ["666", "520", "yyds"], sources: [{ name: "HK01: 填詞其實唔難 粵語歌愛好者話你知填詞冷知識", url: "https://www.hk01.com/%E7%A4%BE%E5%8D%80%E5%B0%88%E9%A1%8C/118873/%E5%A1%AB%E8%A9%9E%E5%85%B6%E5%AF%A6%E5%94%94%E9%9B%A3-%E7%B2%B5%E8%AA%9E%E6%AD%8C%E6%84%9B%E5%A5%BD%E8%80%85%E8%A9%B1%E4%BD%A0%E7%9F%A5%E5%A1%AB%E8%A9%9E%E5%86%B7%E7%9F%A5%E8%AD%98" }] },
  "666": { term: "666", origin: "zh", related: ["520", "yyds", "xswl"], sources: [{ name: "Wiktionary: 666", url: "https://en.wiktionary.org/wiki/666" }, { name: "澎湃新闻（转载中国青年报）: 00后靠说「黑话」提高社交效率", url: "https://m.thepaper.cn/newsDetail_forward_2579894" }] },
  "520": { term: "520", origin: "zh", related: ["666", "334424044", "baiyueguang"], sources: [{ name: "Wikipedia: Chinese Internet slang", url: "https://en.wikipedia.org/wiki/Chinese_Internet_slang" }, { name: "京报网: 今天，微信红包额度上调至520元", url: "https://news.bjd.com.cn/2026/05/20/11755716.shtml" }] },
  yyds: { term: "yyds", origin: "zh", related: ["xswl", "awsl", "666"], sources: [{ name: "Wiktionary: yyds", url: "https://en.wiktionary.org/wiki/yyds" }, { name: "腾讯新闻: 2021年十大流行语和网络用语出炉", url: "https://news.qq.com/rain/a/20211209A045LF00" }, { name: "澎湃新闻: 《咬文嚼字》年度流行语为何不选「YYDS」和「绝绝子」", url: "https://m.thepaper.cn/newsDetail_forward_15762358" }] },
  xswl: { term: "xswl", origin: "zh", related: ["yyds", "awsl", "dbq"], sources: [{ name: "Wiktionary: xswl", url: "https://en.wiktionary.org/wiki/xswl" }, { name: "澎湃新闻（转载中国青年报）: 00后靠说「黑话」提高社交效率", url: "https://m.thepaper.cn/newsDetail_forward_2579894" }] },
  awsl: { term: "awsl", origin: "zh", related: ["xswl", "yyds", "hajimi"], sources: [{ name: "Wiktionary: awsl", url: "https://en.wiktionary.org/wiki/awsl" }, { name: "经济观察网: AWSL成B站年度弹幕词", url: "http://www.eeo.com.cn/2019/1205/371135.shtml" }, { name: "数英网: 「AWSL」当选B站年度弹幕", url: "https://www.digitaling.com/articles/240204.html" }] },
  dbq: { term: "dbq", origin: "zh", related: ["xswl", "cpdd", "pofang"], sources: [{ name: "澎湃新闻（转载中国青年报）: 00后靠说「黑话」提高社交效率", url: "https://m.thepaper.cn/newsDetail_forward_2579894" }] },
  cpdd: { term: "cpdd", origin: "zh", related: ["dbq", "crush", "situationship"], sources: [] },
  neijuan: { term: "内卷", origin: "zh", related: ["tangping", "bailan", "niuma"], sources: [{ name: "Wikipedia: Neijuan", url: "https://en.wikipedia.org/wiki/Neijuan" }, { name: "中国新闻网: 2020年十大流行语出炉 打工人、凡尔赛文学等上榜", url: "https://www.chinanews.com.cn/m/cul/2020/12-04/9354293.shtml" }] },
  tangping: { term: "躺平", origin: "zh", related: ["neijuan", "bailan", "niuma"], sources: [{ name: "Wikipedia: Tang ping", url: "https://en.wikipedia.org/wiki/Tang_ping" }, { name: "腾讯新闻: 2021年十大流行语和网络用语出炉", url: "https://news.qq.com/rain/a/20211209A045LF00" }] },
  bailan: { term: "摆烂", origin: "zh", related: ["tangping", "neijuan", "emo"], sources: [{ name: "腾讯新闻: 「摆烂」一词很火，什么意思？英语怎么说？", url: "https://news.qq.com/rain/a/20220414A04MZY00" }, { name: "津云: 《咬文嚼字》主编答疑：为何这些网络热词没入选2022年十大流行语", url: "http://www.tjyun.com/system/2022/12/26/053479577.shtml" }] },
  niuma: { term: "牛马", origin: "zh", related: ["neijuan", "tangping", "caotai-banzi"], sources: [{ name: "Wiktionary: 牛马", url: "https://en.wiktionary.org/wiki/牛马" }] },
  "caotai-banzi": { term: "草台班子", origin: "zh", related: ["niuma", "neijuan", "fanersai"], sources: [{ name: "Wiktionary: 草台班子", url: "https://en.wiktionary.org/wiki/草台班子" }, { name: "新浪财经（语言文字周报）: 偷感很重、草台班子、那咋了？2024网络流行语", url: "https://finance.sina.com.cn/jjxw/2024-12-13/doc-inczhxxx5957067.shtml" }] },
  fanersai: { term: "凡尔赛", origin: "zh", related: ["caotai-banzi", "chigua", "puxinnan"], sources: [{ name: "维基百科: 凡尔赛文学", url: "https://zh.wikipedia.org/wiki/凡尔赛文学" }, { name: "中国新闻网: 2020年十大流行语出炉 打工人、凡尔赛文学等上榜", url: "https://www.chinanews.com.cn/m/cul/2020/12-04/9354293.shtml" }, { name: "Wiktionary: 凡爾賽", url: "https://en.wiktionary.org/wiki/凡爾賽" }] },
  chigua: { term: "吃瓜", origin: "zh", related: ["fanersai", "haiwang", "xswl"], sources: [{ name: "新华网: 《咬文嚼字》公布2016年十大流行语", url: "http://www.xinhuanet.com/politics/2016-12/15/c_1120121641.htm" }, { name: "维基百科: 吃瓜群众", url: "https://zh.wikipedia.org/wiki/吃瓜群众" }, { name: "Wikipedia: Chinese Internet slang", url: "https://en.wikipedia.org/wiki/Chinese_Internet_slang" }] },
  emo: { term: "emo", origin: "zh", related: ["pofang", "qingxu-jiazhi", "bailan"], sources: [{ name: "Wikipedia: Emo", url: "https://en.wikipedia.org/wiki/Emo" }, { name: "中新网：满屏都是「我emo了」 网友们到底在说些啥？", url: "https://www.chinanews.com/sh/2021/10-11/9583344.shtml" }, { name: "中国日报双语：「我emo了」到底是什么梗？", url: "https://language.chinadaily.com.cn/a/202108/09/WS6110c4d9a310efa1bd667a30.html" }] },
  pofang: { term: "破防", origin: "zh", related: ["emo", "qingxu-jiazhi", "dbq"], sources: [{ name: "新华网：2021年度十大网络用语发布", url: "http://www.news.cn/politics/2021-12/07/c_1128137881.htm" }, { name: "人民网：《咬文嚼字》发布今年十大流行语", url: "http://bj.people.com.cn/n2/2021/1209/c82846-35042692.html" }] },
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
  "no-cap": { term: "no cap", origin: "en", related: ["smh", "iykyk", "rizz"], sources: [{ name: "Dictionary.com: no cap", url: "https://www.dictionary.com/culture/slang/no-cap" }, { name: "Cambridge Dictionary: no cap", url: "https://dictionary.cambridge.org/dictionary/english/no-cap" }] },
};

export function isSlangId(value: string): value is SlangId {
  return (SLANG_ENTRIES as readonly string[]).includes(value);
}

export function slangGroupOf(id: SlangId): SlangGroupId {
  return SLANG_GROUPS.find((group) => (group.entries as readonly string[]).includes(id))!.id;
}
