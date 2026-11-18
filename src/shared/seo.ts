import { GAME_COVER, LEARN_COVER, TOOL_COVER, coverUrl, localizedTutorialSrc } from "./covers";
import { devicePageCopy } from "./device-i18n";
import type { DevicePageId } from "./device";
import { gameById, gamesFaqBase, type GameConsoleId, type GameId } from "./games";
import { gameCopy, gameFaqItems } from "./games-i18n";
import { gameGuideSteps, walkthroughImage } from "./game-walkthrough";
import { legalPageCopy } from "./legal";
import { quizDescription, quizTitle } from "./quiz-i18n";
import type { QuizId } from "./quiz";
import { datasetDescription, datasetTitle } from "./datasets-i18n";
import type { DatasetId } from "./datasets";
import type { RankingId } from "./rankings";
import { rankingDescription, rankingTitle } from "./rankings-i18n";
import { kbDescription, kbTitle } from "./kb-i18n";
import type { KbPage } from "./kb";
import { refDescription, refTitle } from "./ref-i18n";
import type { RefId } from "./ref";
import { slangDescription, slangTitle } from "./slang-i18n";
import type { SlangId } from "./slang";
import { ideaDescription, ideaTitle } from "./ideas-i18n";
import type { IdeaId } from "./ideas";
import { nostalgiaDescription, nostalgiaTitle } from "./nostalgia-i18n";
import type { NostalgiaId } from "./nostalgia";
import { summariesDescription, summariesTitle } from "./summaries-i18n";
import type { SummaryId } from "./summaries";
import { countryDescription, countryTitle } from "./countries-i18n";
import { caloriesDescription, caloriesTitle } from "./calories-i18n";
import type { FoodId } from "./calories";
import { elementsDescription, elementsTitle } from "./elements-i18n";
import type { ElementSlug } from "./elements";
import { calendarDescription, calendarTitle } from "./calendar-i18n";
import type { CalendarPage } from "./calendar";
import { TUTORIAL_DIAGRAMS, tutorialSteps } from "./learn";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./locale";
import { messages } from "./messages";
import { HREFLANG } from "./sitemap";
import { marketCopy, marketFaqItems, marketHub, marketHubFaqItems } from "./markets-i18n";
import type { MarketId } from "./markets";
import { appHref, categoryOf, deviceHref, gameHubOf, gamesHref, learnHref, kbHref, legalHref, marketsHref, quizHref, datasetHref, rankingHref, refHref, slangHref, ideasHref, nostalgiaHref, summariesHref, countriesHref, caloriesHref, elementsHref, calendarHref, type CategoryId, type ConvertJobId, type LegalPageId, type ResizeJobId, type ToolId, type TutorialId } from "./path";


export type FaqItem = { q: string; a: string };

