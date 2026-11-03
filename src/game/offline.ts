import { celestial } from "./data/celestial";
import { earn, rps } from "./economy";
import type { GameState } from "./state";

// While you're away the pond keeps going at half speed, for up to 12 hours.

export const OFFLINE_RATE = 0.5;
export const OFFLINE_CAP_HOURS = 12;

export interface OfflineResult {
  seconds: number; // time away
  counted: number; // seconds that earned, after the cap
  earned: number;
}

export function offlineTerms(state: GameState): { rate: number; capSeconds: number } {
  let rate = OFFLINE_RATE;
  let capHours = OFFLINE_CAP_HOURS;
  for (const id of state.celestial) {
    for (const e of celestial(id)?.effects ?? []) {
      if (e.kind === "offlineRate") rate *= e.mult;
      else if (e.kind === "offlineCap") capHours = Math.max(capHours, e.hours);
    }
  }
  return { rate: Math.min(1, rate), capSeconds: capHours * 3600 };
}

export function applyOffline(state: GameState, now = Date.now()): OfflineResult {
  const seconds = Math.max(0, (now - state.lastSeen) / 1000);
  const { rate, capSeconds } = offlineTerms(state);
  const counted = Math.min(seconds, capSeconds);
  const earned = rps(state, false) * counted * rate;
  earn(state, earned);
  state.lastSeen = now;
  state.buffs = state.buffs.filter((b) => (b.timeLeft -= seconds) > 0);
  return { seconds, counted, earned };
}
