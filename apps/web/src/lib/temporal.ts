import type { Temporal as TemporalTypes } from "temporal-polyfill";

// Native first; the locally bundled fallback is downloaded only when needed.
// No CDN, global mutation, Date arithmetic, or browser-local timezone fallback.
export async function getTemporal(): Promise<typeof TemporalTypes> {
  const native = (globalThis as typeof globalThis & { Temporal?: typeof TemporalTypes }).Temporal;
  return native ?? (await import("temporal-polyfill")).Temporal;
}