export function lookup(locale: Locale, path: string): string {
  const parts = path.split(".");
  let node: unknown = messages(locale).ui;
  for (const part of parts) {
    if (typeof node !== "object" || node === null || !(part in node)) return path;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : path;
}

export type SeoInput = {
  tool?: ToolId | null;
  clipId?: string | null;
  convertJob?: ConvertJobId | null;
  resizeJob?: ResizeJobId | null;
  tutorial?: TutorialId | null;
  learn?: boolean;
  games?: boolean;
  console?: GameConsoleId | null;
  game?: GameId | null;
  markets?: boolean;
  market?: MarketId | null;
  devicePage?: DevicePageId | null;
  legalPage?: LegalPageId | null;
  /** A test page under /tests/; `quizId` null is the hub. */
  quiz?: boolean;
  quizId?: QuizId | null;
  /** A data table under /datasets/; `datasetId` null is the hub. */
  dataset?: boolean;
  datasetId?: DatasetId | null;
  /** A ranking under /rankings/; `rankingId` null is the hub. */
  ranking?: boolean;
  rankingId?: RankingId | null;
  /** A kb page under /learn/knowledge/, /learn/code/, /learn/ai/ or /learn/photography/; `kbId` null is the knowledge hub, "code" the coding hub, "ai" the AI hub, "photo" the photography hub. */
  kb?: boolean;
  kbId?: KbPage;
  /** The pose and style reference under /reference/; `refId` null is the hub. */
  ref?: boolean;
  refId?: RefId | null;
  /** The slang dictionary under /slang/; `slangId` null is the hub. */
  slang?: boolean;
  slangId?: SlangId | null;
  /** The ideas channel under /ideas/; `ideaId` null is the hub. */
  ideas?: boolean;
  ideaId?: IdeaId | null;
  /** The nostalgia channel under /nostalgia/; `nostalgiaId` null is the hub. */
  nostalgia?: boolean;
  nostalgiaId?: NostalgiaId | null;
  /** The summaries channel under /summaries/; `summaryId` null is the hub. */
  summaries?: boolean;
  summaryId?: SummaryId | null;
  /** Country profiles under /countries/; `countryId` is the slug, null the hub. */
  countries?: boolean;
  countryId?: string | null;
  /** The calories channel under /calories/; `foodId` null is the hub. */
  calories?: boolean;
  foodId?: FoodId | null;
  /** The periodic table under /periodic-table/; `elementSlug` null is the hub. */
  elements?: boolean;
  elementSlug?: ElementSlug | null;
  /** The calendar channel under /calendar/; `calendarPage` "hub" is the hub. */
  calendar?: boolean;
  calendarPage?: CalendarPage;
};

const TITLE: Record<ToolId, string> = {
  clip: "meta.titleClip",
  qr: "meta.titleQr",
  barcode: "meta.titleBarcode",
  watermark: "meta.titleWatermark",
  mosaic: "meta.titleMosaic",
  collage: "meta.titleCollage",
  "portrait-sim": "meta.titlePortraitSim",
  resize: "meta.titleResize",
  crop: "meta.titleCrop",
  rotate: "meta.titleRotate",
  exif: "meta.titleExif",
  meme: "meta.titleMeme",
  signature: "meta.titleSignature",
  favicon: "meta.titleFavicon",
  screenshot: "meta.titleScreenshot",
  convert: "meta.titleConvert",
  "image-pdf": "meta.titleImagePdf",
  "pdf-jpg": "meta.titlePdfJpg",
  "merge-pdf": "meta.titleMergePdf",
  "compress-pdf": "meta.titleCompressPdf",
  "split-pdf": "meta.titleSplitPdf",
  invoice: "meta.titleInvoice",
  audio: "meta.titleAudio",
  "audio-cutter": "meta.titleAudioCutter",
  "audio-joiner": "meta.titleAudioJoiner",
  data: "meta.titleData",
  "xml-json": "meta.titleXmlJson",
  "yaml-json": "meta.titleYamlJson",
  password: "meta.titlePassword",
  "word-count": "meta.titleWordCount",
  color: "meta.titleColor",
  "hex-rgb": "meta.titleHexRgb",
  names: "meta.titleNames",
  timezone: "meta.titleTimezone",
  timestamp: "meta.titleTimestamp",
  lorem: "meta.titleLorem",
  units: "meta.titleUnits",
  "text-to-speech": "meta.titleTts",
  diff: "meta.titleDiff",
  uuid: "meta.titleUuid",
  hash: "meta.titleHash",
  regex: "meta.titleRegex",
  case: "meta.titleCase",
  jwt: "meta.titleJwt",
  percent: "meta.titlePercent",
  random: "meta.titleRandom",
  html: "meta.titleHtml",
  cron: "meta.titleCron",
  slug: "meta.titleSlug",
  age: "meta.titleAge",
  bmi: "meta.titleBmi",
  binary: "meta.titleBinary",
  tip: "meta.titleTip",
  morse: "meta.titleMorse",
  roman: "meta.titleRoman",
  discount: "meta.titleDiscount",
  countdown: "meta.titleCountdown",
  loan: "meta.titleLoan",
  stopwatch: "meta.titleStopwatch",
  compound: "meta.titleCompound",
  vat: "meta.titleVat",
  reverse: "meta.titleReverse",
  "url-encode": "meta.titleUrlEncode",
  "text-hex": "meta.titleTextHex",
  json: "meta.titleJson",
  base64: "meta.titleBase64",
  days: "meta.titleDays",
  sort: "meta.titleSort",
  replace: "meta.titleReplace",
  words: "meta.titleWords",
  "add-days": "meta.titleAddDays",
  week: "meta.titleWeek",
  aspect: "meta.titleAspect",
  workdays: "meta.titleWorkdays",
  fraction: "meta.titleFraction",
  hourly: "meta.titleHourly",
  margin: "meta.titleMargin",
  radix: "meta.titleRadix",
  duration: "meta.titleDuration",
  tdee: "meta.titleTdee",
  cidr: "meta.titleCidr",
  chmod: "meta.titleChmod",
  typing: "meta.titleTyping",
  "image-colors": "meta.titleImageColors",
  dice: "meta.titleDice",
  gpa: "meta.titleGpa",
  pomodoro: "meta.titlePomodoro",
  sleep: "meta.titleSleep",
  "body-fat": "meta.titleBodyFat",
  contrast: "meta.titleContrast",
  pace: "meta.titlePace",
  grade: "meta.titleGrade",
  "due-date": "meta.titleDueDate",
  "ideal-weight": "meta.titleIdealWeight",
  "water-intake": "meta.titleWaterIntake",
  "fuel-cost": "meta.titleFuelCost",
  "reading-time": "meta.titleReadingTime",
  "time-card": "meta.titleTimeCard",
  "electricity": "meta.titleElectricity",
  "ovulation": "meta.titleOvulation",
  "macro": "meta.titleMacro",
  "calories-burned": "meta.titleCaloriesBurned",
  "wheel": "meta.titleWheel",
  "average": "meta.titleAverage",
  "metronome": "meta.titleMetronome",
  "keyboard-test": "meta.titleKeyboardTest",
  "zodiac": "meta.titleZodiac",
  "click-test": "meta.titleClickTest",
  "reaction-time": "meta.titleReactionTime",
  "tone-generator": "meta.titleToneGenerator",
  "tally-counter": "meta.titleTallyCounter",
  "mic-test": "meta.titleMicTest",
  "webcam-test": "meta.titleWebcamTest",
  "gamepad-test": "meta.titleGamepadTest",
  "dead-pixel": "meta.titleDeadPixel",
  "refresh-rate": "meta.titleRefreshRate",
  "touch-test": "meta.titleTouchTest",
  "rom-emulator": "meta.titleRomEmulator",
  "flash-player": "meta.titleFlashPlayer",
  "coin-flip": "meta.titleCoinFlip",
  "guitar-tuner": "meta.titleGuitarTuner",
  "factors": "meta.titleFactors",
  "lcm-gcf": "meta.titleLcmGcf",
  "tier-list": "meta.titleTierList",
  "calculator": "meta.titleCalculator",
  "notepad": "meta.titleNotepad",
  "markdown": "meta.titleMarkdown",
  "gradient": "meta.titleGradient",
  "fancy-text": "meta.titleFancyText",
  "mortgage": "meta.titleMortgage",
  "quadratic": "meta.titleQuadratic",
  "team-generator": "meta.titleTeamGenerator",
  "screen-resolution": "meta.titleScreenResolution",
  "alarm": "meta.titleAlarm",
  "white-noise": "meta.titleWhiteNoise",
  "decibel-meter": "meta.titleDecibelMeter",
  "voice-recorder": "meta.titleVoiceRecorder",
  "screen-recorder": "meta.titleScreenRecorder",
  "triangle": "meta.titleTriangle",
  "gif-maker": "meta.titleGifMaker",
  "image-splitter": "meta.titleImageSplitter",
  "area": "meta.titleArea",
  "volume": "meta.titleVolume",
  "random-letter": "meta.titleRandomLetter",
  "word-unscrambler": "meta.titleWordUnscrambler",
  "concrete": "meta.titleConcrete",
  "graphing-calculator": "meta.titleGraphingCalculator",
  "piano": "meta.titlePiano",
  "slope": "meta.titleSlope",
  "sudoku": "meta.titleSudoku",
  "tic-tac-toe": "meta.titleTicTacToe",
  "color-blindness-test": "meta.titleColorBlindnessTest",
  "military-time": "meta.titleMilitaryTime",
  "idea-validator": "meta.titleIdeaValidator",
  "height-calculator": "meta.titleHeightCalculator",
  "hangman": "meta.titleHangman",
  "rock-paper-scissors": "meta.titleRockPaperScissors",
  "bac-calculator": "meta.titleBacCalculator",
  "simple-interest": "meta.titleSimpleInterest",
  "2048": "meta.title2048",
  "dinosaur-game": "meta.titleDinosaurGame",
  "mahjong": "meta.titleMahjong",
  "chess": "meta.titleChess",
  "chinese-chess": "meta.titleChineseChess",
  "solitaire": "meta.titleSolitaire",
  "spider-solitaire": "meta.titleSpiderSolitaire",
  "freecell": "meta.titleFreecell",
  "minesweeper": "meta.titleMinesweeper",
  "snake-game": "meta.titleSnakeGame",
  "checkers": "meta.titleCheckers",
  "reversi": "meta.titleReversi",
  "gomoku": "meta.titleGomoku",
  "nonogram": "meta.titleNonogram",
  "memory-game": "meta.titleMemoryGame",
  "word-search": "meta.titleWordSearch",
  "typing-game": "meta.titleTypingGame",
  "typing-practice": "meta.titleTypingPractice",
  "chinese-checkers": "meta.titleChineseCheckers",
  "phone-number-value": "meta.titlePhoneNumberValue",
  "license-plate-value": "meta.titleLicensePlateValue",
  "domain-value": "meta.titleDomainValue",
  "car-depreciation": "meta.titleCarDepreciation",
  "net-worth": "meta.titleNetWorth",
  "business-valuation": "meta.titleBusinessValuation",
  gold: "meta.titleGold",
  silver: "meta.titleSilver",
  platinum: "meta.titlePlatinum",
  palladium: "meta.titlePalladium",
  oil: "meta.titleOil",
  stocks: "meta.titleStocks",
  "remove-background": "meta.titleRemoveBg",
  "image-upscaler": "meta.titleUpscaler",
  "speech-to-text": "meta.titleStt",
  "depth-map": "meta.titleDepthMap",
  v: "meta.titleV",
  "ai-image-generator": "meta.titleImageGen",
  "ai-music-generator": "meta.titleMusicGen",
  "standard-deviation": "meta.titleStandardDeviation",
  "sample-size": "meta.titleSampleSize",
  "cronbach-alpha": "meta.titleCronbachAlpha",
  "t-test": "meta.titleTTest",
  "chi-square": "meta.titleChiSquare",
  "p-value": "meta.titlePValue",
  "z-score": "meta.titleZScore",
  "lunar-converter": "meta.titleLunarConverter",
  "3d-chess": "meta.titleChess3d",
  "magic-cube": "meta.titleMagicCube",
  "stack-game": "meta.titleStackGame",
  "driving-game": "meta.titleDrivingGame",
  "flight-simulator": "meta.titleFlightSimulator",
};

const CONVERT_JOB_TITLE: Record<ConvertJobId, string> = {
  "heic-to-jpg": "meta.titleJobHeicToJpg",
  "webp-to-png": "meta.titleJobWebpToPng",
  "png-to-jpg": "meta.titleJobPngToJpg",
  "jpg-to-png": "meta.titleJobJpgToPng",
  "avif-to-jpg": "meta.titleJobAvifToJpg",
  "png-to-webp": "meta.titleJobPngToWebp",
  "svg-to-png": "meta.titleJobSvgToPng",
};

const CONVERT_JOB_DESC: Record<ConvertJobId, string> = {
  "heic-to-jpg": "meta.descJobHeicToJpg",
  "webp-to-png": "meta.descJobWebpToPng",
  "png-to-jpg": "meta.descJobPngToJpg",
  "jpg-to-png": "meta.descJobJpgToPng",
  "avif-to-jpg": "meta.descJobAvifToJpg",
  "png-to-webp": "meta.descJobPngToWebp",
  "svg-to-png": "meta.descJobSvgToPng",
};

const RESIZE_JOB_TITLE: Record<ResizeJobId, string> = {
  "compress-image": "meta.titleJobCompressImage",
};
const RESIZE_JOB_DESC: Record<ResizeJobId, string> = {
  "compress-image": "meta.descJobCompressImage",
};

const DESC: Record<ToolId, string> = {
  clip: "meta.descClip",
  qr: "meta.descQr",
  barcode: "meta.descBarcode",
  watermark: "meta.descWatermark",
  mosaic: "meta.descMosaic",
  collage: "meta.descCollage",
  "portrait-sim": "meta.descPortraitSim",
  resize: "meta.descResize",
  crop: "meta.descCrop",
  rotate: "meta.descRotate",
  exif: "meta.descExif",
  meme: "meta.descMeme",
  signature: "meta.descSignature",
  favicon: "meta.descFavicon",
  screenshot: "meta.descScreenshot",
  convert: "meta.descConvert",
  "image-pdf": "meta.descImagePdf",
  "pdf-jpg": "meta.descPdfJpg",
  "merge-pdf": "meta.descMergePdf",
  "compress-pdf": "meta.descCompressPdf",
  "split-pdf": "meta.descSplitPdf",
  invoice: "meta.descInvoice",
  audio: "meta.descAudio",
  "audio-cutter": "meta.descAudioCutter",
  "audio-joiner": "meta.descAudioJoiner",
  data: "meta.descData",
  "xml-json": "meta.descXmlJson",
  "yaml-json": "meta.descYamlJson",
  password: "meta.descPassword",
  "word-count": "meta.descWordCount",
  color: "meta.descColor",
  "hex-rgb": "meta.descHexRgb",
  names: "meta.descNames",
  timezone: "meta.descTimezone",
  timestamp: "meta.descTimestamp",
  lorem: "meta.descLorem",
  units: "meta.descUnits",
  "text-to-speech": "meta.descTts",
  diff: "meta.descDiff",
  uuid: "meta.descUuid",
  hash: "meta.descHash",
  regex: "meta.descRegex",
  case: "meta.descCase",
  jwt: "meta.descJwt",
  percent: "meta.descPercent",
  random: "meta.descRandom",
  html: "meta.descHtml",
  cron: "meta.descCron",
  slug: "meta.descSlug",
  age: "meta.descAge",
  bmi: "meta.descBmi",
  binary: "meta.descBinary",
  tip: "meta.descTip",
  morse: "meta.descMorse",
  roman: "meta.descRoman",
  discount: "meta.descDiscount",
  countdown: "meta.descCountdown",
  loan: "meta.descLoan",
  stopwatch: "meta.descStopwatch",
  compound: "meta.descCompound",
  vat: "meta.descVat",
  reverse: "meta.descReverse",
  "url-encode": "meta.descUrlEncode",
  "text-hex": "meta.descTextHex",
  json: "meta.descJson",
  base64: "meta.descBase64",
  days: "meta.descDays",
  sort: "meta.descSort",
  replace: "meta.descReplace",
  words: "meta.descWords",
  "add-days": "meta.descAddDays",
  week: "meta.descWeek",
  aspect: "meta.descAspect",
  workdays: "meta.descWorkdays",
  fraction: "meta.descFraction",
  hourly: "meta.descHourly",
  margin: "meta.descMargin",
  radix: "meta.descRadix",
  duration: "meta.descDuration",
  tdee: "meta.descTdee",
  cidr: "meta.descCidr",
  chmod: "meta.descChmod",
  typing: "meta.descTyping",
  "image-colors": "meta.descImageColors",
  dice: "meta.descDice",
  gpa: "meta.descGpa",
  pomodoro: "meta.descPomodoro",
  sleep: "meta.descSleep",
  "body-fat": "meta.descBodyFat",
  contrast: "meta.descContrast",
  pace: "meta.descPace",
  grade: "meta.descGrade",
  "due-date": "meta.descDueDate",
  "ideal-weight": "meta.descIdealWeight",
  "water-intake": "meta.descWaterIntake",
  "fuel-cost": "meta.descFuelCost",
  "reading-time": "meta.descReadingTime",
  "time-card": "meta.descTimeCard",
  "electricity": "meta.descElectricity",
  "ovulation": "meta.descOvulation",
  "macro": "meta.descMacro",
  "calories-burned": "meta.descCaloriesBurned",
  "wheel": "meta.descWheel",
  "average": "meta.descAverage",
  "metronome": "meta.descMetronome",
  "keyboard-test": "meta.descKeyboardTest",
  "zodiac": "meta.descZodiac",
  "click-test": "meta.descClickTest",
  "reaction-time": "meta.descReactionTime",
  "tone-generator": "meta.descToneGenerator",
  "tally-counter": "meta.descTallyCounter",
  "mic-test": "meta.descMicTest",
  "webcam-test": "meta.descWebcamTest",
  "gamepad-test": "meta.descGamepadTest",
  "dead-pixel": "meta.descDeadPixel",
  "refresh-rate": "meta.descRefreshRate",
  "touch-test": "meta.descTouchTest",
  "rom-emulator": "meta.descRomEmulator",
  "flash-player": "meta.descFlashPlayer",
  "coin-flip": "meta.descCoinFlip",
  "guitar-tuner": "meta.descGuitarTuner",
  "factors": "meta.descFactors",
  "lcm-gcf": "meta.descLcmGcf",
  "tier-list": "meta.descTierList",
  "calculator": "meta.descCalculator",
  "notepad": "meta.descNotepad",
  "markdown": "meta.descMarkdown",
  "gradient": "meta.descGradient",
  "fancy-text": "meta.descFancyText",
  "mortgage": "meta.descMortgage",
  "quadratic": "meta.descQuadratic",
  "team-generator": "meta.descTeamGenerator",
  "screen-resolution": "meta.descScreenResolution",
  "alarm": "meta.descAlarm",
  "white-noise": "meta.descWhiteNoise",
  "decibel-meter": "meta.descDecibelMeter",
  "voice-recorder": "meta.descVoiceRecorder",
  "screen-recorder": "meta.descScreenRecorder",
  "triangle": "meta.descTriangle",
  "gif-maker": "meta.descGifMaker",
  "image-splitter": "meta.descImageSplitter",
  "area": "meta.descArea",
  "volume": "meta.descVolume",
  "random-letter": "meta.descRandomLetter",
  "word-unscrambler": "meta.descWordUnscrambler",
  "concrete": "meta.descConcrete",
  "graphing-calculator": "meta.descGraphingCalculator",
  "piano": "meta.descPiano",
  "slope": "meta.descSlope",
  "sudoku": "meta.descSudoku",
  "tic-tac-toe": "meta.descTicTacToe",
  "color-blindness-test": "meta.descColorBlindnessTest",
  "military-time": "meta.descMilitaryTime",
  "idea-validator": "meta.descIdeaValidator",
  "height-calculator": "meta.descHeightCalculator",
  "hangman": "meta.descHangman",
  "rock-paper-scissors": "meta.descRockPaperScissors",
  "bac-calculator": "meta.descBacCalculator",
  "simple-interest": "meta.descSimpleInterest",
  "2048": "meta.desc2048",
  "dinosaur-game": "meta.descDinosaurGame",
  "mahjong": "meta.descMahjong",
  "chess": "meta.descChess",
  "chinese-chess": "meta.descChineseChess",
  "solitaire": "meta.descSolitaire",
  "spider-solitaire": "meta.descSpiderSolitaire",
  "freecell": "meta.descFreecell",
  "minesweeper": "meta.descMinesweeper",
  "snake-game": "meta.descSnakeGame",
  "checkers": "meta.descCheckers",
  "reversi": "meta.descReversi",
  "gomoku": "meta.descGomoku",
  "nonogram": "meta.descNonogram",
  "memory-game": "meta.descMemoryGame",
  "word-search": "meta.descWordSearch",
  "typing-game": "meta.descTypingGame",
  "typing-practice": "meta.descTypingPractice",
  "chinese-checkers": "meta.descChineseCheckers",
  "phone-number-value": "meta.descPhoneNumberValue",
  "license-plate-value": "meta.descLicensePlateValue",
  "domain-value": "meta.descDomainValue",
  "car-depreciation": "meta.descCarDepreciation",
  "net-worth": "meta.descNetWorth",
  "business-valuation": "meta.descBusinessValuation",
  gold: "meta.descGold",
  silver: "meta.descSilver",
  platinum: "meta.descPlatinum",
  palladium: "meta.descPalladium",
  oil: "meta.descOil",
  stocks: "meta.descStocks",
  "remove-background": "meta.descRemoveBg",
  "image-upscaler": "meta.descUpscaler",
  "speech-to-text": "meta.descStt",
  "depth-map": "meta.descDepthMap",
  v: "meta.descV",
  "ai-image-generator": "meta.descImageGen",
  "ai-music-generator": "meta.descMusicGen",
  "standard-deviation": "meta.descStandardDeviation",
  "sample-size": "meta.descSampleSize",
  "cronbach-alpha": "meta.descCronbachAlpha",
  "t-test": "meta.descTTest",
  "chi-square": "meta.descChiSquare",
  "p-value": "meta.descPValue",
  "z-score": "meta.descZScore",
  "lunar-converter": "meta.descLunarConverter",
  "3d-chess": "meta.descChess3d",
  "magic-cube": "meta.descMagicCube",
  "stack-game": "meta.descStackGame",
  "driving-game": "meta.descDrivingGame",
  "flight-simulator": "meta.descFlightSimulator",
};

const LEARN_TITLE: Record<TutorialId, string> = {
  "make-qr": "meta.titleMakeQr",
  "make-barcode": "meta.titleMakeBarcode",
  "merge-pdf": "meta.titleLearnMergePdf",
  "compress-pdf": "meta.titleLearnCompressPdf",
  "heic-to-jpg": "meta.titleHeicToJpg",
  "jpg-to-pdf": "meta.titleJpgToPdf",
  "pdf-to-jpg": "meta.titleLearnPdfToJpg",
  "crop-photo": "meta.titleCropPhoto",
  "webp-to-png": "meta.titleWebpToPng",
  "resize-image": "meta.titleResizeImage",
  "split-pdf": "meta.titleLearnSplitPdf",
  "add-watermark": "meta.titleAddWatermark",
  "watermark-id-copy": "meta.titleWatermarkIdCopy",
  "mosaic-photo": "meta.titleMosaicPhoto",
  "remove-exif": "meta.titleRemoveExif",
  "make-collage": "meta.titleMakeCollage",
  "make-meme": "meta.titleMakeMeme",
  "count-words": "meta.titleCountWords",
  "trim-audio": "meta.titleTrimAudio",
  "png-to-jpg": "meta.titlePngToJpg",
  "jpg-to-png": "meta.titleJpgToPng",
  "avif-to-jpg": "meta.titleAvifToJpg",
  "rotate-photo": "meta.titleRotatePhoto",
  "png-to-webp": "meta.titlePngToWebp",
  "mp3-to-wav": "meta.titleMp3ToWav",
  "join-audio": "meta.titleJoinAudio",
  "make-favicon": "meta.titleMakeFavicon",
  "make-signature": "meta.titleMakeSignature",
  "annotate-screenshot": "meta.titleAnnotateScreenshot",
  "make-invoice": "meta.titleMakeInvoice",
  "make-password": "meta.titleMakePassword",
  "format-json": "meta.titleFormatJson",
  "decode-base64": "meta.titleDecodeBase64",
  "unix-time": "meta.titleUnixTime",
  "read-jwt": "meta.titleReadJwt",
  "count-workdays": "meta.titleCountWorkdays",
  "simplify-fraction": "meta.titleSimplifyFraction",
  "hourly-pay": "meta.titleHourlyPay",
  "convert-timezone": "meta.titleConvertTimezone",
  "profit-margin": "meta.titleProfitMargin",
  "convert-base": "meta.titleConvertBase",
  "add-duration": "meta.titleAddDuration",
  "calculate-percent": "meta.titleCalculatePercent",
  "days-between": "meta.titleDaysBetween",
  "shift-date": "meta.titleShiftDate",
  "iso-week": "meta.titleIsoWeek",
  "vat-price": "meta.titleVatPrice",
  "percent-off": "meta.titlePercentOff",
  "encode-url": "meta.titleEncodeUrl",
  "calculate-age": "meta.titleCalculateAge",
  "aspect-ratio": "meta.titleAspectRatio",
  "calculate-bmi": "meta.titleCalculateBmi",
  "split-tip": "meta.titleSplitTip",
  "loan-payment": "meta.titleLoanPayment",
  "read-cron": "meta.titleReadCron",
  "find-bedtime": "meta.titleFindBedtime",
  "measure-body-fat": "meta.titleMeasureBodyFat",
  "check-contrast": "meta.titleCheckContrast",
  "calculate-pace": "meta.titleCalculatePace",
  "calculate-final-grade": "meta.titleCalculateFinalGrade",
  "calculate-tdee": "meta.titleCalculateTdee",
  "calculate-gpa": "meta.titleCalculateGpa",
  "use-pomodoro": "meta.titleUsePomodoro",
  "find-due-date": "meta.titleFindDueDate",
  "find-ideal-weight": "meta.titleFindIdealWeight",
  "daily-water": "meta.titleDailyWater",
  "trip-fuel-cost": "meta.titleTripFuelCost",
  "estimate-reading-time": "meta.titleEstimateReadingTime",
  "compare-text": "meta.titleCompareText",
  "hash-text": "meta.titleHashText",
  "generate-uuid": "meta.titleGenerateUuid",
  "calculate-work-hours": "meta.titleCalculateWorkHours",
  "electricity-cost": "meta.titleElectricityCost",
  "pick-random-name": "meta.titlePickRandomName",
  "calculate-average": "meta.titleCalculateAverage",
  "use-metronome": "meta.titleUseMetronome",
  "test-keyboard": "meta.titleTestKeyboard",
  "find-zodiac-sign": "meta.titleFindZodiacSign",
  "test-click-speed": "meta.titleTestClickSpeed",
  "test-reaction-time": "meta.titleTestReactionTime",
  "generate-test-tone": "meta.titleGenerateTestTone",
  "test-microphone": "meta.titleTestMicrophone",
  "use-emulator": "meta.titleUseEmulator",
  "open-swf-file": "meta.titleOpenSwfFile",
  "use-tally-counter": "meta.titleUseTallyCounter",
  "test-webcam": "meta.titleTestWebcam",
  "test-gamepad": "meta.titleTestGamepad",
  "check-dead-pixels": "meta.titleCheckDeadPixels",
  "check-refresh-rate": "meta.titleCheckRefreshRate",
  "test-touch-screen": "meta.titleTestTouchScreen",
  "use-scientific-calculator": "meta.titleUseScientificCalculator",
  "use-online-notepad": "meta.titleUseOnlineNotepad",
  "preview-markdown": "meta.titlePreviewMarkdown",
  "make-css-gradient": "meta.titleMakeCssGradient",
  "make-fancy-text": "meta.titleMakeFancyText",
  "flip-coin": "meta.titleFlipCoin",
  "tune-guitar": "meta.titleTuneGuitar",
  "find-factors": "meta.titleFindFactors",
  "find-lcm-gcf": "meta.titleFindLcmGcf",
  "calculate-mortgage": "meta.titleCalculateMortgage",
  "solve-quadratic": "meta.titleSolveQuadratic",
  "make-random-teams": "meta.titleMakeRandomTeams",
  "check-screen-resolution": "meta.titleCheckScreenResolution",
  "set-online-alarm": "meta.titleSetOnlineAlarm",
  "play-white-noise": "meta.titlePlayWhiteNoise",
  "measure-decibels": "meta.titleMeasureDecibels",
  "record-voice-online": "meta.titleRecordVoiceOnline",
  "record-screen-online": "meta.titleRecordScreenOnline",
  "solve-triangle": "meta.titleSolveTriangle",
  "make-gif": "meta.titleMakeGif",
  "split-image": "meta.titleSplitImage",
  "calculate-area": "meta.titleCalculateArea",
  "calculate-volume": "meta.titleCalculateVolume",
  "pick-random-letter": "meta.titlePickRandomLetter",
  "unscramble-words": "meta.titleUnscrambleWords",
  "calculate-concrete": "meta.titleCalculateConcrete",
  "graph-functions": "meta.titleGraphFunctions",
  "play-piano-online": "meta.titlePlayPianoOnline",
  "find-slope": "meta.titleFindSlope",
  "play-sudoku": "meta.titlePlaySudoku",
  "play-tic-tac-toe": "meta.titlePlayTicTacToe",
  "test-color-blindness": "meta.titleTestColorBlindness",
  "convert-military-time": "meta.titleConvertMilitaryTime",
  "predict-child-height": "meta.titlePredictChildHeight",
  "play-hangman": "meta.titlePlayHangman",
  "play-rock-paper-scissors": "meta.titlePlayRockPaperScissors",
  "calculate-bac": "meta.titleCalculateBac",
  "calculate-simple-interest": "meta.titleCalculateSimpleInterest",
  "find-fertile-window": "meta.titleFindFertileWindow",
  "calculate-macros": "meta.titleCalculateMacros",
  "calories-burned-exercise": "meta.titleCaloriesBurnedExercise",
  "compound-interest": "meta.titleCompoundInterest",
  "remove-photo-background": "meta.titleRemovePhotoBackground",
  "test-regex": "meta.titleTestRegex",
  portrait: "meta.titlePortrait",
  algorithms: "meta.titleAlgorithms",
  "phone-photos": "meta.titlePhonePhotos",
  "window-light": "meta.titleWindowLight",
  "crop-compose": "meta.titleCropCompose",
  "badminton-warmup": "meta.titleBadmintonWarmup",
  "badminton-rules": "meta.titleBadmintonRules",
  "pool-safety": "meta.titlePoolSafety",
  "one-page-site": "meta.titleOnePageSite",
  "healthy-boundaries": "meta.titleHealthyBoundaries",
  "read-character": "meta.titleReadCharacter",
};

const LEARN_DESC: Record<TutorialId, string> = {
  "make-qr": "meta.descMakeQr",
  "make-barcode": "meta.descMakeBarcode",
  "merge-pdf": "meta.descLearnMergePdf",
  "compress-pdf": "meta.descLearnCompressPdf",
  "heic-to-jpg": "meta.descHeicToJpg",
  "jpg-to-pdf": "meta.descJpgToPdf",
  "pdf-to-jpg": "meta.descLearnPdfToJpg",
  "crop-photo": "meta.descCropPhoto",
  "webp-to-png": "meta.descWebpToPng",
  "resize-image": "meta.descResizeImage",
  "split-pdf": "meta.descLearnSplitPdf",
  "add-watermark": "meta.descAddWatermark",
  "watermark-id-copy": "meta.descWatermarkIdCopy",
  "mosaic-photo": "meta.descMosaicPhoto",
  "remove-exif": "meta.descRemoveExif",
  "make-collage": "meta.descMakeCollage",
  "make-meme": "meta.descMakeMeme",
  "count-words": "meta.descCountWords",
  "trim-audio": "meta.descTrimAudio",
  "png-to-jpg": "meta.descPngToJpg",
  "jpg-to-png": "meta.descJpgToPng",
  "avif-to-jpg": "meta.descAvifToJpg",
  "rotate-photo": "meta.descRotatePhoto",
  "png-to-webp": "meta.descPngToWebp",
  "mp3-to-wav": "meta.descMp3ToWav",
  "join-audio": "meta.descJoinAudio",
  "make-favicon": "meta.descMakeFavicon",
  "make-signature": "meta.descMakeSignature",
  "annotate-screenshot": "meta.descAnnotateScreenshot",
  "make-invoice": "meta.descMakeInvoice",
  "make-password": "meta.descMakePassword",
  "format-json": "meta.descFormatJson",
  "decode-base64": "meta.descDecodeBase64",
  "unix-time": "meta.descUnixTime",
  "read-jwt": "meta.descReadJwt",
  "count-workdays": "meta.descCountWorkdays",
  "simplify-fraction": "meta.descSimplifyFraction",
  "hourly-pay": "meta.descHourlyPay",
  "convert-timezone": "meta.descConvertTimezone",
  "profit-margin": "meta.descProfitMargin",
  "convert-base": "meta.descConvertBase",
  "add-duration": "meta.descAddDuration",
  "calculate-percent": "meta.descCalculatePercent",
  "days-between": "meta.descDaysBetween",
  "shift-date": "meta.descShiftDate",
  "iso-week": "meta.descIsoWeek",
  "vat-price": "meta.descVatPrice",
  "percent-off": "meta.descPercentOff",
  "encode-url": "meta.descEncodeUrl",
  "calculate-age": "meta.descCalculateAge",
  "aspect-ratio": "meta.descAspectRatio",
  "calculate-bmi": "meta.descCalculateBmi",
  "split-tip": "meta.descSplitTip",
  "loan-payment": "meta.descLoanPayment",
  "read-cron": "meta.descReadCron",
  "find-bedtime": "meta.descFindBedtime",
  "measure-body-fat": "meta.descMeasureBodyFat",
  "check-contrast": "meta.descCheckContrast",
  "calculate-pace": "meta.descCalculatePace",
  "calculate-final-grade": "meta.descCalculateFinalGrade",
  "calculate-tdee": "meta.descCalculateTdee",
  "calculate-gpa": "meta.descCalculateGpa",
  "use-pomodoro": "meta.descUsePomodoro",
  "find-due-date": "meta.descFindDueDate",
  "find-ideal-weight": "meta.descFindIdealWeight",
  "daily-water": "meta.descDailyWater",
  "trip-fuel-cost": "meta.descTripFuelCost",
  "estimate-reading-time": "meta.descEstimateReadingTime",
  "compare-text": "meta.descCompareText",
  "hash-text": "meta.descHashText",
  "generate-uuid": "meta.descGenerateUuid",
  "calculate-work-hours": "meta.descCalculateWorkHours",
  "electricity-cost": "meta.descElectricityCost",
  "pick-random-name": "meta.descPickRandomName",
  "calculate-average": "meta.descCalculateAverage",
  "use-metronome": "meta.descUseMetronome",
  "test-keyboard": "meta.descTestKeyboard",
  "find-zodiac-sign": "meta.descFindZodiacSign",
  "test-click-speed": "meta.descTestClickSpeed",
  "test-reaction-time": "meta.descTestReactionTime",
  "generate-test-tone": "meta.descGenerateTestTone",
  "test-microphone": "meta.descTestMicrophone",
  "use-emulator": "meta.descUseEmulator",
  "open-swf-file": "meta.descOpenSwfFile",
  "use-tally-counter": "meta.descUseTallyCounter",
  "test-webcam": "meta.descTestWebcam",
  "test-gamepad": "meta.descTestGamepad",
  "check-dead-pixels": "meta.descCheckDeadPixels",
  "check-refresh-rate": "meta.descCheckRefreshRate",
  "test-touch-screen": "meta.descTestTouchScreen",
  "use-scientific-calculator": "meta.descUseScientificCalculator",
  "use-online-notepad": "meta.descUseOnlineNotepad",
  "preview-markdown": "meta.descPreviewMarkdown",
  "make-css-gradient": "meta.descMakeCssGradient",
  "make-fancy-text": "meta.descMakeFancyText",
  "flip-coin": "meta.descFlipCoin",
  "tune-guitar": "meta.descTuneGuitar",
  "find-factors": "meta.descFindFactors",
  "find-lcm-gcf": "meta.descFindLcmGcf",
  "calculate-mortgage": "meta.descCalculateMortgage",
  "solve-quadratic": "meta.descSolveQuadratic",
  "make-random-teams": "meta.descMakeRandomTeams",
  "check-screen-resolution": "meta.descCheckScreenResolution",
  "set-online-alarm": "meta.descSetOnlineAlarm",
  "play-white-noise": "meta.descPlayWhiteNoise",
  "measure-decibels": "meta.descMeasureDecibels",
  "record-voice-online": "meta.descRecordVoiceOnline",
  "record-screen-online": "meta.descRecordScreenOnline",
  "solve-triangle": "meta.descSolveTriangle",
  "make-gif": "meta.descMakeGif",
  "split-image": "meta.descSplitImage",
  "calculate-area": "meta.descCalculateArea",
  "calculate-volume": "meta.descCalculateVolume",
  "pick-random-letter": "meta.descPickRandomLetter",
  "unscramble-words": "meta.descUnscrambleWords",
  "calculate-concrete": "meta.descCalculateConcrete",
  "graph-functions": "meta.descGraphFunctions",
  "play-piano-online": "meta.descPlayPianoOnline",
  "find-slope": "meta.descFindSlope",
  "play-sudoku": "meta.descPlaySudoku",
  "play-tic-tac-toe": "meta.descPlayTicTacToe",
  "test-color-blindness": "meta.descTestColorBlindness",
  "convert-military-time": "meta.descConvertMilitaryTime",
  "predict-child-height": "meta.descPredictChildHeight",
  "play-hangman": "meta.descPlayHangman",
  "play-rock-paper-scissors": "meta.descPlayRockPaperScissors",
  "calculate-bac": "meta.descCalculateBac",
  "calculate-simple-interest": "meta.descCalculateSimpleInterest",
  "find-fertile-window": "meta.descFindFertileWindow",
  "calculate-macros": "meta.descCalculateMacros",
  "calories-burned-exercise": "meta.descCaloriesBurnedExercise",
  "compound-interest": "meta.descCompoundInterest",
  "remove-photo-background": "meta.descRemovePhotoBackground",
  "test-regex": "meta.descTestRegex",
  portrait: "meta.descPortrait",
  algorithms: "meta.descAlgorithms",
  "phone-photos": "meta.descPhonePhotos",
  "window-light": "meta.descWindowLight",
  "crop-compose": "meta.descCropCompose",
  "badminton-warmup": "meta.descBadmintonWarmup",
  "badminton-rules": "meta.descBadmintonRules",
  "pool-safety": "meta.descPoolSafety",
  "one-page-site": "meta.descOnePageSite",
  "healthy-boundaries": "meta.descHealthyBoundaries",
  "read-character": "meta.descReadCharacter",
};

export function pageTitle(locale: Locale, input: SeoInput | ToolId | null = {}): string {
  const seo = normalizeSeo(input);
  if (seo.countries) return countryTitle(locale, seo.countryId ?? null);
  if (seo.nostalgia) return nostalgiaTitle(locale, seo.nostalgiaId ?? null);
  if (seo.summaries) return summariesTitle(locale, seo.summaryId ?? null);
  if (seo.elements) return elementsTitle(locale, seo.elementSlug ?? null);
  if (seo.calendar) return calendarTitle(locale, seo.calendarPage ?? "hub");
  if (seo.slang) return slangTitle(locale, seo.slangId ?? null);
  if (seo.ideas) return ideaTitle(locale, seo.ideaId ?? null);
  if (seo.ref) return refTitle(locale, seo.refId ?? null);
  if (seo.kb) return kbTitle(locale, seo.kbId ?? null);
  if (seo.learn) {
    return lookup(locale, seo.tutorial ? LEARN_TITLE[seo.tutorial] : "meta.titleLearn");
  }
  if (seo.games) {
    if (seo.game) return gameCopy(locale, seo.game).title;
    if (seo.console) return lookup(locale, `meta.titleGames${consoleMeta(seo.console)}`);
    return lookup(locale, "meta.titleGames");
  }
  if (seo.markets) return seo.market ? marketCopy(locale, seo.market).title : marketHub(locale).title;
  if (seo.devicePage) return devicePageCopy(locale, seo.devicePage).title;
  if (seo.quiz) return quizTitle(locale, seo.quizId ?? null);
  if (seo.dataset) return datasetTitle(locale, seo.datasetId ?? null);
  if (seo.ranking) return rankingTitle(locale, seo.rankingId ?? null);
  if (seo.calories) return caloriesTitle(locale, seo.foodId ?? null);
  if (seo.legalPage) return legalPageCopy(locale, seo.legalPage).title;
  if (seo.tool === "convert" && seo.convertJob) return lookup(locale, CONVERT_JOB_TITLE[seo.convertJob]);
  if (seo.tool === "resize" && seo.resizeJob) return lookup(locale, RESIZE_JOB_TITLE[seo.resizeJob]);
  return lookup(locale, seo.tool ? TITLE[seo.tool] : "meta.title");
}

export function pageDescription(locale: Locale, input: SeoInput | ToolId | null = {}): string {
  const seo = normalizeSeo(input);
  if (seo.countries) return countryDescription(locale, seo.countryId ?? null);
  if (seo.nostalgia) return nostalgiaDescription(locale, seo.nostalgiaId ?? null);
  if (seo.summaries) return summariesDescription(locale, seo.summaryId ?? null);
  if (seo.elements) return elementsDescription(locale, seo.elementSlug ?? null);
  if (seo.calendar) return calendarDescription(locale, seo.calendarPage ?? "hub");
  if (seo.slang) return slangDescription(locale, seo.slangId ?? null);
  if (seo.ideas) return ideaDescription(locale, seo.ideaId ?? null);
  if (seo.ref) return refDescription(locale, seo.refId ?? null);
  if (seo.kb) return kbDescription(locale, seo.kbId ?? null);
  if (seo.learn) {
    return lookup(locale, seo.tutorial ? LEARN_DESC[seo.tutorial] : "meta.descLearn");
  }
  if (seo.games) {
    if (seo.game) return gameCopy(locale, seo.game).description;
    if (seo.console) return lookup(locale, `meta.descGames${consoleMeta(seo.console)}`);
    return lookup(locale, "meta.descGames");
  }
  if (seo.markets) return seo.market ? marketCopy(locale, seo.market).description : marketHub(locale).description;
  if (seo.devicePage) return devicePageCopy(locale, seo.devicePage).description;
  if (seo.quiz) return quizDescription(locale, seo.quizId ?? null);
  if (seo.dataset) return datasetDescription(locale, seo.datasetId ?? null);
  if (seo.ranking) return rankingDescription(locale, seo.rankingId ?? null);
  if (seo.calories) return caloriesDescription(locale, seo.foodId ?? null);
  if (seo.legalPage) return legalPageCopy(locale, seo.legalPage).description;
  if (seo.tool === "convert" && seo.convertJob) return lookup(locale, CONVERT_JOB_DESC[seo.convertJob]);
  if (seo.tool === "resize" && seo.resizeJob) return lookup(locale, RESIZE_JOB_DESC[seo.resizeJob]);
  return lookup(locale, seo.tool ? DESC[seo.tool] : "meta.description");
}

export function hreflangAlternates(
  input: SeoInput | ToolId | null = {},
  clipId?: string | null,
): { hreflang: string; href: string }[] {
  const seo = normalizeSeo(input, clipId);
  const links = LOCALES.map((locale) => ({
    hreflang: HREFLANG[locale],
    href: pageCanonical(locale, seo),
  }));
  links.push({ hreflang: "x-default", href: pageCanonical(DEFAULT_LOCALE, seo) });
  return links;
}

export function pageCanonical(
  locale: Locale,
  input: SeoInput | ToolId | null = {},
  clipId?: string | null,
): string {
  const seo = normalizeSeo(input, clipId);
  if (seo.countries) return `https://cv.cm${countriesHref(locale, seo.countryId ?? null)}`;
  if (seo.nostalgia) return `https://cv.cm${nostalgiaHref(locale, seo.nostalgiaId ?? null)}`;
  if (seo.summaries) return `https://cv.cm${summariesHref(locale, seo.summaryId ?? null)}`;
  if (seo.elements) return `https://cv.cm${elementsHref(locale, seo.elementSlug ?? null)}`;
  if (seo.calendar) return `https://cv.cm${calendarHref(locale, seo.calendarPage ?? "hub")}`;
  if (seo.slang) return `https://cv.cm${slangHref(locale, seo.slangId ?? null)}`;
  if (seo.ideas) return `https://cv.cm${ideasHref(locale, seo.ideaId ?? null)}`;
  if (seo.ref) return `https://cv.cm${refHref(locale, seo.refId ?? null)}`;
  if (seo.kb) return `https://cv.cm${kbHref(locale, seo.kbId ?? null)}`;
  if (seo.learn) return `https://cv.cm${learnHref(locale, seo.tutorial ?? null)}`;
  if (seo.games) return `https://cv.cm${gamesHref(locale, seo.console ?? null, seo.game ?? null)}`;
  if (seo.markets) return `https://cv.cm${marketsHref(locale, seo.market ?? null)}`;
  if (seo.devicePage) return `https://cv.cm${deviceHref(locale, seo.devicePage)}`;
  if (seo.quiz) return `https://cv.cm${quizHref(locale, seo.quizId ?? null)}`;
  if (seo.dataset) return `https://cv.cm${datasetHref(locale, seo.datasetId ?? null)}`;
  if (seo.ranking) return `https://cv.cm${rankingHref(locale, seo.rankingId ?? null)}`;
  if (seo.calories) return `https://cv.cm${caloriesHref(locale, seo.foodId ?? null)}`;
  if (seo.legalPage) return `https://cv.cm${legalHref(locale, seo.legalPage)}`;
  return `https://cv.cm${appHref(locale, seo.tool ?? null, seo.clipId, seo.convertJob ?? seo.resizeJob)}`;
}

function consoleMeta(id: GameConsoleId): string {
  return id[0].toUpperCase() + id.slice(1);
}

export function normalizeSeo(input: SeoInput | ToolId | null, clipId?: string | null): SeoInput {
  if (typeof input === "string") return { tool: input, clipId };
  if (input == null) return { tool: null, clipId };
  return clipId !== undefined ? { ...input, clipId } : input;
}

function faqFrom(locale: Locale, base: string): FaqItem[] {
  const items: FaqItem[] = [];
  for (let i = 1; i <= 6; i++) {
    const qPath = `${base}.q${i}`;
    const q = lookup(locale, qPath);
    if (q === qPath) break;
    items.push({ q, a: lookup(locale, `${base}.a${i}`) });
  }
  return items;
}

export function faqItems(locale: Locale, tool: ToolId): FaqItem[] {
  return faqFrom(locale, `faq.${tool}`);
}

export function convertJobFaqItems(locale: Locale, job: ConvertJobId): FaqItem[] {
  return faqFrom(locale, `faq.convertJobs.${job}`);
}

export function resizeJobFaqItems(locale: Locale, job: ResizeJobId): FaqItem[] {
  return faqFrom(locale, `faq.resizeJobs.${job}`);
}

export function learnFaqItems(locale: Locale, tutorial: TutorialId): FaqItem[] {
  return faqFrom(locale, `faq.learn.${tutorial}`);
}

export function gamesHubFaqItems(locale: Locale, consoleId?: GameConsoleId | null): FaqItem[] {
  const base = gamesFaqBase(consoleId);
  if (base !== "faq.games") {
    const specific = faqFrom(locale, base);
    if (specific.length) return specific;
  }
  return faqFrom(locale, "faq.games");
}

export function flashHubHowToJsonLd(locale: Locale): Record<string, unknown> {
  const page = pageCanonical(locale, { games: true, console: "flash" });
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: lookup(locale, "meta.titleGamesFlash"),
    description: lookup(locale, "games.flash.lead"),
    step: [1, 2, 3, 4, 5].map((i) => ({
      "@type": "HowToStep",
      position: i,
      name: lookup(locale, `games.flash.s${i}t`),
      text: lookup(locale, `games.flash.s${i}b`),
      url: `${page}#flash-s${i}`,
    })),
  };
}

