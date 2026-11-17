// One chunk per bucket of countries (`countryBucket`): a profile loads only the bucket that holds its figures.
export const COUNTRY_BUCKET_LOADERS: Array<() => Promise<{ default: unknown }>> = [
  () => import("./b0.json"),
  () => import("./b1.json"),
  () => import("./b2.json"),
  () => import("./b3.json"),
  () => import("./b4.json"),
  () => import("./b5.json"),
  () => import("./b6.json"),
  () => import("./b7.json"),
  () => import("./b8.json"),
  () => import("./b9.json"),
  () => import("./b10.json"),
  () => import("./b11.json"),
  () => import("./b12.json"),
  () => import("./b13.json"),
  () => import("./b14.json"),
  () => import("./b15.json"),
];
