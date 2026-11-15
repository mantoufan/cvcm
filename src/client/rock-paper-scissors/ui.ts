import { h, onScreen } from "../dom";
import { t } from "../i18n";
import { randomBelow } from "../../shared/random";
import { physicalLetter, typingTarget } from "../game-input";
import {
  TARGETS, VARIANTS, matchOver, noThrows, movesOf, play, reason, type Move, type Result, type Score, type Target,
  type Variant,
} from "../../shared/rps";

const ICON: Record<Move, string> = { rock: "✊", paper: "✋", scissors: "✌️", lizard: "🦎", spock: "🖖" };
/** Keyboard shortcuts: R P S, L for lizard, K for Spock (S is taken). */
const KEY: Record<Move, string> = { rock: "r", paper: "p", scissors: "s", lizard: "l", spock: "k" };
const HISTORY = 20;

let mounted: { cleanup: () => void } | null = null;

/**
 * Korean copy writes particles both ways, "이(가)" and "을(를)"; this picks the one that fits the syllable before it
 * (이/을 after a final consonant, 가/를 after a vowel). Text in other languages has no such pairs and is unchanged.
 */
export function josa(text: string): string {
  return text.replace(/([\uac00-\ud7a3])(이\(가\)|을\(를\)|은\(는\))/g, (_, ch: string, pair: string) => {
    const final = (ch.charCodeAt(0) - 0xac00) % 28 !== 0;
    return ch + (final ? pair[0] : pair[2]);
  });
}