export function flashHubSoftwareJsonLd(locale: Locale): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: lookup(locale, "games.flash.title"),
    description: lookup(locale, "meta.descGamesFlash"),
    applicationCategory: "GameApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires JavaScript and WebAssembly",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    url: pageCanonical(locale, { games: true, console: "flash" }),
  };
}

export function marketBreadcrumbJsonLd(locale: Locale, id: MarketId | null): Record<string, unknown> {
  const hub = marketHub(locale);
  const items = [
    { name: lookup(locale, "nav.home"), url: pageCanonical(locale, { tool: null }) },
    { name: hub.name, url: pageCanonical(locale, { markets: true }) },
  ];
  if (id) {
    items.push({ name: marketCopy(locale, id).name, url: pageCanonical(locale, { markets: true, market: id }) });
  }
  return breadcrumbList(items);
}

export function faqJsonLd(
  locale: Locale,
  tool: ToolId | null,
  tutorial?: TutorialId | null,
  game?: GameId | null,
  gamesHub?: boolean,
  convertJob?: ConvertJobId | null,
  resizeJob?: ResizeJobId | null,
  market?: MarketId | null,
  marketsHub?: boolean,
  gamesConsole?: GameConsoleId | null,
): Record<string, unknown> | null {
  const items = market
    ? marketFaqItems(locale, market)
    : marketsHub
      ? marketHubFaqItems(locale)
      : game
        ? gameFaqItems(locale, game)
        : gamesHub
          ? gamesHubFaqItems(locale, gamesConsole)
          : tutorial
        ? learnFaqItems(locale, tutorial)
        : tool === "convert" && convertJob
          ? convertJobFaqItems(locale, convertJob)
          : tool === "resize" && resizeJob
            ? resizeJobFaqItems(locale, resizeJob)
            : tool
              ? faqItems(locale, tool)
              : [];
  if (items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function howToJsonLd(locale: Locale, tutorial: TutorialId): Record<string, unknown> {
  const steps = [];
  const count = tutorialSteps(tutorial);
  for (let i = 1; i <= count; i++) {
    steps.push({
      "@type": "HowToStep",
      position: i,
      ...(TUTORIAL_DIAGRAMS[tutorial]?.find((d) => d.step === i)
        ? { image: coverUrl(localizedTutorialSrc(TUTORIAL_DIAGRAMS[tutorial]!.find((d) => d.step === i)!.src, locale)) } : {}),
      name: lookup(locale, `learn.${tutorial}.s${i}t`),
      text: lookup(locale, `learn.${tutorial}.s${i}b`),
      url: `${pageCanonical(locale, { learn: true, tutorial })}#step-${i}`,
    });
  }
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: lookup(locale, `learn.${tutorial}.title`),
    description: lookup(locale, `learn.${tutorial}.lead`),
    image: coverUrl(LEARN_COVER[tutorial]),
    step: steps,
  };
}

export function gameHowToJsonLd(locale: Locale, id: GameId): Record<string, unknown> {
  const copy = gameCopy(locale, id);
  const game = gameById(id)!;
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: copy.title,
    description: copy.lead,
    image: coverUrl(GAME_COVER[id]),
    step: gameGuideSteps(locale, id).map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: step.title,
      text: step.body,
      url: `${pageCanonical(locale, { games: true, console: game.console, game: id })}#guide-${step.id}`,
      ...(step.image ? { image: coverUrl(walkthroughImage(id, step.image)) } : {}),
    })),
  };
}

