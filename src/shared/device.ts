export const DEVICE_PAGES = ["hub", "ip", "browser", "screen", "ua"] as const;
export type DevicePageId = (typeof DEVICE_PAGES)[number];

export const DEVICE_CHILD_PAGES = ["ip", "browser", "screen", "ua"] as const;
export type DeviceChildId = (typeof DEVICE_CHILD_PAGES)[number];

export const DEVICE_SLUG: Record<DeviceChildId, string> = {
  ip: "ip",
  browser: "browser",
  screen: "screen-resolution",
  ua: "user-agent",
};

const SLUG_PAGE: Record<string, DeviceChildId> = {
  ip: "ip",
  browser: "browser",
  "screen-resolution": "screen",
  "user-agent": "ua",
};

export function isDevicePageId(value: string): value is DevicePageId {
  return (DEVICE_PAGES as readonly string[]).includes(value);
}

export function devicePageFromSlug(slug: string): DeviceChildId | null {
  return SLUG_PAGE[slug] ?? null;
}

export function isIpAddress(value: string): boolean {
  return isIpv4(value) || isIpv6(value);
}

function isIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return false;
    return Number(part) <= 255;
  });
}

function isIpv6(value: string): boolean {
  if (value.length < 2 || value.length > 39) return false;
  if (value.includes("%") || /[^0-9a-fA-F:]/.test(value)) return false;
  const halves = value.split("::");
  if (halves.length > 2) return false;
  const parseSide = (side: string): string[] | null => {
    if (side === "") return [];
    const groups = side.split(":");
    if (groups.some((group) => group.length < 1 || group.length > 4)) return null;
    return groups;
  };
  if (halves.length === 1) {
    const groups = parseSide(value);
    return !!groups && groups.length === 8;
  }
  const left = parseSide(halves[0]);
  const right = parseSide(halves[1]);
  if (!left || !right) return false;
  return left.length + right.length < 8;
}

export function estimatedDevicePixels(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
): { width: number; height: number } | null {
  if (!Number.isFinite(cssWidth) || !Number.isFinite(cssHeight) || !Number.isFinite(dpr) || dpr <= 0) return null;
  return { width: Math.round(cssWidth * dpr), height: Math.round(cssHeight * dpr) };
}

export type BrowserId = "edge" | "opera" | "chrome" | "firefox" | "safari" | "unknown";
export type PlatformId = "windows" | "macos" | "android" | "ios" | "ipad" | "unknown";
export type PlatformSource = "hint" | "ua" | "touch";

export type ParsedUa = {
  browser: BrowserId;
  version: string;
  platform: PlatformId;
  platformSource: PlatformSource;
};

export type ClientHints = {
  brands?: ReadonlyArray<{ brand: string; version: string }>;
  mobile?: boolean;
  platform?: string;
  maxTouchPoints?: number;
};

const HINT_PLATFORM: Record<string, PlatformId> = {
  windows: "windows",
  macos: "macos",
  mac: "macos",
  android: "android",
  ios: "ios",
  ipados: "ipad",
  ipad: "ipad",
};

function versionAfter(ua: string, token: string): string {
  const index = ua.indexOf(token);
  if (index < 0) return "";
  const match = /^[\d.]+/.exec(ua.slice(index + token.length));
  return match ? match[0].replace(/\.$/, "") : "";
}

function browserFromUa(ua: string): { browser: BrowserId; version: string } {
  if (ua.includes("Edg/")) return { browser: "edge", version: versionAfter(ua, "Edg/") };
  if (ua.includes("OPR/")) return { browser: "opera", version: versionAfter(ua, "OPR/") };
  if (ua.includes("CriOS/")) return { browser: "chrome", version: versionAfter(ua, "CriOS/") };
  if (ua.includes("Firefox/")) return { browser: "firefox", version: versionAfter(ua, "Firefox/") };
  if (ua.includes("Chrome/")) return { browser: "chrome", version: versionAfter(ua, "Chrome/") };
  if (ua.includes("Safari/")) return { browser: "safari", version: versionAfter(ua, "Version/") };
  return { browser: "unknown", version: "" };
}

function platformFromUa(ua: string, maxTouchPoints = 0): { platform: PlatformId; platformSource: PlatformSource } {
  if (/Android/i.test(ua)) return { platform: "android", platformSource: "ua" };
  if (/iPhone|iPod/i.test(ua)) return { platform: "ios", platformSource: "ua" };
  if (/iPad/i.test(ua)) return { platform: "ipad", platformSource: "ua" };
  if (/Windows/i.test(ua)) return { platform: "windows", platformSource: "ua" };
  if (/Macintosh|Mac OS X/i.test(ua)) {
    if (maxTouchPoints > 1) return { platform: "ipad", platformSource: "touch" };
    return { platform: "macos", platformSource: "ua" };
  }
  return { platform: "unknown", platformSource: "ua" };
}

export function parseUserAgent(ua: string, hints?: { maxTouchPoints?: number }): ParsedUa {
  const browser = browserFromUa(ua);
  const platform = platformFromUa(ua, hints?.maxTouchPoints ?? 0);
  return { ...browser, ...platform };
}

function browserFromBrands(brands: ReadonlyArray<{ brand: string; version: string }>): { browser: BrowserId; version: string } | null {
  const byName = (name: string) => brands.find((item) => item.brand.toLowerCase().includes(name));
  const edge = byName("edge");
  if (edge) return { browser: "edge", version: edge.version };
  const opera = byName("opera");
  if (opera) return { browser: "opera", version: opera.version };
  const chrome = byName("chrome");
  if (chrome && !chrome.brand.toLowerCase().includes("chromium")) return { browser: "chrome", version: chrome.version };
  return null;
}

export function describeClient(ua: string, hints?: ClientHints): ParsedUa & { mobile: boolean | null } {
  const parsed = parseUserAgent(ua, { maxTouchPoints: hints?.maxTouchPoints });
  const fromBrands = hints?.brands ? browserFromBrands(hints.brands) : null;
  const hinted = hints?.platform ? HINT_PLATFORM[hints.platform.trim().toLowerCase()] : undefined;
  return {
    browser: fromBrands?.browser ?? parsed.browser,
    version: fromBrands?.version || parsed.version,
    platform: hinted ?? parsed.platform,
    platformSource: hinted ? "hint" : parsed.platformSource,
    mobile: typeof hints?.mobile === "boolean" ? hints.mobile : null,
  };
}
