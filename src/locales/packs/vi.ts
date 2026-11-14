// The browser's core pack for this locale: every string except the copy only one page shows. A tool's FAQ and how-to
// and a tutorial's text come in bucket chunks (copy-vi.ts, src/shared/page-copy.ts; full/vi.ts has everything).
// Data only, no dynamic imports: the chunk's name then changes only when the copy does, so it stays cached across deploys.
import ui from "virtual:page-copy/ui/vi";
import guides from "virtual:page-copy/guides/vi";
import device from "../device/vi.json";
import gameNames from "../games/vi.json?names";
import markets from "../markets/vi.json";
import type { LocaleMessages } from "../../shared/messages";

export default { ui, gameNames, guides, device, markets } satisfies LocaleMessages;
