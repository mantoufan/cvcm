export type EconomyUnit = "l100km" | "kml" | "mpg";
export const KM_PER_MI = 1.609344;
export const L_PER_US_GAL = 3.785411784;

export type FuelInput = {
  distance: number;
  /** km when `distanceUnit` is km, miles otherwise. */
  distanceUnit: "km" | "mi";
  economy: number;
  economyUnit: EconomyUnit;
  /** Price per litre (or per US gallon when `pricePerGallon`). */
  price: number;
  pricePerGallon?: boolean;
  roundTrip?: boolean;
  people?: number;
};

export type FuelResult = { km: number; litres: number; cost: number; perPerson: number; costPer100km: number };

/** Litres used per 100 km for any economy unit. */
export function toL100km(economy: number, unit: EconomyUnit): number {
  if (unit === "l100km") return economy;
  if (unit === "kml") return 100 / economy;
  // US mpg
  return (100 * L_PER_US_GAL) / (economy * KM_PER_MI);
}

export function fuelCost(input: FuelInput): FuelResult | null {
  const { distance, economy, price } = input;
  if (![distance, economy, price].every(Number.isFinite) || distance <= 0 || economy <= 0 || price < 0) return null;
  if (distance > 100000 || economy > 1000) return null;
  const people = input.people ?? 1;
  if (!Number.isInteger(people) || people < 1 || people > 100) return null;
  let km = input.distanceUnit === "mi" ? distance * KM_PER_MI : distance;
  if (input.roundTrip) km *= 2;
  const litres = (km / 100) * toL100km(economy, input.economyUnit);
  const pricePerL = input.pricePerGallon ? price / L_PER_US_GAL : price;
  const cost = litres * pricePerL;
  return { km, litres, cost, perPerson: cost / people, costPer100km: km > 0 ? (cost / km) * 100 : 0 };
}
