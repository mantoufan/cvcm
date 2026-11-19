import { h } from "../dom";
import { t } from "../i18n";
import { TITLE_STYLES, titleCase, type TitleStyle } from "../../shared/title-case";
import { copyButton, field, layout, select } from "../academic/common";

const S = "titleCase";
/** The title the page opens with. */
export const EXAMPLE = "the effects of social media on self-esteem: a meta-analysis of studies from 2010 to 2020";

let timer = 0;

export function mountTitleCase(host: HTMLElement, style: TitleStyle = "apa"): void {
  const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(paint, 80); };
  const input = h("textarea", { class: "average-input", rows: "5", "data-field": "titles", spellcheck: "false", "aria-label": t(`${S}.input`), placeholder: t(`${S}.placeholder`), onInput: schedule });
  input.value = EXAMPLE;
  const styleSel = select<TitleStyle>("style", TITLE_STYLES, (s) => t(`${S}.s_${s}`), () => paint(), style);
  const output = h("textarea", { class: "average-input", rows: "5", readonly: true, "data-out": "titles", spellcheck: "false", "aria-label": t(`${S}.output`) });
  const rule = h("p", { class: "hint", "data-out": "rule" });
  const copy = copyButton(S, () => { window.clearTimeout(timer); paint(); return output.value; });

  function paint(): void {
    const s = styleSel.value as TitleStyle;
    output.value = input.value.trim() ? titleCase(input.value, s) : "";
    rule.textContent = t(`${S}.rule_${s}`);
    copy.disabled = !output.value;
  }

  layout(host, S, [
    field(t(`${S}.input`), input),
    field(t(`${S}.style`), styleSel),
    h("p", { class: "hint" }, t(`${S}.inputHint`)),
  ], [copy, h("button", { type: "button", class: "btn ghost", "data-action": "clear", onClick: () => { input.value = ""; paint(); input.focus(); } }, t(`${S}.clear`))],
  [output, rule, h("p", { class: "hint" }, t(`${S}.limits`))]);
  paint();
}

export function unmountTitleCase(): void {
  window.clearTimeout(timer);
}
