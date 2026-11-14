/**
 * Net worth: what you own minus what you owe, with the U.S. Federal Reserve's 2022 Survey of Consumer Finances median
 * and mean household net worth by age of the head of household (2022 dollars, Federal Reserve Bulletin, October 2023)
 * for comparison.
 */

export const ASSET_FIELDS = ["cash", "investments", "retirement", "home", "vehicles", "otherAssets"] as const;
export const DEBT_FIELDS = ["mortgage", "carLoans", "studentLoans", "cards", "otherDebts"] as const;
export type AssetField = (typeof ASSET_FIELDS)[number];
export type DebtField = (typeof DEBT_FIELDS)[number];

export type AgeBand = "under35" | "35to44" | "45to54" | "55to64" | "65to74" | "75plus";
export const SCF_2022: Record<AgeBand, { median: number; mean: number }> = {
  under35: { median: 39_040, mean: 183_500 },
  "35to44": { median: 135_600, mean: 549_600 },
  "45to54": { median: 247_200, mean: 975_800 },
  "55to64": { median: 364_270, mean: 1_566_900 },
  "65to74": { median: 409_900, mean: 1_794_600 },
  "75plus": { median: 335_600, mean: 1_624_100 },
};

export function ageBand(age: number): AgeBand | null {
  if (!Number.isFinite(age) || age < 15 || age > 120) return null;
  if (age < 35) return "under35";
  if (age < 45) return "35to44";
  if (age < 55) return "45to54";
  if (age < 65) return "55to64";
  if (age < 75) return "65to74";
  return "75plus";
}

export type NetWorth = { assets: number; debts: number; netWorth: number; debtToAsset: number | null };

/** Blank fields count as 0; negative entries are read as their size (a debt is typed as a positive amount). */
export function netWorth(assets: Partial<Record<AssetField, number>>, debts: Partial<Record<DebtField, number>>): NetWorth {
  const sum = (o: Record<string, number | undefined>) =>
    Object.values(o).reduce<number>((s, v) => s + (typeof v === "number" && Number.isFinite(v) ? Math.abs(v) : 0), 0);
  const a = sum(assets);
  const d = sum(debts);
  return { assets: a, debts: d, netWorth: a - d, debtToAsset: a > 0 ? d / a : null };
}
