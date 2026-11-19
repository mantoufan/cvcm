// Emoji meanings copy, this locale's CLDR names and keywords, the English names, the usage sentences and the
// emoji-test rows, loaded only on /emoji/ pages.
import copy from "../emoji/vi.json";
import names from "../emoji/names/vi.json";
import usage from "../emoji/usage/vi.json";
import data from "../../shared/emoji-data.json";
import type { EmojiRow } from "../../shared/emoji-i18n";
import type { EmojiMessages } from "../../shared/messages";

export default { ...copy, ...names, usage, data: data as EmojiRow[] } satisfies EmojiMessages;
