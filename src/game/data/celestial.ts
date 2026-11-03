// The Celestial Pond: permanent upgrades bought with Dragon Scales, kept
// through every ascension.

export type CelestialEffect =
  | { kind: "offlineRate"; mult: number }
  | { kind: "offlineCap"; hours: number }
  | { kind: "goldenFreq"; mult: number }
  | { kind: "clickMult"; mult: number }
  | { kind: "globalMult"; mult: number }
  | { kind: "rareBoost"; mult: number }
  | { kind: "startRestored"; stages: number }
  | { kind: "theme"; theme: string };

export interface CelestialDef {
  id: string;
  name: string;
  desc: string;
  cost: number; // Dragon Scales
  requires: string[];
  effects: CelestialEffect[];
}

export const CELESTIAL: CelestialDef[] = [
  { id: "moon-pearl", name: "Moon pearl", desc: "Offline earnings doubled.", cost: 1, requires: [], effects: [{ kind: "offlineRate", mult: 2 }] },
  { id: "dragon-whisker", name: "Dragon's whisker", desc: "Clicks earn twice as much.", cost: 2, requires: [], effects: [{ kind: "clickMult", mult: 2 }] },
  { id: "remembered-pond", name: "Remembered pond", desc: "Each new run starts with the first six restorations done.", cost: 3, requires: ["moon-pearl"], effects: [{ kind: "startRestored", stages: 6 }] },
  { id: "golden-currents", name: "Golden currents", desc: "The golden koi visits 25% more often.", cost: 5, requires: ["dragon-whisker"], effects: [{ kind: "goldenFreq", mult: 1.25 }] },
  { id: "rare-waters", name: "Rare waters", desc: "Rare koi varieties are three times as likely.", cost: 8, requires: ["remembered-pond"], effects: [{ kind: "rareBoost", mult: 3 }] },
  { id: "long-memory", name: "Long memory", desc: "Offline earnings build up for 24 hours instead of 12.", cost: 12, requires: ["moon-pearl"], effects: [{ kind: "offlineCap", hours: 24 }] },
  { id: "heavenly-ripples", name: "Heavenly ripples", desc: "All production +50%.", cost: 20, requires: ["golden-currents"], effects: [{ kind: "globalMult", mult: 1.5 }] },
  { id: "theme-moonlit", name: "Moonlit pond", desc: "Unlocks the moonlit theme: endless blue night.", cost: 15, requires: ["remembered-pond"], effects: [{ kind: "theme", theme: "moonlit" }] },
  { id: "theme-autumn", name: "Autumn pond", desc: "Unlocks the autumn theme: red maples and falling leaves.", cost: 30, requires: ["theme-moonlit"], effects: [{ kind: "theme", theme: "autumn" }] },
  { id: "theme-sakura", name: "Sakura pond", desc: "Unlocks the sakura theme: pink blossoms everywhere.", cost: 50, requires: ["theme-autumn"], effects: [{ kind: "theme", theme: "sakura" }] },
  { id: "dragon-fortune", name: "Dragon's fortune", desc: "All production doubled.", cost: 100, requires: ["heavenly-ripples", "rare-waters"], effects: [{ kind: "globalMult", mult: 2 }] },
  { id: "pearl-of-ages", name: "Pearl of ages", desc: "All production tripled.", cost: 500, requires: ["dragon-fortune"], effects: [{ kind: "globalMult", mult: 3 }] },
];

export function celestial(id: string): CelestialDef | undefined {
  return CELESTIAL.find((c) => c.id === id);
}
