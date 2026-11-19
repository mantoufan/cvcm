// Every string of this locale, for the Worker and the tests (messages-all). The browser loads ../en.ts instead.
import ui from "../../en.json";
import device from "../../device/en.json";
import guides from "../../guides/en.json";
import markets from "../../markets/en.json";
import type { LocaleMessages } from "../../../shared/messages";

export default { ui, guides, device, markets } satisfies LocaleMessages;
