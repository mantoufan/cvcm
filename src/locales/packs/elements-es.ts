// Periodic table copy, this locale's element names, the English names and the PubChem rows, loaded only on /periodic-table/ pages.
import copy from "../elements/es.json";
import names from "../elements/names/es.json";
import english from "../elements/names/en.json";
import data from "../../shared/elements-data.json";
import type { ElementRow } from "../../shared/elements-i18n";
import type { ElementsMessages } from "../../shared/messages";

export default { ...copy, names, english, data: data as ElementRow[] } satisfies ElementsMessages;
