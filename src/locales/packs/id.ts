import ui from "../id.json";
import device from "../device/id.json";
import gameNames from "../games/id.json?names";
import guides from "../guides/id.json";
import markets from "../markets/id.json";
import type { LocaleMessages } from "../../shared/messages";

export default { ui, gameNames, guides, device, markets } satisfies LocaleMessages;
