import { earn, goldenFreq, goldenPower, rps } from "./economy";
import type { GameState } from "./state";

// The golden koi: every few minutes it swims across the pond for a short
// while. Catch it for a reward.

export const GOLDEN_MIN = 180; // seconds between visits, before upgrades
export const GOLDEN_MAX = 480;
export const GOLDEN_STAY = 13; // seconds on screen, before upgrades

export type GoldenOutcome =
  | { kind: "lucky"; amount: number }
  | { kind: "frenzy"; mult: number; seconds: number }
  | { kind: "feeding"; mult: number; seconds: number };

// Returns true on the step the golden koi appears.
export function tickGolden(state: GameState, dt: number, rng: () => number = Math.random): boolean {
  const g = state.golden;
  if (g.timeLeft > 0) {
    g.timeLeft -= dt;
    if (g.timeLeft <= 0) scheduleGolden(state, rng);
    return false;
  }
  g.nextIn -= dt;
  if (g.nextIn <= 0) {
    g.timeLeft = GOLDEN_STAY * Math.sqrt(goldenFreq(state));
    g.path = Math.floor(rng() * 2 ** 31);
    return true;
  }
  return false;
}

function scheduleGolden(state: GameState, rng: () => number): void {
  state.golden.timeLeft = 0;
  state.golden.nextIn = (GOLDEN_MIN + rng() * (GOLDEN_MAX - GOLDEN_MIN)) / goldenFreq(state);
}

export function goldenVisible(state: GameState): boolean {
  return state.golden.timeLeft > 0;
}

export function catchGolden(state: GameState, rng: () => number = Math.random): GoldenOutcome | null {
  if (!goldenVisible(state)) return null;
  state.goldenClicks++;
  scheduleGolden(state, rng);
  const power = goldenPower(state);
  const roll = rng();
  if (roll < 0.5) {
    // A lump: 15% of the bank or 15 minutes of production, whichever is less.
    const amount = (Math.min(state.ripples * 0.15, rps(state, false) * 900) + 13) * power;
    earn(state, amount);
    return { kind: "lucky", amount };
  }
  if (roll < 0.9) {
    const outcome = { kind: "frenzy" as const, mult: 7 * power, seconds: 77 };
    state.buffs.push({ kind: "frenzy", mult: outcome.mult, timeLeft: outcome.seconds, duration: outcome.seconds });
    return outcome;
  }
  const outcome = { kind: "feeding" as const, mult: 777 * power, seconds: 13 };
  state.buffs.push({ kind: "feeding", mult: outcome.mult, timeLeft: outcome.seconds, duration: outcome.seconds });
  return outcome;
}