export function gameVideoGameJsonLd(locale: Locale, id: GameId): Record<string, unknown> {
  const copy = gameCopy(locale, id);
  const game = gameById(id)!;
  return {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: copy.name,
    description: copy.description,
    image: coverUrl(GAME_COVER[id]),
    gamePlatform: lookup(locale, `games.consoles.${game.console}`),
    genre: lookup(locale, `games.genres.${game.genre}`),
    datePublished: String(game.year),
    url: pageCanonical(locale, { games: true, console: game.console, game: id }),
  };
}

/** schema.org applicationCategory per tool category (values Google's software app rich results know). */
const APP_CATEGORY: Partial<Record<CategoryId, string>> = {
  image: "MultimediaApplication",
  ai: "MultimediaApplication",
  audio: "MultimediaApplication",
  pdf: "BusinessApplication",
  dev: "DeveloperApplication",
  math: "EducationalApplication",
  finance: "FinanceApplication",
  health: "HealthApplication",
  design: "DesignApplication",
  games: "GameApplication",
  wordgames: "GameApplication",
  games3d: "GameApplication",
  fun: "EntertainmentApplication",
  valuation: "FinanceApplication",
  academic: "EducationalApplication",
};
/** Tools sold under their own name (watermark + mosaic share the ID Watermark & Redact brand). */
export const BRANDED_TOOLS = new Set<ToolId>(["watermark", "mosaic"]);

