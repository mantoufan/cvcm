// Calendar copy plus the astronomy tables and holiday lists, loaded only on /calendar/ pages.
import copy from "../calendar/vi.json";
import astro from "../../shared/calendar-data.json";
import holidayData from "../../shared/calendar-holidays.json";
import type { CalendarMessages } from "../../shared/messages";

export default { ...copy, astro, holidayData } satisfies CalendarMessages;
