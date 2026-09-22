import { h } from "../dom";
import type { Locale } from "../../shared/locale";
import {
  DEVICE_CHILD_PAGES,
  describeClient,
  estimatedDevicePixels,
  type ClientHints,
  type DevicePageId,
} from "../../shared/device";
import {
  deviceFaqItems,
  deviceLabel,
  deviceMessages,
  devicePageCopy,
} from "../../shared/device-i18n";
import { appHref, deviceHref } from "../../shared/path";

const HINT_FIELDS = ["fullVersionList", "platform", "mobile"] as const;

type ScreenInput = {
  screenW: number;
  screenH: number;
  viewW: number;
  viewH: number;
  dpr: number;
};

export function screenReading(locale: Locale, input: ScreenInput): HTMLElement {
  const msg = deviceMessages(locale);
  const estimate = estimatedDevicePixels(input.screenW, input.screenH, input.dpr);
  const estimateText = estimate ? `${estimate.width}×${estimate.height}` : msg.unknown;
  return h("div", { class: "device-reading", "data-nosnippet": "" },
    row(msg.screenLabel, `${input.screenW}×${input.screenH}`, "data-screen"),
    row(msg.viewportLabel, `${input.viewW}×${input.viewH}`, "data-viewport"),
    row(msg.dprLabel, String(input.dpr), "data-dpr"),
    row(msg.estimateLabel, estimateText, "data-estimate"),
    h("p", { class: "device-note", "data-caveat": "" }, msg.estimateNote),
  );
}

function row(label: string, value: string, attr: string): HTMLElement {
  return h("div", { class: "device-row" },
    h("p", { class: "device-k" }, label),
    h("p", { class: "device-v", [attr]: "" }, value),
  );
}

function crumb(locale: Locale, page: DevicePageId): HTMLElement {
  const msg = deviceMessages(locale);
  const hub = devicePageCopy(locale, "hub");
  const home = h("a", { href: appHref(locale, null), "data-nav": "home" }, msg.crumbHome);
  if (page === "hub") {
    return h("nav", { class: "device-crumb", "aria-label": hub.name },
      home, h("span", { "aria-hidden": "true" }, "/"), h("span", null, hub.name),
    );
  }
  const current = devicePageCopy(locale, page);
  return h("nav", { class: "device-crumb", "aria-label": hub.name },
    home,
    h("span", { "aria-hidden": "true" }, "/"),
    h("a", { href: deviceHref(locale, "hub"), "data-nav": "device" }, hub.name),
    h("span", { "aria-hidden": "true" }, "/"),
    h("span", null, current.name),
  );
}

function related(locale: Locale, page: DevicePageId): HTMLElement {
  const msg = deviceMessages(locale);
  const links: HTMLElement[] = [];
  if (page !== "hub") {
    links.push(h("a", { href: deviceHref(locale, "hub"), "data-nav": "device" }, devicePageCopy(locale, "hub").name));
  }
  for (const id of DEVICE_CHILD_PAGES) {
    if (id === page) continue;
    links.push(h("a", { href: deviceHref(locale, id), "data-nav": `device-${id}` }, devicePageCopy(locale, id).name));
  }
  if (page === "hub") {
    links.push(h("a", { href: appHref(locale, "timezone"), "data-nav": "timezone" }, msg.linkTimezone));
  }
  if (page === "screen") {
    links.push(h("a", { href: appHref(locale, "resize"), "data-nav": "resize" }, msg.linkResize));
    links.push(h("a", { href: appHref(locale, "aspect"), "data-nav": "aspect" }, msg.linkAspect));
  }
  return h("section", { class: "device-related" },
    h("h2", null, msg.related),
    h("p", null, ...links.flatMap((link, index) => index === 0 ? [link] : [h("span", null, " "), link])),
  );
}

function faq(locale: Locale, page: DevicePageId): HTMLElement {
  const msg = deviceMessages(locale);
  return h("section", { class: "faq", "aria-labelledby": "faq-title" },
    h("h2", { id: "faq-title" }, msg.faqTitle),
    ...deviceFaqItems(locale, page).map((item, index) =>
      h("details", index === 0 ? { open: true } : null,
        h("summary", null, item.q),
        h("p", null, item.a),
      ),
    ),
  );
}

function copyButton(locale: Locale, text: () => string): HTMLElement {
  const msg = deviceMessages(locale);
  const button = h("button", {
    type: "button",
    class: "btn ghost",
    onClick: () => {
      const value = text();
      if (!value) return;
      void navigator.clipboard?.writeText(value).then(() => {
        button.textContent = msg.copied;
      }).catch(() => {});
    },
  }, msg.copy);
  return button;
}

