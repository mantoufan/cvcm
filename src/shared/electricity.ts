export type ElectricityInput = { watts: number; hoursPerDay: number; days: number; pricePerKwh: number; quantity?: number };
export type ElectricityResult = { kwhPerDay: number; kwh: number; cost: number; costPerDay: number; costPerYear: number };

export const MAX_WATTS = 100000;

/** Energy = watts × hours ÷ 1000 (kWh); cost = kWh × price. */
export function electricityCost(input: ElectricityInput): ElectricityResult | null {
  const { watts, hoursPerDay, days, pricePerKwh } = input;
  const quantity = input.quantity ?? 1;
  if (![watts, hoursPerDay, days, pricePerKwh, quantity].every(Number.isFinite)) return null;
  if (watts <= 0 || watts > MAX_WATTS || hoursPerDay <= 0 || hoursPerDay > 24 || days <= 0 || days > 3660 || pricePerKwh < 0) return null;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) return null;
  const kwhPerDay = (watts * hoursPerDay * quantity) / 1000;
  return {
    kwhPerDay,
    kwh: kwhPerDay * days,
    cost: kwhPerDay * days * pricePerKwh,
    costPerDay: kwhPerDay * pricePerKwh,
    costPerYear: kwhPerDay * 365 * pricePerKwh,
  };
}

/** Common appliances with typical running watts, for the preset list. */
export const APPLIANCES = [
  { id: "led", watts: 10 },
  { id: "laptop", watts: 50 },
  { id: "tv", watts: 100 },
  { id: "fridge", watts: 150 },
  { id: "desktop", watts: 300 },
  { id: "aircon", watts: 1000 },
  { id: "heater", watts: 2000 },
  { id: "kettle", watts: 2200 },
] as const;
export type ApplianceId = (typeof APPLIANCES)[number]["id"];
