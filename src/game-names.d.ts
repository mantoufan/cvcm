declare module "*.json?names" {
  const names: Record<string, { name: string; blurb: string }>;
  export default names;
}
