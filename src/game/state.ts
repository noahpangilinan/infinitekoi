import { PRODUCER_IDS, type ProducerId } from "./data/producers";

export const SAVE_VERSION = 1;
export const MAX_KOI_KEPT = 60; // individual koi remembered for drawing

export interface KoiRecord {
  variety: string;
  seed: number;
}

export interface Buff {
  kind: "frenzy" | "feeding";
  mult: number;
  timeLeft: number; // seconds
  duration: number;
}

export interface GoldenState {
  nextIn: number; // seconds until the golden koi appears
  timeLeft: number; // seconds it stays once it appears; 0 when absent
  path: number; // seed for the route it swims
}

export interface GameState {
  version: number;
  ripples: number;
  runEarned: number; // this run, since the last ascension
  lifetimeEarned: number; // every run
  producers: Record<ProducerId, number>;
  upgrades: string[];
  achievements: string[];
  discovered: string[]; // koi varieties seen
  koi: KoiRecord[];
  clicks: number;
  clickEarned: number;
  goldenClicks: number;
  scales: number; // Dragon Scales earned in total
  scalesSpent: number;
  celestial: string[];
  ascensions: number;
  buffs: Buff[];
  golden: GoldenState;
  playTime: number; // seconds, all runs
  runTime: number; // seconds, this run
  lastSeen: number; // epoch ms, for offline earnings
  theme: string;
  buyAmount: 1 | 10 | 100 | -1; // -1 = as many as affordable
}

export function emptyProducers(): Record<ProducerId, number> {
  return Object.fromEntries(PRODUCER_IDS.map((id) => [id, 0])) as Record<ProducerId, number>;
}

export function newGame(now = Date.now()): GameState {
  return {
    version: SAVE_VERSION,
    ripples: 0,
    runEarned: 0,
    lifetimeEarned: 0,
    producers: emptyProducers(),
    upgrades: [],
    achievements: [],
    discovered: [],
    koi: [],
    clicks: 0,
    clickEarned: 0,
    goldenClicks: 0,
    scales: 0,
    scalesSpent: 0,
    celestial: [],
    ascensions: 0,
    buffs: [],
    golden: { nextIn: 150, timeLeft: 0, path: 0 },
    playTime: 0,
    runTime: 0,
    lastSeen: now,
    theme: "classic",
    buyAmount: 1,
  };
}

export function has(state: GameState, upgradeId: string): boolean {
  return state.upgrades.includes(upgradeId);
}

export function hasCelestial(state: GameState, id: string): boolean {
  return state.celestial.includes(id);
}

// Saves are JSON in base64, so they can be copied around as one line of text.
export function serialize(state: GameState): string {
  const json = JSON.stringify(state);
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)));
}

// Accepts any earlier save, filling in fields added since with defaults.
export function deserialize(text: string, now = Date.now()): GameState {
  const bytes = Uint8Array.from(atob(text.trim()), (c) => c.charCodeAt(0));
  const raw = JSON.parse(new TextDecoder().decode(bytes)) as Partial<GameState>;
  if (typeof raw !== "object" || raw === null) throw new Error("Not a save");
  const fresh = newGame(now);
  const state: GameState = {
    ...fresh,
    ...raw,
    producers: { ...fresh.producers, ...(raw.producers ?? {}) },
    golden: { ...fresh.golden, ...(raw.golden ?? {}) },
    version: SAVE_VERSION,
  };
  for (const key of ["ripples", "runEarned", "lifetimeEarned", "scales", "scalesSpent"] as const) {
    if (!Number.isFinite(state[key]) || state[key] < 0) state[key] = 0;
  }
  return state;
}
