import { CELESTIAL, celestial } from "./data/celestial";
import { UPGRADES } from "./data/upgrades";
import { emptyProducers, hasCelestial, type GameState } from "./state";

// The Dragon Gate. A koi that climbs the waterfall becomes a dragon: the pond
// starts over, and you keep Dragon Scales for every ascension's worth of
// ripples earned across all runs.

export const GATE_THRESHOLD = 5e12;

export function scalesFor(lifetimeEarned: number): number {
  return Math.floor(Math.cbrt(lifetimeEarned / GATE_THRESHOLD));
}

export function pendingScales(state: GameState): number {
  return Math.max(0, scalesFor(state.lifetimeEarned) - state.scales);
}

export function canAscend(state: GameState): boolean {
  return pendingScales(state) >= 1;
}

// Lifetime ripples needed for the next scale.
export function nextScaleAt(state: GameState): number {
  return Math.pow(scalesFor(state.lifetimeEarned) + 1, 3) * GATE_THRESHOLD;
}

export function ascend(state: GameState): number {
  const gained = pendingScales(state);
  if (gained < 1) return 0;
  state.scales += gained;
  state.ascensions++;
  state.ripples = 0;
  state.runEarned = 0;
  state.runTime = 0;
  state.producers = emptyProducers();
  state.upgrades = [];
  state.koi = [];
  state.buffs = [];
  state.golden.timeLeft = 0;
  for (const c of state.celestial) {
    for (const e of celestial(c)?.effects ?? []) {
      if (e.kind === "startRestored") {
        const stages = UPGRADES.filter((u) => u.restoreStage && u.restoreStage <= e.stages);
        for (const u of stages) if (!state.upgrades.includes(u.id)) state.upgrades.push(u.id);
      }
    }
  }
  return gained;
}

export function scalesAvailable(state: GameState): number {
  return state.scales - state.scalesSpent;
}

export function canBuyCelestial(state: GameState, id: string): boolean {
  const c = celestial(id);
  if (!c || hasCelestial(state, id)) return false;
  return c.requires.every((r) => hasCelestial(state, r)) && scalesAvailable(state) >= c.cost;
}

export function buyCelestial(state: GameState, id: string): boolean {
  if (!canBuyCelestial(state, id)) return false;
  const c = celestial(id)!;
  state.scalesSpent += c.cost;
  state.celestial.push(id);
  return true;
}

export function unlockedThemes(state: GameState): string[] {
  const themes = ["classic"];
  for (const c of CELESTIAL) {
    if (!hasCelestial(state, c.id)) continue;
    for (const e of c.effects) if (e.kind === "theme") themes.push(e.theme);
  }
  return themes;
}
