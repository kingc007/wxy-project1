declare module "virtual:fixtures" {
  export const fixtures: Record<string, { fetchedAt: string; body: unknown; file: string }>;
  export const fixtureMeta: { count: number; firstFetchedAt: string; lastFetchedAt: string; hosts: string[] };
}
declare module "virtual:lots" {
  export const lots: { bbl: string; address: string; query: string; category: string; label: string }[];
}
declare module "*?raw" { const s: string; export default s; }
declare module "virtual:zr-gz" { const s: string; export default s; }
