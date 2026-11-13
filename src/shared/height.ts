/**
 * Child adult-height estimates: the mid-parental (Tanner) target and the CDC percentile projection.
 * Heights are in centimetres; the page converts feet and inches.
 */
import { STATURE_BOYS, STATURE_GIRLS, type LmsRow } from "./height-cdc";

export type Sex = "boy" | "girl";

/** Tanner's mid-parental target: the parents' mean ± 6.5 cm for the child's sex. */
export const SEX_OFFSET_CM = 6.5;
/** Tanner's target range: about two standard deviations, ±8.5 cm. */
export const TARGET_RANGE_CM = 8.5;
/** The CDC charts cover 2 to 20 years. */
export const MIN_AGE_MONTHS = 24;
export const MAX_AGE_MONTHS = 240;

/** Mid-parental height: (father + mother ± 13 cm) / 2, + for a boy and − for a girl, with the ±8.5 cm range. */
export function midParental(fatherCm: number, motherCm: number, sex: Sex): { cm: number; low: number; high: number } {
  const cm = (fatherCm + motherCm) / 2 + (sex === "boy" ? SEX_OFFSET_CM : -SEX_OFFSET_CM);
  return { cm, low: cm - TARGET_RANGE_CM, high: cm + TARGET_RANGE_CM };
}

/** L, M and S at an age in months, interpolated linearly between the CDC rows. */
export function lmsAt(sex: Sex, months: number): { L: number; M: number; S: number } {
  const table = sex === "boy" ? STATURE_BOYS : STATURE_GIRLS;
  const m = Math.min(MAX_AGE_MONTHS, Math.max(MIN_AGE_MONTHS, months));
  let i = table.findIndex((row) => row[0] >= m);
  if (i <= 0) i = 1;
  const a: LmsRow = table[i - 1]!;
  const b: LmsRow = table[i]!;
  const f = b[0] === a[0] ? 0 : (m - a[0]) / (b[0] - a[0]);
  const mix = (k: 1 | 2 | 3) => a[k] + (b[k] - a[k]) * f;
  // An exact row match (f = 1 at b) returns that row's own values.
  return { L: mix(1), M: mix(2), S: mix(3) };
}

/** z-score of a height with the LMS method: ((X / M)^L − 1) / (L × S). */
export function zScore(cm: number, lms: { L: number; M: number; S: number }): number {
  const { L, M, S } = lms;
  return Math.abs(L) < 1e-9 ? Math.log(cm / M) / S : ((cm / M) ** L - 1) / (L * S);
}

/** The height at a z-score: M × (1 + L × S × z)^(1 / L). */
export function heightAtZ(z: number, lms: { L: number; M: number; S: number }): number {
  const { L, M, S } = lms;
  return Math.abs(L) < 1e-9 ? M * Math.exp(S * z) : M * (1 + L * S * z) ** (1 / L);
}

/** Standard normal cumulative probability (Abramowitz–Stegun 7.1.26 erf, error under 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/**
 * The child's percentile today and the height at age 20 on the same percentile: the CDC growth-chart projection.
 * The projection caps z at ±3 so a typo does not project a 3-metre adult; `z` is the child's real score and
 * `capped` says when the projection used the cap.
 */
export function percentileProjection(sex: Sex, months: number, cm: number): { z: number; capped: boolean; percentile: number; adultCm: number } {
  const raw = zScore(cm, lmsAt(sex, months));
  const z = Math.max(-3, Math.min(3, raw));
  return { z: raw, capped: z !== raw, percentile: normalCdf(raw) * 100, adultCm: heightAtZ(z, lmsAt(sex, MAX_AGE_MONTHS)) };
}

/** Feet and inches as the other height tools show them (ideal weight, TDEE): one converter for the site. */
export { cmToFeetInches as toFeetInches, feetInchesToCm as fromFeetInches } from "./tdee";
