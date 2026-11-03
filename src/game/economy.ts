import { ACHIEVEMENTS } from "./data/achievements";
import { celestial, type CelestialEffect } from "./data/celestial";
import { PRODUCERS, producer, type ProducerId } from "./data/producers";
import { upgrade, UPGRADES, type Effect, type UpgradeDef } from "./data/upgrades";
import { rollVariety } from "./data/varieties";
import { has, MAX_KOI_KEPT, type GameState } from "./state";

export const COST_GROWTH = 1.15;

// Price of the next `amount` of a producer when `owned` are already owned.
export function costOf(id: ProducerId, owned: number, amount = 1): number {
  const base = producer(id).baseCost * Math.pow(COST_GROWTH, owned);
  return Math.ceil((base * (Math.pow(COST_GROWTH, amount) - 1)) / (COST_GROWTH - 1));
}

// How many can be bought with `budget`.
export function maxAffordable(id: ProducerId, owned: number, budget: number): number {
  const base = producer(id).baseCost * Math.pow(COST_GROWTH, owned);
  const n = Math.floor(Math.log((budget * (COST_GROWTH - 1)) / base + 1) / Math.log(COST_GROWTH));
  let count = Math.max(0, n);
  while (count > 0 && costOf(id, owned, count) > budget) count--; // rounding guard
  return count;
}

function* ownedEffects(state: GameState): Generator<Effect> {
  for (const id of state.upgrades) {
    const u = upgrade(id);
    if (u) yield* u.effects;
  }
}

function* celestialEffects(state: GameState): Generator<CelestialEffect> {
  for (const id of state.celestial) {
    const c = celestial(id);
    if (c) yield* c.effects;
  }
}

// Everything that multiplies all production, except timed boosts.
export function globalMult(state: GameState): number {
  let mult = 1;
  for (const e of ownedEffects(state)) if (e.kind === "globalMult") mult *= e.mult;
  for (const e of celestialEffects(state)) if (e.kind === "globalMult") mult *= e.mult;
  mult *= 1 + 0.01 * state.achievements.length;
  mult *= 1 + 0.02 * state.discovered.length;
  mult *= 1 + 0.01 * state.scales;
  return mult;
}

export function buffMult(state: GameState, kind: "frenzy" | "feeding"): number {
  return state.buffs.filter((b) => b.kind === kind).reduce((m, b) => m * b.mult, 1);
}

// Ripples per second from one of a producer, before global multipliers.
export function producerRate(state: GameState, id: ProducerId): number {
  let rate = producer(id).baseRate;
  let synergy = 0;
  for (const e of ownedEffects(state)) {
    if (e.kind === "producerMult" && e.producer === id) rate *= e.mult;
    else if (e.kind === "synergy" && e.target === id) synergy += e.perUnit * state.producers[e.source];
  }
  return rate * (1 + synergy);
}

// Total ripples per second. `withBuffs` false gives the steady rate used for
// offline earnings and lucky rewards.
export function rps(state: GameState, withBuffs = true): number {
  let total = 0;
  for (const p of PRODUCERS) total += state.producers[p.id] * producerRate(state, p.id);
  total *= globalMult(state);
  return withBuffs ? total * buffMult(state, "frenzy") : total;
}

export function clickValue(state: GameState): number {
  let base = 1;
  let share = 0;
  for (const e of ownedEffects(state)) {
    if (e.kind === "clickMult") base *= e.mult;
    else if (e.kind === "clickRps") share += e.fraction;
  }
  for (const e of celestialEffects(state)) if (e.kind === "clickMult") base *= e.mult;
  return (base + share * rps(state)) * buffMult(state, "feeding");
}

export function goldenFreq(state: GameState): number {
  let mult = 1;
  for (const e of ownedEffects(state)) if (e.kind === "goldenFreq") mult *= e.mult;
  for (const e of celestialEffects(state)) if (e.kind === "goldenFreq") mult *= e.mult;
  return mult;
}

export function goldenPower(state: GameState): number {
  let mult = 1;
  for (const e of ownedEffects(state)) if (e.kind === "goldenPower") mult *= e.mult;
  return mult;
}

export function rareBoost(state: GameState): number {
  let mult = 1;
  for (const e of celestialEffects(state)) if (e.kind === "rareBoost") mult *= e.mult;
  return mult;
}

export function earn(state: GameState, amount: number): void {
  state.ripples += amount;
  state.runEarned += amount;
  state.lifetimeEarned += amount;
}

// Advance time: earn, count down boosts.
export function tick(state: GameState, dt: number): void {
  earn(state, rps(state) * dt);
  state.playTime += dt;
  state.runTime += dt;
  for (const b of state.buffs) b.timeLeft -= dt;
  state.buffs = state.buffs.filter((b) => b.timeLeft > 0);
}

export function click(state: GameState): number {
  const value = clickValue(state);
  earn(state, value);
  state.clicks++;
  state.clickEarned += value;
  return value;
}

export interface BuyResult {
  bought: number;
  newVarieties: string[];
}

// Buy up to `amount` (-1 for as many as affordable). New koi roll varieties.
export function buyProducer(state: GameState, id: ProducerId, amount: number, rng: () => number = Math.random): BuyResult {
  const owned = state.producers[id];
  const count = amount < 0 ? maxAffordable(id, owned, state.ripples) : amount;
  const result: BuyResult = { bought: 0, newVarieties: [] };
  if (count <= 0) return result;
  const cost = costOf(id, owned, count);
  if (cost > state.ripples) return result;
  state.ripples -= cost;
  state.producers[id] += count;
  result.bought = count;
  if (id === "koi") {
    for (let i = 0; i < count; i++) {
      const v = rollVariety(rng, rareBoost(state));
      if (!state.discovered.includes(v.id)) {
        state.discovered.push(v.id);
        result.newVarieties.push(v.id);
      }
      if (state.koi.length < MAX_KOI_KEPT) state.koi.push({ variety: v.id, seed: Math.floor(rng() * 2 ** 31) });
    }
  }
  return result;
}

// Upgrades the player can see in the shop: unlocked, not owned, cheapest first.
export function availableUpgrades(state: GameState): UpgradeDef[] {
  return UPGRADES.filter((u) => !has(state, u.id) && u.unlock(state)).sort((a, b) => a.cost - b.cost);
}

export function buyUpgrade(state: GameState, id: string): boolean {
  const u = upgrade(id);
  if (!u || has(state, id) || !u.unlock(state) || state.ripples < u.cost) return false;
  state.ripples -= u.cost;
  state.upgrades.push(id);
  return true;
}

export function restorationLevel(state: GameState): number {
  let level = 0;
  for (const id of state.upgrades) {
    const stage = upgrade(id)?.restoreStage;
    if (stage && stage > level) level = stage;
  }
  return level;
}

// Newly earned achievements, already recorded in the state.
export function checkAchievements(state: GameState): string[] {
  const fresh: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!state.achievements.includes(a.id) && a.test(state)) {
      state.achievements.push(a.id);
      fresh.push(a.id);
    }
  }
  return fresh;
}