export function ipAsk(locale: Locale): HTMLElement {
  const msg = deviceMessages(locale);
  const value = h("p", { class: "device-v device-ip-value" }, msg.ipWaiting);
  let shown = "";
  const button = h("button", {
    type: "button",
    class: "btn device-show-ip",
    onClick: () => {
      void fetch("/api/device/ip", { cache: "no-store" })
        .then((res) => res.json())
        .then((body: { ip?: unknown }) => {
          const ip = typeof body.ip === "string" ? body.ip : "";
          shown = ip;
          value.textContent = ip || msg.ipMissing;
        })
        .catch(() => {
          shown = "";
          value.textContent = msg.ipMissing;
        });
    },
  }, msg.showIp);
  return h("div", { class: "device-reading", "data-nosnippet": "" },
    h("p", { class: "device-k" }, msg.ipLabel),
    button,
    value,
    copyButton(locale, () => shown),
  );
}

async function readHints(): Promise<ClientHints> {
  const nav = navigator as Navigator & {
    userAgentData?: {
      brands?: { brand: string; version: string }[];
      mobile?: boolean;
      platform?: string;
      getHighEntropyValues?: (hints: string[]) => Promise<{
        brands?: { brand: string; version: string }[];
        fullVersionList?: { brand: string; version: string }[];
        platform?: string;
        mobile?: boolean;
      }>;
    };
  };
  const data = nav.userAgentData;
  const hints: ClientHints = { maxTouchPoints: navigator.maxTouchPoints };
  if (!data) return hints;
  hints.mobile = data.mobile;
  hints.platform = data.platform;
  hints.brands = data.brands;
  if (!data.getHighEntropyValues) return hints;
  try {
    const high = await data.getHighEntropyValues([...HINT_FIELDS]);
    if (high.fullVersionList?.length) hints.brands = high.fullVersionList;
    if (high.platform) hints.platform = high.platform;
    if (typeof high.mobile === "boolean") hints.mobile = high.mobile;
  } catch {
    /* low-entropy brands remain */
  }
  return hints;
}

function clientReading(locale: Locale, hints: ClientHints, mode: "browser" | "ua" | "hub"): HTMLElement {
  const msg = deviceMessages(locale);
  const info = describeClient(navigator.userAgent, hints);
  const browser = deviceLabel(locale, "browsers", info.browser);
  const platform = deviceLabel(locale, "platforms", info.platform);
  const version = info.version || msg.unknown;
  const nodes: HTMLElement[] = [];
  if (mode !== "ua") {
    nodes.push(row(msg.browserLabel, browser, "data-browser"));
    nodes.push(row(msg.versionLabel, version, "data-version"));
    nodes.push(row(msg.platformLabel, platform, "data-platform"));
    if (info.platform === "macos" && info.platformSource === "ua") {
      nodes.push(h("p", { class: "device-note" }, msg.macNote));
    }
    if (info.mobile != null) {
      nodes.push(h("p", { class: "device-v", "data-form": "" }, info.mobile ? msg.phone : msg.desktop));
    }
  }
  if (mode !== "browser") {
    nodes.push(row(msg.uaLabel, navigator.userAgent, "data-ua"));
    nodes.push(copyButton(locale, () => navigator.userAgent));
  }
  return h("div", { class: "device-reading", "data-nosnippet": "" }, ...nodes);
}

export function mountDevice(host: HTMLElement, locale: Locale, page: DevicePageId): void {
  const msg = deviceMessages(locale);
  const copy = devicePageCopy(locale, page);
  const reading = h("div", null);
  host.append(
    h("article", { class: "device-page" },
      crumb(locale, page),
      h("h1", null, copy.h1),
      h("p", { class: "lede" }, copy.lede),
      reading,
      h("section", { class: "device-explain" },
        h("h2", null, msg.howTitle),
        h("p", null, copy.readBody),
      ),
      h("section", { class: "device-explain" },
        h("h2", null, msg.leaveTitle),
        h("p", null, copy.leaveBody),
      ),
      related(locale, page),
      faq(locale, page),
    ),
  );
  if (page === "ip" || page === "hub") reading.append(ipAsk(locale));
  if (page === "screen" || page === "hub") {
    reading.append(screenReading(locale, {
      screenW: screen.width,
      screenH: screen.height,
      viewW: window.innerWidth,
      viewH: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
    }));
  }
  if (page === "browser" || page === "ua" || page === "hub") {
    const slot = h("div", null);
    reading.append(slot);
    const mode = page === "hub" ? "hub" : page;
    void readHints().then((hints) => {
      slot.replaceChildren(clientReading(locale, hints, mode));
    });
  }
}
