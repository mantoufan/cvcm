// Emoji meanings copy, this locale's CLDR names and keywords, the English names, the usage sentences and the
// emoji-test rows, loaded only on /emoji/ pages.
import copy from "../emoji/ja.json";
import names from "../emoji/names/ja.json";
import usage from "../emoji/usage/ja.json";
import data from "../../shared/emoji-data.json";
import type { EmojiRow } from "../../shared/emoji-i18n";
import type { EmojiMessages } from "../../shared/messages";

export default { ...copy, ...names, usage, data: data as EmojiRow[] } satisfies EmojiMessages;
