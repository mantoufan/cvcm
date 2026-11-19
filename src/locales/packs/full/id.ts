// Every string of this locale, for the Worker and the tests (messages-all). The browser loads ../id.ts instead.
import ui from "../../id.json";
import device from "../../device/id.json";
import guides from "../../guides/id.json";
import markets from "../../markets/id.json";
import type { LocaleMessages } from "../../../shared/messages";

export default { ui, guides, device, markets } satisfies LocaleMessages;
