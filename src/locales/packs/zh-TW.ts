// The browser's core pack for this locale: every string except the copy only one page shows. A tool's FAQ and how-to
// and a tutorial's text come in bucket chunks (copy-zh-TW.ts, src/shared/page-copy.ts; full/zh-TW.ts has everything).
// Data only, no dynamic imports: the chunk's name then changes only when the copy does, so it stays cached across deploys.
import ui from "virtual:page-copy/ui/zh-TW";
import guides from "virtual:page-copy/guides/zh-TW";
import device from "../device/zh-TW.json";
import gameNames from "../games/zh-TW.json?names";
import markets from "../markets/zh-TW.json";
import type { LocaleMessages } from "../../shared/messages";

export default { ui, gameNames, guides, device, markets } satisfies LocaleMessages;
