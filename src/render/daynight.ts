import { hex, mix, type RGB } from "./color";

// A 12-minute day: dawn, bright day, golden afternoon, dusk, then night.
// `tint` multiplies the whole scene; `night` (0..1) brings out the moon,
// stars, fireflies and lantern glow.

export const DAY_LENGTH = 720; // seconds

const KEYS: [number, string, number][] = [
  // phase, tint, night
  [0.0, "#f3c9b8", 0.15], // dawn
  [0.08, "#ffffff", 0],
  [0.45, "#ffffff", 0],
  [0.56, "#ffd9a3", 0], // golden hour
  [0.64, "#d39ab8", 0.3], // dusk
  [0.7, "#5a6aa8", 0.85],
  [0.75, "#46558f", 1], // night
  [0.93, "#46558f", 1],
  [1.0, "#f3c9b8", 0.15],
];

export interface Light {
  phase: number;
  tint: RGB;
  night: number;
}

export function lightAt(phase: number): Light {
  const p = ((phase % 1) + 1) % 1;
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [a, ta, na] = KEYS[i];
    const [b, tb, nb] = KEYS[i + 1];
    if (p >= a && p <= b) {
      const t = (p - a) / (b - a);
      return { phase: p, tint: mix(hex(ta), hex(tb), t), night: na + (nb - na) * t };
    }
  }
  return { phase: p, tint: hex("#ffffff"), night: 0 };
}

// The phase follows the real clock, so it carries on between visits.
export function currentPhase(nowMs = Date.now()): number {
  return ((nowMs / 1000) % DAY_LENGTH) / DAY_LENGTH;
}
