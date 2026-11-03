import type { GameState } from "../state";
import { PRODUCERS } from "./producers";
import { RESTORE_STAGES } from "./upgrades";
import { VARIETIES } from "./varieties";

// Milestones. Each one earned adds 1% to all production.

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  test: (s: GameState) => boolean;
}

const EARNED: [number, string][] = [
  [100, "First ripples"],
  [1e3, "A little splash"],
  [1e4, "Making waves"],
  [1e5, "Rippling along"],
  [1e6, "Millionaire pond"],
  [1e8, "Deep waters"],
  [1e10, "Tidal"],
  [1e12, "Ready for the gate"],
  [1e14, "Ocean in a pond"],
  [1e16, "Infinite ripples"],
];

export const ACHIEVEMENTS: AchievementDef[] = [
  ...EARNED.map(([amount, name]) => ({
    id: `earn-${amount}`,
    name,
    desc: `Earn ${amount.toLocaleString("en-US")} ripples in one run.`,
    test: (s: GameState) => s.runEarned >= amount,
  })),
  ...PRODUCERS.flatMap((p) => [
    { id: `own-${p.id}-1`, name: `First ${p.name.toLowerCase()}`, desc: `Have 1 ${p.name.toLowerCase()}.`, test: (s: GameState) => s.producers[p.id] >= 1 },
    { id: `own-${p.id}-50`, name: `${p.plural} galore`, desc: `Have 50 ${p.plural.toLowerCase()}.`, test: (s: GameState) => s.producers[p.id] >= 50 },
  ]),
  { id: "click-100", name: "Curious finger", desc: "Click the water 100 times.", test: (s) => s.clicks >= 100 },
  { id: "click-1000", name: "Restless hands", desc: "Click the water 1,000 times.", test: (s) => s.clicks >= 1000 },
  { id: "click-10000", name: "Pond whisperer", desc: "Click the water 10,000 times.", test: (s) => s.clicks >= 10000 },
  { id: "golden-1", name: "A glint of gold", desc: "Catch the golden koi.", test: (s) => s.goldenClicks >= 1 },
  { id: "golden-7", name: "Lucky seven", desc: "Catch the golden koi 7 times.", test: (s) => s.goldenClicks >= 7 },
  { id: "golden-77", name: "Old friends", desc: "Catch the golden koi 77 times.", test: (s) => s.goldenClicks >= 77 },
  { id: "variety-3", name: "Budding collector", desc: "Discover 3 koi varieties.", test: (s) => s.discovered.length >= 3 },
  { id: "variety-6", name: "Koi connoisseur", desc: "Discover 6 koi varieties.", test: (s) => s.discovered.length >= 6 },
  { id: "variety-all", name: "Complete collection", desc: "Discover every koi variety.", test: (s) => s.discovered.length >= VARIETIES.length },
  { id: "restored", name: "Good as new", desc: "Finish every restoration.", test: (s) => s.upgrades.filter((u) => u.startsWith("restore-")).length >= RESTORE_STAGES },
  { id: "ascend-1", name: "Through the Dragon Gate", desc: "Ascend for the first time.", test: (s) => s.ascensions >= 1 },
  { id: "ascend-10", name: "Dragon lord", desc: "Ascend 10 times.", test: (s) => s.ascensions >= 10 },
];
