// Every string of this locale, for the Worker and the tests (messages-all). The browser loads ../ja.ts instead.
import ui from "../../ja.json";
import device from "../../device/ja.json";
import gameNames from "../../games/ja.json?names";
import guides from "../../guides/ja.json";
import markets from "../../markets/ja.json";
import type { LocaleMessages } from "../../../shared/messages";

export default { ui, gameNames, guides, device, markets } satisfies LocaleMessages;
