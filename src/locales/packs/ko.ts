import ui from "../ko.json";
import device from "../device/ko.json";
import gameNames from "../games/ko.json?names";
import guides from "../guides/ko.json";
import markets from "../markets/ko.json";
import type { LocaleMessages } from "../../shared/messages";

export default { ui, gameNames, guides, device, markets } satisfies LocaleMessages;