export function toolSoftwareJsonLd(locale: Locale, tool: ToolId): Record<string, unknown> {
  const name = lookup(locale, `tools.${tool}.name`);
  const brand = BRANDED_TOOLS.has(tool) ? lookup(locale, "watermark.brand") : null;
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    // The watermark tool is named after the brand itself; don't print it twice.
    name: brand && brand !== name ? `${brand} · ${name}` : name,
    ...(brand && brand !== name ? { alternateName: [brand, name] } : {}),
    description: pageDescription(locale, tool),
    url: pageCanonical(locale, tool),
    image: coverUrl(TOOL_COVER[tool]),
    inLanguage: HREFLANG[locale],
    applicationCategory: APP_CATEGORY[categoryOf(tool)] ?? "UtilitiesApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@type": "Organization", name: "cv.cm", url: "https://cv.cm/" },
  };
}

function breadcrumbList(items: Array<{ name: string; url: string }>): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: item.url })),
  };
}

/** Home / Tutorials (/ this tutorial; null is the hub): the trail shown above the heading. */
export function tutorialBreadcrumbJsonLd(locale: Locale, tutorial: TutorialId | null): Record<string, unknown> {
  const items = [
    { name: lookup(locale, "nav.home"), url: pageCanonical(locale, { tool: null }) },
    { name: lookup(locale, "nav.learn"), url: pageCanonical(locale, { learn: true }) },
  ];
  if (tutorial) items.push({ name: lookup(locale, `learn.${tutorial}.name`), url: pageCanonical(locale, { learn: true, tutorial }) });
  return breadcrumbList(items);
}

