"""Build src/locales/kb/<locale>/cultivation-levels.json from one realm-name table (names.py, ko_readings.json) and per-locale copy (t_<locale>.py).

Usage: python3 scripts/kb-cultivation-levels/build.py en zh-CN zh-TW ja ko vi id es && npm run kb:sync
{realm} tokens in the copy become each locale's form: simplified, traditional, pinyin (en/id/es), Han-Viet (vi),
Japanese kanji (ja) or Sino-Korean hangul with hanja (ko). Edit the copy here, never the generated JSON.
"""
import json, sys, importlib, os
sys.path.insert(0, os.path.dirname(__file__))
from names import disp, fill, chain
ID = "cultivation-levels"
NINE = ["炼气","筑基","金丹","元婴","化神","炼虚","合体","大乘","渡劫"]
FANREN = [("炼气","Qi Condensation","h","fr1"),("筑基","Foundation Establishment","h","fr2"),("结丹","Core Formation","h","fr3"),
 ("元婴","Nascent Soul","h","same"),("化神","Deity Transformation","h","fr5"),("炼虚","Spatial Tempering","s","same"),
 ("合体","Body Integration","s","same"),("大乘","Grand Ascension","s","fr8"),("渡劫","Tribulation Transcendence","s","fr9"),
 ("真仙","—","i",None),("金仙","—","i",None),("太乙玉仙","—","i",None),("大罗金仙","—","i",None),("道祖","—","i",None)]
DOULUO = [("1–10","魂士","Spirit Scholar","0"),("11–20","魂师","Spirit Master","1"),("21–30","大魂师","Spirit Grandmaster","2"),
 ("31–40","魂尊","Spirit Elder","3"),("41–50","魂宗","Spirit Ancestor","4"),("51–60","魂王","Spirit King","5"),
 ("61–70","魂帝","Spirit Emperor","6"),("71–80","魂圣","Spirit Saint","7"),("81–90","魂斗罗","Spirit Douluo","8"),
 ("91–99","封号斗罗","Titled Douluo","9"),("100+","神","God","—")]
WANMEI = ["搬血","洞天","化灵","铭纹","列阵","尊者","神火","真一","圣祭","天神","虚道","斩我","遁一","至尊","真仙","仙王","准仙帝","仙帝","祭道"]
PIAO = ["旋照","开光","融合","心动","灵寂","元婴","出窍","分神","合体","渡劫","大乘"]
FENG = ["凝气","筑基","结丹","元婴","斩灵","问道","仙境","古境","道境","道源","祖境"]
YINIAN = ["凝气","筑基","结丹","元婴","天人","半神","天尊","太古","主宰","永恒"]

# Book titles, authors and other Chinese words in ja / ko running text, in Japanese kanji / Korean hanja forms.
LOCAL_TITLES = {
    "ja": {"凡人修仙传": "凡人修仙伝", "斗破苍穹": "斗破蒼穹", "斗罗大陆": "斗羅大陸", "飘邈之旅": "飄邈之旅", "绝世唐门": "絶世唐門",
           "忘语": "忘語", "辰东": "辰東", "萧潜": "蕭潜",
           "炼精化气・炼气化神・炼神还虚": "煉精化気・煉気化神・煉神還虚", "元婴": "元嬰", "封号斗罗": "封号斗羅", "仮婴": "仮嬰", "筑基": "築基"},
    "ko": {"凡人修仙传": "凡人修仙傳", "斗破苍穹": "鬥破蒼穹", "斗罗大陆": "斗羅大陸", "飘邈之旅": "飄邈之旅", "绝世唐门": "絶世唐門",
           "忘语": "忘語", "辰东": "辰東", "萧潜": "蕭潛", "起点中文网": "起點中文網", "中国作家网": "中國作家網", "光明网": "光明網",
           "伍守阳": "伍守陽", "谭峭": "譚峭", "张伯端": "張伯端", "天仙正理直论": "天仙正理直論", "化书": "化書", "钟吕传道集": "鍾呂傳道集",
           "炼精化气·炼气化神·炼神还虚": "煉精化氣·煉氣化神·煉神還虛", "婴儿·圣胎·阳神": "嬰兒·聖胎·陽神", "天蚕土豆": "天蠶土豆",
           "踏天桥": "踏天橋", "九转": "九轉", "魂师": "魂師", "元婴": "元嬰", "一念永恒": "一念永恆"},
}
def localize(text, table):
    for k in sorted(table, key=len, reverse=True):
        text = text.replace(k, table[k])
    return text

