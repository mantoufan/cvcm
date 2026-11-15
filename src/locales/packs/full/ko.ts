// Every string of this locale, for the Worker and the tests (messages-all). The browser loads ../ko.ts instead.
import ui from "../../ko.json";
import device from "../../device/ko.json";
import gameNames from "../../games/ko.json?names";
import guides from "../../guides/ko.json";
import markets from "../../markets/ko.json";
import type { LocaleMessages } from "../../../shared/messages";

export default { ui, gameNames, guides, device, markets } satisfies LocaleMessages;
