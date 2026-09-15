import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { pickVoice, splitUtterances, type VoicePick } from "../../shared/tts";

let inputEl: HTMLTextAreaElement | null = null;
let voiceEl: HTMLSelectElement | null = null;
let statusEl: HTMLElement | null = null;
let pauseBtn: HTMLButtonElement | null = null;
let rate = 1;
let pitch = 1;
let queue: string[] = [];
let index = 0;
let preferredName = "";
let voiceschanged = (): void => {};

export function mountTts(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "true",
    "aria-label": t("tts.input"),
    placeholder: t("tts.placeholder"),
  }, t("tts.sample"));
  voiceEl = h("select", {
    onChange: (e: Event) => {
      preferredName = (e.target as HTMLSelectElement).value;
    },
  });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("tts.back")),
      h("h1", null, t("tts.title")),
      h("p", { class: "lede" }, t("tts.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("tts.options")),
          labeled(t("tts.voice"), voiceEl),
          labeled(t("tts.rate"),
            h("input", {
              type: "range",
              min: "0.5",
              max: "1.6",
              step: "0.1",
              value: "1",
              onInput: (e: Event) => {
                rate = Number((e.target as HTMLInputElement).value);
              },
            }),
          ),
          labeled(t("tts.pitch"),
            h("input", {
              type: "range",
              min: "0.5",
              max: "1.6",
              step: "0.1",
              value: "1",
              onInput: (e: Event) => {
                pitch = Number((e.target as HTMLInputElement).value);
              },
            }),
          ),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", onClick: () => speak() }, t("tts.speak")),
          pauseBtn = h("button", { type: "button", class: "btn ghost", onClick: () => togglePause() }, t("tts.pause")),
          h("button", { type: "button", class: "btn ghost", onClick: () => stop() }, t("tts.stop")),
        ),
        statusEl,
      ),
      h("div", { class: "rail" },
        h("h2", null, t("tts.input")),
        inputEl,
      ),
    ),
  );
  fillVoices();
  voiceschanged = () => fillVoices();
  if (synth()) synth()!.addEventListener("voiceschanged", voiceschanged);
  if (!synth()) setStatus(t("tts.unsupported"));
}

export function unmountTts(): void {
  stop();
  if (synth()) synth()!.removeEventListener("voiceschanged", voiceschanged);
  inputEl = null;
  voiceEl = null;
  statusEl = null;
  pauseBtn = null;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function synth(): SpeechSynthesis | null {
  return typeof speechSynthesis === "undefined" ? null : speechSynthesis;
}

function listVoices(): SpeechSynthesisVoice[] {
  return synth()?.getVoices() ?? [];
}

function fillVoices(): void {
  if (!voiceEl) return;
  const voices = listVoices();
  const picks: VoicePick[] = voices.map((voice) => ({ name: voice.name, lang: voice.lang }));
  const chosen = pickVoice(picks, locale(), preferredName);
  preferredName = chosen?.name ?? "";
  voiceEl.replaceChildren();
  if (!voices.length) {
    voiceEl.append(h("option", { value: "" }, t("tts.noVoices")));
    return;
  }
  for (const voice of voices) {
    voiceEl.append(h("option", {
      value: voice.name,
      selected: voice.name === preferredName,
    }, `${voice.name} (${voice.lang})`));
  }
}

function currentVoice(): SpeechSynthesisVoice | null {
  const name = voiceEl?.value || preferredName;
  return listVoices().find((voice) => voice.name === name) ?? listVoices()[0] ?? null;
}

function speak(): void {
  const engine = synth();
  if (!engine) {
    setStatus(t("tts.unsupported"));
    return;
  }
  const text = inputEl?.value ?? "";
  const chunks = splitUtterances(text);
  if (!chunks.length) {
    setStatus(t("tts.empty"));
    return;
  }
  engine.cancel();
  queue = chunks;
  index = 0;
  setStatus(t("tts.speaking"));
  window.setTimeout(() => speakNext(), 40);
}

function speakNext(): void {
  const engine = synth();
  const chunk = queue[index];
  if (!engine || !chunk) {
    setStatus("");
    return;
  }
  const utterance = new SpeechSynthesisUtterance(chunk);
  utterance.rate = rate;
  utterance.pitch = pitch;
  const voice = currentVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  utterance.onend = () => {
    index += 1;
    speakNext();
  };
  utterance.onerror = () => {
    setStatus(t("tts.error"));
  };
  engine.speak(utterance);
}

function togglePause(): void {
  const engine = synth();
  if (!engine) return;
  if (engine.paused) {
    engine.resume();
    if (pauseBtn) pauseBtn.textContent = t("tts.pause");
    setStatus(t("tts.speaking"));
    return;
  }
  if (engine.speaking) {
    engine.pause();
    if (pauseBtn) pauseBtn.textContent = t("tts.resume");
    setStatus(t("tts.paused"));
  }
}

function stop(): void {
  queue = [];
  index = 0;
  synth()?.cancel();
  if (pauseBtn) pauseBtn.textContent = t("tts.pause");
  setStatus("");
}

function setStatus(text: string): void {
  if (statusEl) statusEl.textContent = text;
}