def article(L, T):
    f = lambda s: fill(s.replace("{NINE}", "@@NINE@@"), L).replace("@@NINE@@", chain(NINE, L))
    c = lambda xs: chain(xs, L)
    W = {"h": T["w_human"], "s": T["w_spirit"], "i": T["w_immortal"]}
    secs = []
    secs.append({"h": T["h_common"], "body": [f(T["common_intro"]),
        {"table": {"head": T["common_head"], "rows": [[str(i+1), disp(n, L), f(T["common_mean"][i]), f(T["common_sub"][i])] for i, n in enumerate(NINE)]}},
        {"note": f(T["common_note"])}]})
    secs.append({"h": T["h_fanren"], "body": [f(T["fanren_work"]),
        {"table": {"head": T["fanren_head"], "rows": [[str(i+1), disp(n, L), en, W[w], f(T[k]) if k else "—"] for i, (n, en, w, k) in enumerate(FANREN)]}},
        {"note": f(T["fanren_note"])}]})
    S = T["steps"]
    secs.append({"h": T["h_xianni"], "body": [f(T["xianni_work"]),
        {"table": {"head": T["xianni_head"], "rows": [
            [S[0], disp("凝气", L), f(T["xn1"])],
            [S[0], c(["筑基","结丹","元婴","化神","婴变","问鼎"]), f(T["xn2"])],
            [S[4], c(["阴虚","阳实"]), f(T["xn3"])],
            [S[1], c(["窥涅","净涅","碎涅"]), f(T["xn4"])],
            [S[4], disp("天人五衰", L), f(T["xn5"])],
            [S[2], c(["空涅","空灵","空玄","空劫"]), f(T["xn6"])],
            [S[4], disp("半步踏天", L), f(T["xn7"])],
            [S[3], disp("踏天", L), "—"]]}}]})
    secs.append({"h": T["h_zhetian"], "body": [f(T["zhetian_work"]),
        {"table": {"head": T["zhetian_head"], "rows": [
            ["1", disp("轮海", L), c(["苦海","命泉","神桥","彼岸"])],
            ["2", disp("道宫", L), f(T["zt2"])],
            ["3", disp("四极", L), f(T["zt3"])],
            ["4", disp("化龙", L), f(T["zt4"])],
            ["5", disp("仙台", L), c(["半步大能","大能","斩道王者","圣人","圣人王","大圣"])],
            ["6", disp("准帝", L), f(T["zt6"])],
            ["7", disp("大帝", L), f(T["zt7"])],
            ["8", disp("红尘仙", L), f(T["zt8"])]]}},
        {"note": f(T["zhetian_note"])}]})
    secs.append({"h": T["h_wanmei"], "body": [f(T["wanmei_work"]), c(WANMEI), {"note": f(T["wanmei_note"])}]})
    secs.append({"h": T["h_doupo"], "body": [f(T["doupo_work"]),
        {"table": {"head": T["doupo_head"], "rows": [
            ["1", disp("斗之气", L), f(T["dp1"])],
            ["2–9", c(["斗者","斗师","大斗师","斗灵","斗王","斗皇","斗宗","斗尊"]), f(T["dp2"])],
            [S[4], disp("半圣", L), "—"],
            ["10", disp("斗圣", L), f(T["dp4"])],
            [S[4], disp("半步斗帝", L), "—"],
            ["11", disp("斗帝", L), "—"]]}}]})
    secs.append({"h": T["h_douluo"], "body": [f(T["douluo_work"]), f(T["douluo_quote"]),
        {"table": {"head": T["douluo_head"], "rows": [[lv, disp(n, L), en, r] for lv, n, en, r in DOULUO]}},
        {"note": f(T["douluo_note"])}]})
    secs.append({"h": T["h_piao"], "body": [f(T["piao_work"]), c(PIAO) + T["piao_tail"], f(T["piao_claim"]), {"note": f(T["piao_note"])}]})
    secs.append({"h": T["h_feng"], "body": [f(T["feng_work"]),
        {"table": {"head": T["feng_head"], "rows": [[T["n_feng"], c(FENG)], [T["n_yinian"], c(YINIAN)]]}},
        {"note": f(T["feng_note"])}]})
    secs.append({"h": T["h_same"], "body": [f(T["same_intro"]),
        {"table": {"head": T["same_head"], "rows": [[f(cell) for cell in row] for row in T["same_rows"]]}}]})
    secs.append({"h": T["h_origin"], "body": [f(T["origin_intro"]), {"ul": [f(x) for x in T["origin_daoist"]]},
        f(T["origin_new_intro"]), {"ul": [f(x) for x in T["origin_new"]]}]})
    return {"title": T["title"], "description": f(T["description"]), "h1": T["h1"],
            "answer": f(T["answer"]), "sections": secs,
            "faq": [{"q": f(q), "a": f(a)} for q, a in T["faq"]]}

if __name__ == "__main__":
    root = os.path.join(os.path.dirname(__file__), "..", "..")
    for L in sys.argv[1:]:
        T = importlib.import_module("t_" + L.replace("-", "_")).T
        a = article(L, T)
        if L in LOCAL_TITLES:
            a = json.loads(localize(json.dumps(a, ensure_ascii=False), LOCAL_TITLES[L]))
        s = json.dumps(a, ensure_ascii=False, indent=2)
        def strings(x):
            if isinstance(x, str): yield x
            elif isinstance(x, list):
                for y in x: yield from strings(y)
            elif isinstance(x, dict):
                for y in x.values(): yield from strings(y)
        left = [x for x in strings(a) if "{" in x or "}" in x]
        if left: raise SystemExit(f"{L}: unfilled {{token}} in: {left[0][:80]}")
        with open(os.path.join(root, "src/locales/kb", L, ID + ".json"), "w", encoding="utf-8") as fh: fh.write(s + "\n")
        core = os.path.join(root, "src/locales", L + ".json")
        with open(core, encoding="utf-8") as fh: d = json.load(fh)
        d["kb"][ID] = {"name": T["name"], "blurb": T["blurb"]}
        with open(core, "w", encoding="utf-8") as fh: fh.write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
        hub = os.path.join(root, "src/locales/kb", L + ".json")
        with open(hub, encoding="utf-8") as fh: h = json.load(fh)
        h["hub"]["groups"]["culture"] = T["group"]
        with open(hub, "w", encoding="utf-8") as fh: fh.write(json.dumps(h, ensure_ascii=False, indent=2) + "\n")
        print("wrote", L)
