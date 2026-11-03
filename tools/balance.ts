// Plays the game headlessly with a simple greedy strategy and prints how long
// each milestone takes, to check pacing. Run: npm run balance [-- clicksPerSecond]
import { PRODUCERS } from "../src/game/data/producers";
import { upgrade } from "../src/game/data/upgrades";
import {
  availableUpgrades,
  buyProducer,
  buyUpgrade,
  checkAchievements,
  click,
  costOf,
  restorationLevel,
  rps,
  tick,
} from "../src/game/economy";
import { catchGolden, goldenVisible, tickGolden } from "../src/game/events";
import { formatNumber, formatTime } from "../src/game/format";
import { canAscend } from "../src/game/prestige";
import { newGame, type GameState } from "../src/game/state";

const clicksPerSecond = Number(process.argv[2] ?? 4);
const hours = Number(process.argv[3] ?? 6);

// Ripples per second gained per ripple spent, for one purchase option.
function value(gain: number, cost: number): number {
  return gain / Math.max(cost, 1);
}

function bestPurchase(state: GameState): (() => void) | null {
  const base = rps(state, false) + clicksPerSecond * 1; // treat clicking as income too
  let best: { score: number; cost: number; act: () => void } | null = null;
  const consider = (score: number, cost: number, act: () => void) => {
    if (!best || score > best.score) best = { score, cost, act };
  };
  for (const p of PRODUCERS) {
    const cost = costOf(p.id, state.producers[p.id]);
    const trial = structuredClone(state);
    trial.producers[p.id]++;
    consider(value(rps(trial, false) - rps(state, false), cost), cost, () => buyProducer(state, p.id, 1));
  }
  for (const u of availableUpgrades(state)) {
    const trial = structuredClone(state);
    trial.upgrades.push(u.id);
    let gain = rps(trial, false) - rps(state, false);
    if (u.kind === "click" || u.kind === "golden") gain = Math.max(gain, base * 0.05);
    consider(value(gain, u.cost), u.cost, () => buyUpgrade(state, u.id));
  }
  if (!best) return null;
  const b = best as { score: number; cost: number; act: () => void };
  return state.ripples >= b.cost ? b.act : null; // save up for the best, don't settle
}

const state = newGame();
const milestones = new Map<string, number>();
const mark = (name: string, t: number) => {
  if (!milestones.has(name)) milestones.set(name, t);
};

let lastRestore = 0;
for (let t = 0; t < hours * 3600; t++) {
  for (let c = 0; c < clicksPerSecond; c++) click(state);
  tick(state, 1);
  tickGolden(state, 1);
  if (goldenVisible(state)) catchGolden(state);
  checkAchievements(state);
  for (let guard = 0; guard < 50; guard++) {
    const act = bestPurchase(state);
    if (!act) break;
    act();
  }

  const level = restorationLevel(state);
  if (level > lastRestore) {
    const id = state.upgrades.find((u) => upgrade(u)?.restoreStage === level)!;
    mark(`restoration ${level}: ${upgrade(id)!.name}`, t);
    lastRestore = level;
  }
  for (const p of PRODUCERS) if (state.producers[p.id] > 0) mark(`first ${p.name}`, t);
  for (const n of [1e6, 1e9]) if (state.runEarned >= n) mark(`earned ${formatNumber(n)}`, t);
  if (canAscend(state)) {
    mark("Dragon Gate ready (1 scale)", t);
    break;
  }
}

const rows = [...milestones.entries()].sort((a, b) => a[1] - b[1]);
console.log(`Greedy player, ${clicksPerSecond} clicks/s, catches every golden koi\n`);
for (const [name, t] of rows) console.log(`${formatTime(t).padStart(8)}  ${name}`);
console.log(`\nfinal: ${formatNumber(rps(state))}/s, ${state.achievements.length} achievements, ` +
  `${state.discovered.length} varieties, producers ${PRODUCERS.map((p) => state.producers[p.id]).join("/")}`);
