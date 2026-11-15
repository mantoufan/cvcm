import { fill } from "../../shared/fill";
import type { Locale } from "../../shared/locale";
import { nostalgiaGroupOf, type NostalgiaId } from "../../shared/nostalgia";
import { nostalgiaPageHtml, nostalgiaUi, nostalgiaVoteResult } from "../../shared/nostalgia-i18n";

type Stored = { a: "yes" | "no"; yes: number; no: number };

const KEY = (id: NostalgiaId): string => `cvcm.nostalgia.vote.${id}`;
/** UTC day on which this network hit the cap for the entry: no more requests that day (they could not count). */
const CAPPED = (id: NostalgiaId): string => `cvcm.nostalgia.capped.${id}`;
const today = (): string => new Date().toISOString().slice(0, 10);

function cappedToday(id: NostalgiaId): boolean {
  try {
    return localStorage.getItem(CAPPED(id)) === today();
  } catch {
    return false;
  }
}

function readStored(id: NostalgiaId): Stored | null {
  try {
    const raw = localStorage.getItem(KEY(id));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Stored>;
    if ((v.a !== "yes" && v.a !== "no") || !Number.isFinite(v.yes) || !Number.isFinite(v.no)) return null;
    return { a: v.a, yes: Number(v.yes), no: Number(v.no) };
  } catch {
    return null;
  }
}

function store(id: NostalgiaId, value: Stored): void {
  try {
    localStorage.setItem(KEY(id), JSON.stringify(value));
  } catch {
    /* private mode: the answer still counted, it just is not remembered here */
  }
}

/**
 * Shows the share and the reader's own answer, and retires the buttons. `fresh` is false for an answer remembered from
 * an earlier visit (its totals are a snapshot from then); `counted` false when the API did not add it (same network today).
 */
function showResult(section: HTMLElement, locale: Locale, id: NostalgiaId, value: Stored, fresh: boolean, counted = true): void {
  const vote = nostalgiaUi(locale).vote;
  const answer = value.a === "yes" ? vote.yes[nostalgiaGroupOf(id)] : vote.no;
  const result = section.querySelector<HTMLElement>(".nostalgia-vote-result");
  if (result) {
    const share = nostalgiaVoteResult(locale, id, value);
    const parts = [fresh ? share : fill(vote.snapshot, { result: share }), fill(vote.mine, { a: answer })];
    if (!counted) parts.push(vote.repeat);
    result.textContent = parts.join(" · ");
    result.hidden = false;
  }
  for (const button of section.querySelectorAll<HTMLButtonElement>("button[data-answer]")) {
    button.disabled = true;
    button.classList.toggle("on", button.dataset.answer === value.a);
    button.setAttribute("aria-pressed", String(button.dataset.answer === value.a));
  }
}

/** Answers on their way, by entry: a page re-mounted meanwhile (locale switch) waits for the same request, not a new one. */
const pending = new Map<NostalgiaId, Promise<{ value: Stored; counted: boolean } | null>>();

async function send(id: NostalgiaId, answer: "yes" | "no"): Promise<{ value: Stored; counted: boolean } | null> {
  // A stalled request must not leave the buttons locked. AbortController and setTimeout (AbortSignal.timeout is missing
  // on iOS 15); the timer also covers reading the body.
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 10_000);
  try {
    const res = await fetch("/api/nostalgia/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, answer }),
      signal: timeout.signal,
    });
    if (!res.ok) return null;
    const tally = (await res.json()) as { yes: number; no: number; counted?: boolean };
    if (!Number.isFinite(tally.yes) || !Number.isFinite(tally.no)) return null;
    const value: Stored = { a: answer, yes: tally.yes, no: tally.no };
    const counted = tally.counted !== false;
    // Only a counted answer is remembered: a capped one from a shared network must stay answerable another day, but
    // not today (it could not count), so that day is noted.
    if (counted) store(id, value);
    else {
      try {
        localStorage.setItem(CAPPED(id), today());
      } catch {
        /* private mode */
      }
    }
    return { value, counted };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Wires the "did you have one?" buttons. No request until a button is pressed. */
function wireVote(host: HTMLElement, locale: Locale, id: NostalgiaId): void {
  const section = host.querySelector<HTMLElement>(".nostalgia-vote");
  if (!section) return;
  // Shown only once wired (styles.css): without this script, or in the prerendered copy, there is no dead question.
  section.classList.add("ready");
  const earlier = readStored(id);
  if (earlier) {
    showResult(section, locale, id, earlier, false);
    return;
  }
  const result = section.querySelector<HTMLElement>(".nostalgia-vote-result");
  const buttons = [...section.querySelectorAll<HTMLButtonElement>("button[data-answer]")];
  if (cappedToday(id)) {
    for (const b of buttons) b.disabled = true;
    if (result) {
      result.textContent = nostalgiaUi(locale).vote.repeat;
      result.hidden = false;
    }
    return;
  }
  const await_ = async (request: Promise<{ value: Stored; counted: boolean } | null>): Promise<void> => {
    const vote = nostalgiaUi(locale).vote;
    for (const b of buttons) b.disabled = true;
    if (result) {
      result.textContent = vote.sending;
      result.hidden = false;
    }
    const outcome = await request;
    if (!section.isConnected) return;
    if (outcome) {
      showResult(section, locale, id, outcome.value, true, outcome.counted);
      return;
    }
    for (const b of buttons) b.disabled = false;
    if (result) result.textContent = vote.failed;
  };
  const inFlight = pending.get(id);
  if (inFlight) void await_(inFlight);
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const request = send(id, button.dataset.answer === "yes" ? "yes" : "no");
      pending.set(id, request);
      void request.finally(() => {
        if (pending.get(id) === request) pending.delete(id);
      });
      void await_(request);
    });
  }
}

/** The nostalgia hub (null) or one entry. Static text, so the page is the same HTML the Worker serves. */
export function mountNostalgia(host: HTMLElement, locale: Locale, id: NostalgiaId | null): void {
  host.innerHTML = nostalgiaPageHtml(locale, id);
  if (id) wireVote(host, locale, id);
}
