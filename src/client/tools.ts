import type { ToolId } from "../shared/path";

export type ToolContext = {
  clipId: string | null;
  /** False once the user has moved to another page; a late import must not mount into it. */
  alive: () => boolean;
};

/** Mounts one tool into host and returns its unmount. Each tool is its own chunk, so a page downloads only its tool. */
export type ToolLoader = (host: HTMLElement, ctx: ToolContext) => Promise<(() => void) | undefined>;

export const TOOL_LOADERS: Record<ToolId, ToolLoader> = {
  "clip": async (host, ctx) => {
    const m = await import("./clip/ui");
    if (!ctx.alive()) return undefined;
    await m.mountClip(host, ctx.clipId);
    return m.unmountClip;
  },
  "watermark": async (host, ctx) => {
    const m = await import("./watermark/ui");
    if (!ctx.alive()) return undefined;
    await m.mountWatermark(host);
    return m.unmountWatermark;
  },
  "mosaic": async (host, ctx) => {
    const m = await import("./watermark/ui");
    if (!ctx.alive()) return undefined;
    await m.mountWatermark(host, "mosaic");
    return m.unmountWatermark;
  },
  "collage": async (host, ctx) => {
    const m = await import("./collage/ui");
    if (!ctx.alive()) return undefined;
    await m.mountCollage(host);
    return m.unmountCollage;
  },
  "convert": async (host, ctx) => {
    const m = await import("./convert/ui");
    if (!ctx.alive()) return undefined;
    await m.mountConvert(host);
    return m.unmountConvert;
  },
  "image-pdf": async (host, ctx) => {
    const m = await import("./image-pdf/ui");
    if (!ctx.alive()) return undefined;
    await m.mountImagePdf(host);
    return m.unmountImagePdf;
  },
  "audio": async (host, ctx) => {
    const m = await import("./audio/ui");
    if (!ctx.alive()) return undefined;
    await m.mountAudio(host);
    return m.unmountAudio;
  },
  "audio-cutter": async (host, ctx) => {
    const m = await import("./audio-cutter/ui");
    if (!ctx.alive()) return undefined;
    await m.mountAudioCutter(host);
    return m.unmountAudioCutter;
  },
  "audio-joiner": async (host, ctx) => {
    const m = await import("./audio-joiner/ui");
    if (!ctx.alive()) return undefined;
    await m.mountAudioJoiner(host);
    return m.unmountAudioJoiner;
  },
  "data": async (host, ctx) => {
    const m = await import("./data/ui");
    if (!ctx.alive()) return undefined;
    await m.mountData(host);
    return m.unmountData;
  },
  "qr": async (host, ctx) => {
    const m = await import("./qr/ui");
    if (!ctx.alive()) return undefined;
    await m.mountQr(host);
    return m.unmountQr;
  },
  "barcode": async (host, ctx) => {
    const m = await import("./barcode/ui");
    if (!ctx.alive()) return undefined;
    await m.mountBarcode(host);
    return m.unmountBarcode;
  },
  "password": async (host, ctx) => {
    const m = await import("./password/ui");
    if (!ctx.alive()) return undefined;
    await m.mountPassword(host);
    return m.unmountPassword;
  },
  "word-count": async (host, ctx) => {
    const m = await import("./word-count/ui");
    if (!ctx.alive()) return undefined;
    await m.mountWordCount(host);
    return m.unmountWordCount;
  },
  "names": async (host, ctx) => {
    const m = await import("./names/ui");
    if (!ctx.alive()) return undefined;
    await m.mountNames(host);
    return m.unmountNames;
  },
  "timezone": async (host, ctx) => {
    const m = await import("./timezone/ui");
    if (!ctx.alive()) return undefined;
    await m.mountTimezone(host);
    return m.unmountTimezone;
  },
  "timestamp": async (host, ctx) => {
    const m = await import("./timestamp/ui");
    if (!ctx.alive()) return undefined;
    await m.mountTimestamp(host);
    return m.unmountTimestamp;
  },
  "lorem": async (host, ctx) => {
    const m = await import("./lorem/ui");
    if (!ctx.alive()) return undefined;
    await m.mountLorem(host);
    return m.unmountLorem;
  },
  "units": async (host, ctx) => {
    const m = await import("./units/ui");
    if (!ctx.alive()) return undefined;
    await m.mountUnits(host);
    return m.unmountUnits;
  },
  "text-to-speech": async (host, ctx) => {
    const m = await import("./tts/ui");
    if (!ctx.alive()) return undefined;
    await m.mountTts(host);
    return m.unmountTts;
  },
  "diff": async (host, ctx) => {
    const m = await import("./diff/ui");
    if (!ctx.alive()) return undefined;
    await m.mountDiff(host);
    return m.unmountDiff;
  },
  "uuid": async (host, ctx) => {
    const m = await import("./uuid/ui");
    if (!ctx.alive()) return undefined;
    await m.mountUuid(host);
    return m.unmountUuid;
  },
  "regex": async (host, ctx) => {
    const m = await import("./regex/ui");
    if (!ctx.alive()) return undefined;
    await m.mountRegex(host);
    return m.unmountRegex;
  },
  "color": async (host, ctx) => {
    const m = await import("./color/ui");
    if (!ctx.alive()) return undefined;
    await m.mountColor(host);
    return m.unmountColor;
  },
  "hex-rgb": async (host, ctx) => {
    const m = await import("./hex-rgb/ui");
    if (!ctx.alive()) return undefined;
    await m.mountHexRgb(host);
    return m.unmountHexRgb;
  },
  "xml-json": async (host, ctx) => {
    const m = await import("./xml-json/ui");
    if (!ctx.alive()) return undefined;
    await m.mountXmlJson(host);
    return m.unmountXmlJson;
  },
  "hash": async (host, ctx) => {
    const m = await import("./hash/ui");
    if (!ctx.alive()) return undefined;
    await m.mountHash(host);
    return m.unmountHash;
  },
  "yaml-json": async (host, ctx) => {
    const m = await import("./yaml-json/ui");
    if (!ctx.alive()) return undefined;
    await m.mountYamlJson(host);
    return m.unmountYamlJson;
  },
  "case": async (host, ctx) => {
    const m = await import("./case/ui");
    if (!ctx.alive()) return undefined;
    await m.mountCase(host);
    return m.unmountCase;
  },
  "jwt": async (host, ctx) => {
    const m = await import("./jwt/ui");
    if (!ctx.alive()) return undefined;
    await m.mountJwt(host);
    return m.unmountJwt;
  },
  "screenshot": async (host, ctx) => {
    const m = await import("./screenshot/ui");
    if (!ctx.alive()) return undefined;
    await m.mountScreenshot(host);
    return m.unmountScreenshot;
  },
  "percent": async (host, ctx) => {
    const m = await import("./percent/ui");
    if (!ctx.alive()) return undefined;
    await m.mountPercent(host);
    return m.unmountPercent;
  },
  "random": async (host, ctx) => {
    const m = await import("./random/ui");
    if (!ctx.alive()) return undefined;
    await m.mountRandom(host);
    return m.unmountRandom;
  },
  "html": async (host, ctx) => {
    const m = await import("./html/ui");
    if (!ctx.alive()) return undefined;
    await m.mountHtml(host);
    return m.unmountHtml;
  },
  "cron": async (host, ctx) => {
    const m = await import("./cron/ui");
    if (!ctx.alive()) return undefined;
    await m.mountCron(host);
    return m.unmountCron;
  },
  "slug": async (host, ctx) => {
    const m = await import("./slug/ui");
    if (!ctx.alive()) return undefined;
    await m.mountSlug(host);
    return m.unmountSlug;
  },
  "age": async (host, ctx) => {
    const m = await import("./age/ui");
    if (!ctx.alive()) return undefined;
    await m.mountAge(host);
    return m.unmountAge;
  },
  "bmi": async (host, ctx) => {
    const m = await import("./bmi/ui");
    if (!ctx.alive()) return undefined;
    await m.mountBmi(host);
    return m.unmountBmi;
  },
  "binary": async (host, ctx) => {
    const m = await import("./binary/ui");
    if (!ctx.alive()) return undefined;
    await m.mountBinary(host);
    return m.unmountBinary;
  },
  "tip": async (host, ctx) => {
    const m = await import("./tip/ui");
    if (!ctx.alive()) return undefined;
    await m.mountTip(host);
    return m.unmountTip;
  },
  "morse": async (host, ctx) => {
    const m = await import("./morse/ui");
    if (!ctx.alive()) return undefined;
    await m.mountMorse(host);
    return m.unmountMorse;
  },
  "roman": async (host, ctx) => {
    const m = await import("./roman/ui");
    if (!ctx.alive()) return undefined;
    await m.mountRoman(host);
    return m.unmountRoman;
  },
  "discount": async (host, ctx) => {
    const m = await import("./discount/ui");
    if (!ctx.alive()) return undefined;
    await m.mountDiscount(host);
    return m.unmountDiscount;
  },
  "countdown": async (host, ctx) => {
    const m = await import("./countdown/ui");
    if (!ctx.alive()) return undefined;
    await m.mountCountdown(host);
    return m.unmountCountdown;
  },
  "loan": async (host, ctx) => {
    const m = await import("./loan/ui");
    if (!ctx.alive()) return undefined;
    await m.mountLoan(host);
    return m.unmountLoan;
  },
  "stopwatch": async (host, ctx) => {
    const m = await import("./stopwatch/ui");
    if (!ctx.alive()) return undefined;
    await m.mountStopwatch(host);
    return m.unmountStopwatch;
  },
  "compound": async (host, ctx) => {
    const m = await import("./compound/ui");
    if (!ctx.alive()) return undefined;
    await m.mountCompound(host);
    return m.unmountCompound;
  },
  "vat": async (host, ctx) => {
    const m = await import("./vat/ui");
    if (!ctx.alive()) return undefined;
    await m.mountVat(host);
    return m.unmountVat;
  },
  "reverse": async (host, ctx) => {
    const m = await import("./reverse/ui");
    if (!ctx.alive()) return undefined;
    await m.mountReverse(host);
    return m.unmountReverse;
  },
  "url-encode": async (host, ctx) => {
    const m = await import("./url-encode/ui");
    if (!ctx.alive()) return undefined;
    await m.mountUrlEncode(host);
    return m.unmountUrlEncode;
  },
  "text-hex": async (host, ctx) => {
    const m = await import("./text-hex/ui");
    if (!ctx.alive()) return undefined;
    await m.mountTextHex(host);
    return m.unmountTextHex;
  },
  "json": async (host, ctx) => {
    const m = await import("./json/ui");
    if (!ctx.alive()) return undefined;
    await m.mountJson(host);
    return m.unmountJson;
  },
  "base64": async (host, ctx) => {
    const m = await import("./base64/ui");
    if (!ctx.alive()) return undefined;
    await m.mountBase64(host);
    return m.unmountBase64;
  },
  "days": async (host, ctx) => {
    const m = await import("./days/ui");
    if (!ctx.alive()) return undefined;
    await m.mountDays(host);
    return m.unmountDays;
  },
  "sort": async (host, ctx) => {
    const m = await import("./sort/ui");
    if (!ctx.alive()) return undefined;
    await m.mountSort(host);
    return m.unmountSort;
  },
  "replace": async (host, ctx) => {
    const m = await import("./replace/ui");
    if (!ctx.alive()) return undefined;
    await m.mountReplace(host);
    return m.unmountReplace;
  },
  "words": async (host, ctx) => {
    const m = await import("./words/ui");
    if (!ctx.alive()) return undefined;
    await m.mountWords(host);
    return m.unmountWords;
  },
  "add-days": async (host, ctx) => {
    const m = await import("./add-days/ui");
    if (!ctx.alive()) return undefined;
    await m.mountAddDays(host);
    return m.unmountAddDays;
  },
  "week": async (host, ctx) => {
    const m = await import("./week/ui");
    if (!ctx.alive()) return undefined;
    await m.mountWeek(host);
    return m.unmountWeek;
  },
  "aspect": async (host, ctx) => {
    const m = await import("./aspect/ui");
    if (!ctx.alive()) return undefined;
    await m.mountAspect(host);
    return m.unmountAspect;
  },
  "workdays": async (host, ctx) => {
    const m = await import("./workdays/ui");
    if (!ctx.alive()) return undefined;
    await m.mountWorkdays(host);
    return m.unmountWorkdays;
  },
  "fraction": async (host, ctx) => {
    const m = await import("./fraction/ui");
    if (!ctx.alive()) return undefined;
    await m.mountFraction(host);
    return m.unmountFraction;
  },
  "hourly": async (host, ctx) => {
    const m = await import("./hourly/ui");
    if (!ctx.alive()) return undefined;
    await m.mountHourly(host);
    return m.unmountHourly;
  },
  "margin": async (host, ctx) => {
    const m = await import("./margin/ui");
    if (!ctx.alive()) return undefined;
    await m.mountMargin(host);
    return m.unmountMargin;
  },
  "radix": async (host, ctx) => {
    const m = await import("./radix/ui");
    if (!ctx.alive()) return undefined;
    await m.mountRadix(host);
    return m.unmountRadix;
  },
  "duration": async (host, ctx) => {
    const m = await import("./duration/ui");
    if (!ctx.alive()) return undefined;
    await m.mountDuration(host);
    return m.unmountDuration;
  },
  "tdee": async (host, ctx) => {
    const m = await import("./tdee/ui");
    if (!ctx.alive()) return undefined;
    m.mountTdee(host);
    return m.unmountTdee;
  },
  "cidr": async (host, ctx) => {
    const m = await import("./cidr/ui");
    if (!ctx.alive()) return undefined;
    m.mountCidr(host);
    return m.unmountCidr;
  },
  "chmod": async (host, ctx) => {
    const m = await import("./chmod/ui");
    if (!ctx.alive()) return undefined;
    m.mountChmod(host);
    return m.unmountChmod;
  },
  "typing": async (host, ctx) => {
    const m = await import("./typing/ui");
    if (!ctx.alive()) return undefined;
    m.mountTyping(host);
    return m.unmountTyping;
  },
  "image-colors": async (host, ctx) => {
    const m = await import("./image-colors/ui");
    if (!ctx.alive()) return undefined;
    m.mountImageColors(host);
    return m.unmountImageColors;
  },
  "oil": async (host, ctx) => {
    const m = await import("./assets/ui");
    if (!ctx.alive()) return undefined;
    await m.mountOil(host);
    return m.unmountAssets;
  },
  "stocks": async (host, ctx) => {
    const m = await import("./assets/ui");
    if (!ctx.alive()) return undefined;
    await m.mountStocks(host);
    return m.unmountAssets;
  },
  "resize": async (host, ctx) => {
    const m = await import("./resize/ui");
    if (!ctx.alive()) return undefined;
    await m.mountResize(host);
    return m.unmountResize;
  },
  "crop": async (host, ctx) => {
    const m = await import("./crop/ui");
    if (!ctx.alive()) return undefined;
    await m.mountCrop(host);
    return m.unmountCrop;
  },
  "rotate": async (host, ctx) => {
    const m = await import("./rotate/ui");
    if (!ctx.alive()) return undefined;
    await m.mountRotate(host);
    return m.unmountRotate;
  },
  "exif": async (host, ctx) => {
    const m = await import("./exif/ui");
    if (!ctx.alive()) return undefined;
    await m.mountExif(host);
    return m.unmountExif;
  },
  "meme": async (host, ctx) => {
    const m = await import("./meme/ui");
    if (!ctx.alive()) return undefined;
    await m.mountMeme(host);
    return m.unmountMeme;
  },
  "invoice": async (host, ctx) => {
    const m = await import("./invoice/ui");
    if (!ctx.alive()) return undefined;
    await m.mountInvoice(host);
    return m.unmountInvoice;
  },
  "signature": async (host, ctx) => {
    const m = await import("./signature/ui");
    if (!ctx.alive()) return undefined;
    await m.mountSignature(host);
    return m.unmountSignature;
  },
  "favicon": async (host, ctx) => {
    const m = await import("./favicon/ui");
    if (!ctx.alive()) return undefined;
    await m.mountFavicon(host);
    return m.unmountFavicon;
  },
  "gold": async (host, ctx) => {
    const m = await import("./assets/ui");
    if (!ctx.alive()) return undefined;
    m.mountMetal(host, "gold");
    return m.unmountAssets;
  },
  "silver": async (host, ctx) => {
    const m = await import("./assets/ui");
    if (!ctx.alive()) return undefined;
    m.mountMetal(host, "silver");
    return m.unmountAssets;
  },
  "platinum": async (host, ctx) => {
    const m = await import("./assets/ui");
    if (!ctx.alive()) return undefined;
    m.mountMetal(host, "platinum");
    return m.unmountAssets;
  },
  "palladium": async (host, ctx) => {
    const m = await import("./assets/ui");
    if (!ctx.alive()) return undefined;
    m.mountMetal(host, "palladium");
    return m.unmountAssets;
  },
  "pdf-jpg": async (host, ctx) => {
    const m = await import("./pdf-jpg/ui");
    if (!ctx.alive()) return undefined;
    await m.mountPdfJpg(host);
    return m.unmountPdfJpg;
  },
  "merge-pdf": async (host, ctx) => {
    const m = await import("./merge-pdf/ui");
    if (!ctx.alive()) return undefined;
    await m.mountMergePdf(host);
    return m.unmountMergePdf;
  },
  "compress-pdf": async (host, ctx) => {
    const m = await import("./compress-pdf/ui");
    if (!ctx.alive()) return undefined;
    await m.mountCompressPdf(host);
    return m.unmountCompressPdf;
  },
  "split-pdf": async (host, ctx) => {
    const m = await import("./split-pdf/ui");
    if (!ctx.alive()) return undefined;
    await m.mountSplitPdf(host);
    return m.unmountSplitPdf;
  },
  "portrait-sim": async (host, ctx) => {
    const m = await import("./portrait-sim/ui");
    if (!ctx.alive()) return undefined;
    await m.mountPortraitSim(host);
    return m.unmountPortraitSim;
  },
  "remove-background": async (host, ctx) => {
    const m = await import("./remove-background/ui");
    if (!ctx.alive()) return undefined;
    await m.mountRemoveBackground(host);
    return m.unmountRemoveBackground;
  },
  "image-upscaler": async (host, ctx) => {
    const m = await import("./image-upscaler/ui");
    if (!ctx.alive()) return undefined;
    await m.mountImageUpscaler(host);
    return m.unmountImageUpscaler;
  },
  "speech-to-text": async (host, ctx) => {
    const m = await import("./speech-to-text/ui");
    if (!ctx.alive()) return undefined;
    await m.mountSpeechToText(host);
    return m.unmountSpeechToText;
  },
  "depth-map": async (host, ctx) => {
    const m = await import("./depth-map/ui");
    if (!ctx.alive()) return undefined;
    await m.mountDepthMap(host);
    return m.unmountDepthMap;
  },
  "dice": async (host, ctx) => {
    const m = await import("./dice/ui");
    if (!ctx.alive()) return undefined;
    m.mountDice(host);
    return m.unmountDice;
  },
  "gpa": async (host, ctx) => {
    const m = await import("./gpa/ui");
    if (!ctx.alive()) return undefined;
    m.mountGpa(host);
    return m.unmountGpa;
  },
  "pomodoro": async (host, ctx) => {
    const m = await import("./pomodoro/ui");
    if (!ctx.alive()) return undefined;
    m.mountPomodoro(host);
    return m.unmountPomodoro;
  },
  "sleep": async (host, ctx) => {
    const m = await import("./sleep/ui");
    if (!ctx.alive()) return undefined;
    m.mountSleep(host);
    return m.unmountSleep;
  },
  "body-fat": async (host, ctx) => {
    const m = await import("./body-fat/ui");
    if (!ctx.alive()) return undefined;
    m.mountBodyFat(host);
    return m.unmountBodyFat;
  },
  "contrast": async (host, ctx) => {
    const m = await import("./contrast/ui");
    if (!ctx.alive()) return undefined;
    m.mountContrast(host);
    return m.unmountContrast;
  },
  "pace": async (host, ctx) => {
    const m = await import("./pace/ui");
    if (!ctx.alive()) return undefined;
    m.mountPace(host);
    return m.unmountPace;
  },
  "grade": async (host, ctx) => {
    const m = await import("./grade/ui");
    if (!ctx.alive()) return undefined;
    m.mountGrade(host);
    return m.unmountGrade;
  },
};
