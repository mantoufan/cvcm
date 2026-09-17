export type BmiBand = "under" | "normal" | "over" | "obese";

export function bmiFrom(kg: number, cm: number): number | null {
  if (!Number.isFinite(kg) || !Number.isFinite(cm) || kg <= 0 || cm <= 0) return null;
  const m = cm / 100;
  return kg / (m * m);
}

export function bmiBand(value: number): BmiBand {
  if (value < 18.5) return "under";
  if (value < 25) return "normal";
  if (value < 30) return "over";
  return "obese";
}
