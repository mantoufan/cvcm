// Every country pack and data bucket, registered at once: the Worker, the prerender and tests (src/shared/messages-all.ts).
import enCountries from "../locales/packs/countries-en";
import zhCNCountries from "../locales/packs/countries-zh-CN";
import zhTWCountries from "../locales/packs/countries-zh-TW";
import jaCountries from "../locales/packs/countries-ja";
import koCountries from "../locales/packs/countries-ko";
import viCountries from "../locales/packs/countries-vi";
import idCountries from "../locales/packs/countries-id";
import esCountries from "../locales/packs/countries-es";
import b0 from "./countries/b0.json";
import b1 from "./countries/b1.json";
import b2 from "./countries/b2.json";
import b3 from "./countries/b3.json";
import b4 from "./countries/b4.json";
import b5 from "./countries/b5.json";
import b6 from "./countries/b6.json";
import b7 from "./countries/b7.json";
import b8 from "./countries/b8.json";
import b9 from "./countries/b9.json";
import b10 from "./countries/b10.json";
import b11 from "./countries/b11.json";
import b12 from "./countries/b12.json";
import b13 from "./countries/b13.json";
import b14 from "./countries/b14.json";
import b15 from "./countries/b15.json";
import type { Locale } from "./locale";
import { registerCountriesMessages, registerCountryBucket, type CountryDetail } from "./countries-store";

const PACKS: Record<Locale, Parameters<typeof registerCountriesMessages>[1]> = {
  "en": enCountries,
  "zh-CN": zhCNCountries,
  "zh-TW": zhTWCountries,
  "ja": jaCountries,
  "ko": koCountries,
  "vi": viCountries,
  "id": idCountries,
  "es": esCountries,
};
for (const [locale, pack] of Object.entries(PACKS)) registerCountriesMessages(locale as Locale, pack);
[b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15].forEach((bucket, n) => registerCountryBucket(n, bucket as unknown as Record<string, CountryDetail>));
