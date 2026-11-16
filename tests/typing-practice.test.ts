import { describe, expect, it } from "vitest";
import { seeded } from "../src/shared/random";
import {
  FINGER_OF, KEY_ROWS, LESSONS, LESSON_KEYS, PASS_ACCURACY, SPACE, emptyStats, fromSavedProgress, keyLabel, makeDrill,
  newKeys, rates, recordResult, romajiHint, weakKeys,
} from "../src/shared/typing-practice";
import { romajiMatches } from "../src/shared/typing-game";
import { wordsFor } from "../src/shared/typing-game-words";

describe("typing practice keys", () => {
  it("gives every key a finger and the home row its home fingers", () => {
    for (const row of KEY_ROWS) for (const code of row) expect(FINGER_OF[code]).toBeTruthy();
    expect(["KeyA", "KeyS", "KeyD", "KeyF", "KeyJ", "KeyK", "KeyL", "Semicolon"].map((c) => FINGER_OF[c])).toEqual(["lp", "lr", "lm", "li", "ri", "rm", "rr", "rp"]);
    expect(FINGER_OF.KeyG).toBe("li");
    expect(FINGER_OF.KeyH).toBe("ri");
    expect(FINGER_OF[SPACE]).toBe("th");
  });

  it("labels keys with letters, or 2-set jamo on Korean pages", () => {
    expect(keyLabel("KeyA", "en")).toBe("a");
    expect(keyLabel("KeyA", "ko")).toBe("ㅁ");
    expect(keyLabel("KeyK", "ko")).toBe("ㅏ");
    expect(keyLabel("Semicolon", "ja")).toBe(";");
  });

  it("introduces new keys lesson by lesson", () => {
    expect(newKeys("home")).toEqual(LESSON_KEYS.home);
    expect(newKeys("home2")).toEqual(["KeyG", "KeyH"]);
    expect(newKeys("top")).toContain("KeyQ");
    expect(newKeys("letters")).toEqual([]);
    expect(LESSONS.at(-1)).toBe("words");
  });
});

describe("drills", () => {
  it("uses only the lesson's keys and spaces, never three of a kind or edge spaces", () => {
    for (const lesson of ["home", "home2", "top", "bottom", "letters"] as const) {
      for (let seed = 1; seed <= 20; seed++) {
        const d = makeDrill(lesson, seeded(seed));
        expect(d.length).toBeGreaterThan(50);
        const allowed = new Set([...LESSON_KEYS[lesson], SPACE]);
        expect(d.every((c) => allowed.has(c))).toBe(true);
        expect(d[0]).not.toBe(SPACE);
        expect(d.at(-1)).not.toBe(SPACE);
        for (let i = 2; i < d.length; i++) {
          if (d[i] !== SPACE) expect(d[i] === d[i - 1] && d[i] === d[i - 2]).toBe(false);
          expect(d[i] === SPACE && d[i - 1] === SPACE).toBe(false);
        }
      }
    }
  });

  it("is the same for the same seed", () => {
    expect(makeDrill("home", seeded(1))).toEqual(makeDrill("home", seeded(1)));
  });
});

describe("results", () => {
  it("computes keys per minute, accuracy and weak keys", () => {
    const s = { ...emptyStats(), keys: 60, misses: 15, seconds: 30, missedKeys: { KeyF: 4, KeyJ: 9, KeyA: 2 } };
    expect(rates(s)).toEqual({ kpm: 120, accuracy: 80 });
    expect(weakKeys(s, 2)).toEqual(["KeyJ", "KeyF"]);
    expect(rates(emptyStats())).toEqual({ kpm: 0, accuracy: 100 });
  });

  it("keeps the best accurate run and a passed tick", () => {
    let p = recordResult({}, "home", { kpm: 100, accuracy: 85 });
    expect(p.home).toEqual({ kpm: 100, accuracy: 85, passed: false });
    p = recordResult(p, "home", { kpm: 80, accuracy: PASS_ACCURACY });
    expect(p.home).toEqual({ kpm: 80, accuracy: 90, passed: true });
    p = recordResult(p, "home", { kpm: 200, accuracy: 70 });
    expect(p.home).toEqual({ kpm: 80, accuracy: 90, passed: true });
    p = recordResult(p, "home", { kpm: 140, accuracy: 95 });
    expect(p.home).toEqual({ kpm: 140, accuracy: 95, passed: true });
    expect(fromSavedProgress({ home: { kpm: "x" }, top: { kpm: 50, accuracy: 99, passed: true }, bad: 1 })).toEqual({ top: { kpm: 50, accuracy: 99, passed: true } });
  });
});

describe("romaji hints", () => {
  it("spell Japanese readings the way they can be typed", () => {
    expect(romajiHint("すし")).toBe("sushi");
    expect(romajiHint("しんかんせん")).toBe("shinkansen");
    expect(romajiHint("こんにちは")).toBe("konnnichiha");
    expect(romajiHint("きって")).toBe("kitte");
    expect(romajiHint("まっちゃ")).toBe("matcha");
    expect(romajiHint("きんよう")).toBe("kinnyou");
  });

  it("every hint for the Japanese word list is itself accepted", () => {
    for (const w of wordsFor("ja")) if (w.reading) expect(romajiMatches(w.reading, romajiHint(w.reading)), w.reading).toBe(true);
  });
});