/** Home / Games (/ console (/ game)): the trail shown above the games hub, a console hub or a game page. */
export function gameBreadcrumbJsonLd(locale: Locale, consoleId: GameConsoleId | null, id: GameId | null = null): Record<string, unknown> {
  const items = gamesTrail(locale, consoleId);
  if (consoleId && id) items.push({ name: gameCopy(locale, id).name, url: pageCanonical(locale, { games: true, console: consoleId, game: id }) });
  return breadcrumbList(items);
}

/** Home / Games (/ hub or console): the start of every games trail, game tool pages included. */
function gamesTrail(locale: Locale, consoleId: GameConsoleId | null): { name: string; url: string }[] {
  const items = [
    { name: lookup(locale, "nav.home"), url: pageCanonical(locale, { tool: null }) },
    { name: lookup(locale, "nav.games"), url: pageCanonical(locale, { games: true }) },
  ];
  if (consoleId) items.push({ name: lookup(locale, `games.consoles.${consoleId}`), url: pageCanonical(locale, { games: true, console: consoleId }) });
  return items;
}

/**
 * Home / this tool. The visible trail also shows "Tools", but that is an anchor on the home page, not a page of its
 * own, so it is left out of the structured data (a BreadcrumbList item should be a distinct URL). A game page lists
 * Home / Games / its hub / the game, like the visible trail.
 */
export function toolBreadcrumbJsonLd(locale: Locale, tool: ToolId): Record<string, unknown> {
  const hub = gameHubOf(tool);
  const start = hub ? gamesTrail(locale, hub) : [{ name: lookup(locale, "nav.home"), url: pageCanonical(locale, { tool: null }) }];
  return breadcrumbList([...start, { name: lookup(locale, `tools.${tool}.name`), url: pageCanonical(locale, tool) }]);
}
