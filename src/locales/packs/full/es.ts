// Every string of this locale, for the Worker and the tests (messages-all). The browser loads ../es.ts instead.
import ui from "../../es.json";
import device from "../../device/es.json";
import guides from "../../guides/es.json";
import markets from "../../markets/es.json";
import type { LocaleMessages } from "../../../shared/messages";

export default { ui, guides, device, markets } satisfies LocaleMessages;
