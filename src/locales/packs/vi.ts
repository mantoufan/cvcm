import ui from "../vi.json";
import device from "../device/vi.json";
import gameNames from "../games/vi.json?names";
import guides from "../guides/vi.json";
import markets from "../markets/vi.json";
import type { LocaleMessages } from "../../shared/messages";

export default { ui, gameNames, guides, device, markets } satisfies LocaleMessages;
