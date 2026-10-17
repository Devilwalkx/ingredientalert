import { ROLE_LABEL, rolesAt, type AppState } from "@ingredientalert/core";

export const productName = (s: AppState, id: string | null) => (id ? s.products.find((p) => p.id === id)?.name ?? id : "Unknown product");
export const staffName = (s: AppState, id: string) => (s.staff.find((x) => x.id === id)?.name ?? id).split(" ")[0]!;
export const staffFull = (s: AppState, id: string) => s.staff.find((x) => x.id === id)?.name ?? id;
export function roleLine(s: AppState, id: string, site: string): string {
  const roles = rolesAt(s, id, site).map((r) => ROLE_LABEL[r]);
  return roles.length ? roles.join(", ") : "no role here";
}
export function newRequestId(): string {
  const a = new Uint8Array(8);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
