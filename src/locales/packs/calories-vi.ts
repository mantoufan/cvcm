// Calories copy, food names and the USDA FoodData Central snapshot, loaded only on /calories/ pages.
import copy from "../calories/vi.json";
import data from "../../shared/calories-data.json";
import type { CaloriesMessages } from "../../shared/messages";
import type { CaloriesData } from "../../shared/calories-i18n";

export default { ...copy, data: data as unknown as CaloriesData } as CaloriesMessages;
