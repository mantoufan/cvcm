// Emoji meanings copy, this locale's CLDR names and keywords, the English names, the usage sentences and the
// emoji-test rows, loaded only on /emoji/ pages.
import copy from "../emoji/ko.json";
import names from "../emoji/names/ko.json";
import usage from "../emoji/usage/ko.json";
import data from "../../shared/emoji-data.json";
import type { EmojiRow } from "../../shared/emoji-i18n";
import type { EmojiMessages } from "../../shared/messages";

export default { ...copy, ...names, usage, data: data as EmojiRow[] } satisfies EmojiMessages;
