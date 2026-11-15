// The browser's core pack for this locale: every string except the copy only one page shows. A tool's FAQ and how-to
// and a tutorial's text come in bucket chunks (src/shared/page-copy.ts; full/es.ts has everything).
// Data only, no dynamic imports: the chunk's name then changes only when the copy does, so it stays cached across deploys.
import ui from "virtual:page-copy/ui/es";
import guides from "virtual:page-copy/guides/es";
import device from "../device/es.json";
import gameNames from "../games/es.json?names";
import markets from "../markets/es.json";
import type { LocaleMessages } from "../../shared/messages";

export default { ui, gameNames, guides, device, markets } satisfies LocaleMessages;
