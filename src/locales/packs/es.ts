import ui from "../es.json";
import device from "../device/es.json";
import gameNames from "../games/es.json?names";
import guides from "../guides/es.json";
import markets from "../markets/es.json";
import type { LocaleMessages } from "../../shared/messages";

export default { ui, gameNames, guides, device, markets } satisfies LocaleMessages;
