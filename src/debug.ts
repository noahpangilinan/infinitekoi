import { PRODUCERS } from "./game/data/producers";
import { RESTORE_STAGES, UPGRADES } from "./game/data/upgrades";
import { VARIETIES } from "./game/data/varieties";
import { newGame, type GameState } from "./game/state";
import { mulberry32 } from "./render/rng";

// Ready-made saves for checking the look at different stages:
// ?debug=shabby|early|restored|mid|late  (&t=0..1 for the time of day)

function restoredTo(state: GameState, stages: number): void {
  for (const u of UPGRADES) if (u.restoreStage && u.restoreStage <= stages) state.upgrades.push(u.id);
}

function withProducers(state: GameState, counts: number[]): void {
  PRODUCERS.forEach((p, i) => (state.producers[p.id] = counts[i] ?? 0));
  const rng = mulberry32(3);
  for (let i = 0; i < Math.min(state.producers.koi, 60); i++) {
    const v = VARIETIES[i % VARIETIES.length];
    state.koi.push({ variety: v.id, seed: Math.floor(rng() * 2 ** 31) });
    if (!state.discovered.includes(v.id)) state.discovered.push(v.id);
  }
}

export function debugState(name: string): GameState | null {
  const s = newGame();
  switch (name) {
    case "shabby":
      withProducers(s, [3, 1]);
      break;
    case "early":
      restoredTo(s, 4);
      withProducers(s, [12, 6, 4, 2]);
      break;
    case "restored":
      restoredTo(s, RESTORE_STAGES);
      break;
    case "mid":
      restoredTo(s, 12);
      withProducers(s, [40, 25, 20, 12, 8, 2, 1]);
      break;
    case "late":
      restoredTo(s, RESTORE_STAGES);
      withProducers(s, [100, 80, 60, 40, 30, 4, 4, 1, 1, 1, 6, 4]);
      break;
    case "myth":
      restoredTo(s, RESTORE_STAGES);
      withProducers(s, [100, 80, 60, 40, 30, 4, 4, 1, 1, 1, 6, 4, 6, 3, 3, 2, 1, 1, 1, 1]);
      break;
    default:
      return null;
  }
  s.ripples = 1e6;
  return s;
}
