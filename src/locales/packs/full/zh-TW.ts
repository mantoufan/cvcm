// Every string of this locale, for the Worker and the tests (messages-all). The browser loads ../zh-TW.ts instead.
import ui from "../../zh-TW.json";
import device from "../../device/zh-TW.json";
import guides from "../../guides/zh-TW.json";
import markets from "../../markets/zh-TW.json";
import type { LocaleMessages } from "../../../shared/messages";

export default { ui, guides, device, markets } satisfies LocaleMessages;
