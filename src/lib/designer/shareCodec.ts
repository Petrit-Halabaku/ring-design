import type { RingValue } from "./types";

const PREFIX = "#c=";

/**
 * Encodes the config into a URL hash. Deliberately lossy-tolerant: decode returns a
 * Partial and the hook merges it over defaults, so a link made by an older build never
 * throws — it just fills in what it recognises.
 */
export function encodeConfig(v: RingValue): string {
  const json = JSON.stringify(v);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return PREFIX + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeConfig(hash: string): Partial<RingValue> | null {
  if (!hash.startsWith(PREFIX)) return null;
  try {
    const b64 = hash.slice(PREFIX.length).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    // Array.isArray matters for honesty of the return type, not safety: `typeof [] === "object"`,
    // so `#c=` carrying `[1,2]` would otherwise be cast to Partial<RingValue>. The merge guard
    // in useRingConfig drops its "0"/"1" keys anyway, but the contract should not lie.
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Partial<RingValue>)
      : null;
  } catch {
    return null;
  }
}
