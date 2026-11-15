import { fill } from "../../shared/fill";
import type { Locale } from "../../shared/locale";
import { nostalgiaGroupOf, type NostalgiaId } from "../../shared/nostalgia";
import { nostalgiaPageHtml, nostalgiaUi, nostalgiaVoteResult } from "../../shared/nostalgia-i18n";

type Stored = { a: "yes" | "no"; yes: number; no: number };

const KEY = (id: NostalgiaId): string => `cvcm.nostalgia.vote.${id}`;

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

/** Wires the "did you have one?" buttons. No request until a button is pressed. */
function wireVote(host: HTMLElement, locale: Locale, id: NostalgiaId): void {
  const section = host.querySelector<HTMLElement>(".nostalgia-vote");
  if (!section) return;
  const earlier = readStored(id);
  if (earlier) {
    showResult(section, locale, id, earlier, false);
    return;
  }
  const result = section.querySelector<HTMLElement>(".nostalgia-vote-result");
  const buttons = [...section.querySelectorAll<HTMLButtonElement>("button[data-answer]")];
  for (const button of buttons) {
    button.addEventListener("click", async () => {
      const answer = button.dataset.answer === "yes" ? "yes" : "no";
      const vote = nostalgiaUi(locale).vote;
      for (const b of buttons) b.disabled = true;
      if (result) {
        result.textContent = vote.sending;
        result.hidden = false;
      }
      try {
        const res = await fetch("/api/nostalgia/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, answer }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const tally = (await res.json()) as { yes: number; no: number; counted?: boolean };
        if (!Number.isFinite(tally.yes) || !Number.isFinite(tally.no)) throw new Error("tally");
        const value: Stored = { a: answer, yes: tally.yes, no: tally.no };
        // Only a counted answer is remembered: a repeat from a shared network today must stay answerable another day.
        if (tally.counted !== false) store(id, value);
        if (section.isConnected) showResult(section, locale, id, value, true, tally.counted !== false);
      } catch {
        if (!section.isConnected) return;
        for (const b of buttons) b.disabled = false;
        if (result) result.textContent = vote.failed;
      }
    });
  }
}

/** The nostalgia hub (null) or one entry. Static text, so the page is the same HTML the Worker serves. */
export function mountNostalgia(host: HTMLElement, locale: Locale, id: NostalgiaId | null): void {
  host.innerHTML = nostalgiaPageHtml(locale, id);
  if (id) wireVote(host, locale, id);
}
