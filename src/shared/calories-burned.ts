/**
 * MET values from the 2011 Compendium of Physical Activities (Ainsworth et al.).
 * kcal = MET × body weight in kg × hours.
 */
export const ACTIVITIES = [
  { id: "walkSlow", met: 2.8 },
  { id: "walkBrisk", met: 4.3 },
  { id: "run8", met: 8.3 },
  { id: "run10", met: 9.8 },
  { id: "cycleLeisure", met: 4.0 },
  { id: "cycleModerate", met: 8.0 },
  { id: "swim", met: 5.8 },
  { id: "yoga", met: 2.5 },
  { id: "weights", met: 3.5 },
  { id: "hiit", met: 8.0 },
  { id: "jumpRope", met: 11.8 },
  { id: "badminton", met: 5.5 },
  { id: "basketball", met: 6.5 },
  { id: "dance", met: 5.0 },
  { id: "housework", met: 3.3 },
  { id: "stairs", met: 8.8 },
] as const;
export type ActivityId = (typeof ACTIVITIES)[number]["id"];

export function metOf(id: ActivityId): number {
  return ACTIVITIES.find((a) => a.id === id)?.met ?? 0;
}

export type BurnResult = { kcal: number; perMinute: number; met: number; /** Approximate fat-equivalent grams at 7.7 kcal/g. */ fatGrams: number };

export function caloriesBurned(id: ActivityId, kg: number, minutes: number): BurnResult | null {
  const met = metOf(id);
  if (!met || !Number.isFinite(kg) || kg < 20 || kg > 300 || !Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) return null;
  const kcal = met * kg * (minutes / 60);
  return { kcal, perMinute: kcal / minutes, met, fatGrams: kcal / 7.7 };
}
