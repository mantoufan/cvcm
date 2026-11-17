// Countries copy and the list data (capitals, flags, population), loaded only on /countries/ pages.
import copy from "../countries/en.json";
import summary from "../../shared/countries/summary.json";
import type { CountriesMessages, CountriesSummary } from "../../shared/countries-store";

export default { ...copy, summary: summary as unknown as CountriesSummary } satisfies CountriesMessages;