export function mountRps(host: HTMLElement): void {
  unmountRps();
  let variant: Variant = "classic";
  let target: Target = 0;
  const score: Score = { win: 0, lose: 0, draw: 0 };
  /** The last HISTORY rounds, for the history list (the score and tallies are kept separately). */
  let rounds: { you: Move; cpu: Move; result: Result }[] = [];
  /** Rounds in the current match: the arena shows the last throw only once the match has one. */
  let matchRounds = 0;
  /** Every throw this session, kept as counts so a long endless session stays cheap. */
  let thrown = noThrows();
  /** Rounds played this session, for the history's numbering (older rounds are dropped from `rounds`). */
  let played = 0;
  let matches = { win: 0, lose: 0 };

  const variantSel = h("select", { "data-field": "variant", onChange: () => { variant = variantSel.value as Variant; newMatch(); buildMoves(); } },
    ...VARIANTS.map((v) => h("option", { value: v, selected: v === variant }, t(`rps.var_${v}`))));
  const targetSel = h("select", { "data-field": "target", onChange: () => { target = Number(targetSel.value) as Target; newMatch(); paint(); } },
    ...TARGETS.map((n) => h("option", { value: n, selected: n === target }, n ? t("rps.bestOf", { n: 2 * n - 1 }) : t("rps.endless"))));

  const movesEl = h("div", { class: "rps-moves", role: "group", "aria-label": t("rps.choose"), "data-out": "moves" });
  const youEl = h("div", { class: "rps-hand", "data-out": "you" });
  const cpuEl = h("div", { class: "rps-hand", "data-out": "cpu" });
  const resultEl = h("p", { class: "rps-result", "aria-live": "polite", "data-out": "result" });
  const scoreEl = h("dl", { class: "stats-grid rps-score", "data-out": "score" });
  const matchEl = h("p", { class: "rps-match", "data-out": "match" });
  const historyEl = h("ol", { class: "rps-history", reversed: true, "data-out": "history" });
  const statsEl = h("p", { class: "hint", "data-out": "stats" });
  const nextBtn = h("button", { type: "button", class: "btn", "data-action": "next-match", hidden: true, onClick: () => { newMatch(); paint(); } }, t("rps.nextMatch"));

  const hand = (el: HTMLElement, who: string, m: Move | null) => {
    el.replaceChildren(
      h("span", { class: "rps-who" }, who),
      h("span", { class: "rps-icon", "aria-hidden": "true" }, m ? ICON[m] : "?"),
      h("span", { class: "rps-name" }, m ? t(`rps.m_${m}`) : "—"),
    );
  };

  const buildMoves = () => {
    movesEl.replaceChildren(...movesOf(variant).map((m) =>
      h("button", { type: "button", class: "rps-move", "data-move": m, "aria-keyshortcuts": KEY[m].toUpperCase(), onClick: () => throwMove(m) },
        h("span", { class: "rps-icon", "aria-hidden": "true" }, ICON[m]),
        h("span", null, t(`rps.m_${m}`)),
        h("small", null, KEY[m].toUpperCase()))));
    paint();
  };

  const over = () => matchOver(score, target);

  const paint = () => {
    const last = matchRounds ? rounds[rounds.length - 1] : undefined;
    hand(youEl, t("rps.you"), last?.you ?? null);
    hand(cpuEl, t("rps.computer"), last?.cpu ?? null);
    if (!last) {
      resultEl.className = "rps-result";
      resultEl.textContent = t("rps.pick");
    } else {
      const why = reason(last.you, last.cpu);
      const line = why ? t("rps.why", { winner: t(`rps.m_${why.winner}`), verb: t(`rps.v_${why.verb}`), loser: t(`rps.m_${why.loser}`) }) : "";
      resultEl.className = `rps-result ${last.result}`;
      resultEl.textContent = josa(`${t(`rps.r_${last.result}`)} ${line}`.trim());
    }
    scoreEl.replaceChildren(
      h("dt", null, t("rps.wins")), h("dd", null, String(score.win)),
      h("dt", null, t("rps.losses")), h("dd", null, String(score.lose)),
      h("dt", null, t("rps.draws")), h("dd", null, String(score.draw)),
    );
    const done = over();
    matchEl.hidden = !target;
    matchEl.className = `rps-match${done ? ` ${done}` : ""}`;
    matchEl.textContent = !target ? "" : done
      ? t(done === "win" ? "rps.matchWon" : "rps.matchLost", { won: matches.win, lost: matches.lose })
      : t("rps.firstTo", { n: target });
    nextBtn.hidden = !done;
    for (const b of movesEl.querySelectorAll<HTMLButtonElement>("button")) b.disabled = !!done;
    historyEl.start = played;
    historyEl.replaceChildren(...[...rounds].reverse().map((r) =>
      h("li", { class: r.result }, `${ICON[r.you]} ${t(`rps.m_${r.you}`)} – ${ICON[r.cpu]} ${t(`rps.m_${r.cpu}`)}: ${t(`rps.r_${r.result}`)}`)));
    statsEl.textContent = rounds.length
      ? t("rps.yourThrows", { list: movesOf(variant).map((m) => `${t(`rps.m_${m}`)} ${thrown[m]}`).join(" · ") })
      : t("rps.tip");
  };

  const throwMove = (you: Move) => {
    if (over()) return;
    const options = movesOf(variant);
    // The computer's throw is drawn with Web Crypto when you throw, so it cannot depend on your choice.
    const cpu = options[randomBelow(options.length)]!;
    const result = play(you, cpu);
    score[result]++;
    rounds.push({ you, cpu, result });
    thrown[you]++;
    played++;
    matchRounds++;
    if (rounds.length > HISTORY) rounds = rounds.slice(-HISTORY);
    const done = over();
    if (done === "win" || done === "lose") matches[done]++;
    paint();
  };

  /**
   * A new match: the score starts again, but the history, throw counts and match tally stay, so a rules or match change
   * (even an arrow key on a closed menu) costs at most the match in progress.
   */
  const newMatch = () => {
    score.win = 0;
    score.lose = 0;
    score.draw = 0;
    matchRounds = 0;
  };

  /** Reset score: everything this session starts again. */
  const reset = () => {
    newMatch();
    rounds = [];
    thrown = noThrows();
    played = 0;
    matches = { win: 0, lose: 0 };
    paint();
  };


  const onKey = (e: KeyboardEvent) => {
    // An IME (Korean, Japanese) reports its keys as "Process" while composing: those still map by position.
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || (e.isComposing && e.key !== "Process")) return;
    // A letter on our own (closed) menu is a throw, not the menu's type-ahead, which would reset the score.
    const ownMenu = e.target instanceof HTMLSelectElement && host.contains(e.target);
    if ((typingTarget(e.target) && !ownMenu) || !host.isConnected || !onScreen(movesEl)) return;
    const key = (/^[a-z]$/i.test(e.key) ? e.key : physicalLetter(e)).toLowerCase();
    const m = movesOf(variant).find((x) => KEY[x] === key);
    if (!m) {
      // Any other letter on our own menu would still pick an option by type-ahead (and start a new match).
      if (ownMenu && e.key.length === 1) e.preventDefault();
      return;
    }
    e.preventDefault();
    throwMove(m);
  };
  document.addEventListener("keydown", onKey);

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("rps.title")),
      h("p", { class: "lede" }, t("rps.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("div", { class: "rail" },
        h("div", { class: "rps-arena" }, youEl, h("span", { class: "rps-vs" }, t("rps.vs")), cpuEl),
        resultEl,
        movesEl,
        matchEl,
        nextBtn,
        scoreEl,
      ),
      h("aside", { class: "rail controls" },
        h("label", { class: "field" }, h("span", null, t("rps.variant")), variantSel),
        h("label", { class: "field" }, h("span", null, t("rps.match")), targetSel),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", "data-action": "reset", onClick: () => reset() }, t("rps.reset")),
        ),
        statsEl,
        h("h2", { class: "rps-history-title" }, t("rps.history")),
        historyEl,
      ),
    ),
  );
  buildMoves();
  mounted = { cleanup: () => document.removeEventListener("keydown", onKey) };
}

export function unmountRps(): void {
  mounted?.cleanup();
  mounted = null;
}
