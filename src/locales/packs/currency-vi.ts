// Exchange-rate copy and the ECB reference-rate snapshot, loaded only on /currency/ pages.
import copy from "../currency/vi.json";
import data from "../../shared/currency-data.json";
import type { CurrencyData } from "../../shared/currency-i18n";
import type { CurrencyMessages } from "../../shared/messages";

export default { ...copy, data: data as CurrencyData } satisfies CurrencyMessages;
