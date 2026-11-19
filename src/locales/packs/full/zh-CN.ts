// Every string of this locale, for the Worker and the tests (messages-all). The browser loads ../zh-CN.ts instead.
import ui from "../../zh-CN.json";
import device from "../../device/zh-CN.json";
import guides from "../../guides/zh-CN.json";
import markets from "../../markets/zh-CN.json";
import type { LocaleMessages } from "../../../shared/messages";

export default { ui, guides, device, markets } satisfies LocaleMessages;
