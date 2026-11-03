import type { GameState } from "../state";
import { PRODUCERS, type ProducerId } from "./producers";

// What an upgrade does. Multipliers stack by multiplying.
export type Effect =
  | { kind: "producerMult"; producer: ProducerId; mult: number }
  | { kind: "globalMult"; mult: number }
  | { kind: "clickMult"; mult: number }
  | { kind: "clickRps"; fraction: number } // clicks also earn this share of ripples/s
  | { kind: "synergy"; source: ProducerId; target: ProducerId; perUnit: number } // target +perUnit per source owned
  | { kind: "goldenFreq"; mult: number }
  | { kind: "goldenPower"; mult: number };

export type UpgradeKind = "restore" | "producer" | "click" | "synergy" | "golden";

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  kind: UpgradeKind;
  cost: number;
  effects: Effect[];
  unlock: (s: GameState) => boolean;
  icon: string; // which pixel icon the shop draws
  restoreStage?: number; // restoration upgrades: 1, 2, 3... in order
}

// Restoration: each stage cleans up the pond and boosts everything a little.
// The renderer reads how many stages are done.
const RESTORATION: [string, string, string, number][] = [
  ["Fish out the trash", "Haul the tire and cans out of the water.", "trash", 20],
  ["Scrape the algae", "Green slime off the stones and the surface.", "algae", 150],
  ["Reset the edging stones", "Lift the fallen stones back into a ring.", "stones", 700],
  ["Pull the weeds", "The bank breathes again.", "weeds", 3000],
  ["Plant moss and ferns", "Soft green along every stone.", "moss", 12000],
  ["Clear the water", "The murk settles. You can see shapes below.", "water", 55000],
  ["Lay a sand bed", "Pale sand and pebbles on the bottom.", "sand", 2.5e5],
  ["Crystal-clear water", "Every scale glints in the light.", "water2", 1.6e6],
  ["Clear skies", "The clouds part over your pond.", "sky", 1.2e7],
  ["Maple garden", "Maples lean over the water.", "garden", 2e8],
  ["Raked gravel", "Calm lines around the pond.", "gravel", 8e9],
  ["Moon-viewing deck", "A place to sit and watch the water.", "deck", 1.5e11],
];

export const RESTORE_STAGES = RESTORATION.length;

// Per-producer doublings at these counts, costing base × factor.
const TIERS: [number, number, string][] = [
  [1, 10, "I"],
  [5, 50, "II"],
  [25, 500, "III"],
  [50, 50000, "IV"],
  [100, 5e6, "V"],
  [150, 5e8, "VI"],
  [200, 5e10, "VII"],
];

const TIER_NAMES: Record<ProducerId, string[]> = {
  tadpole: ["Warm shallows", "Mosquito larvae", "Spring rain", "Tadpole schools", "Clear streams", "Endless spawn", "Ancient eggs"],
  frog: ["Flat stones", "Loud croaks", "Long legs", "Bullfrog chorus", "Golden frogs", "Frog kings", "The great toad"],
  lily: ["Rich mud", "Lotus blooms", "Morning dew", "Giant pads", "Sacred lotus", "Floating gardens", "Moon lilies"],
  koi: ["Koi pellets", "Deep corners", "Clean filters", "Champion bloodlines", "Show koi", "Living jewels", "Dragon blood"],
  reeds: ["Wet banks", "Purple iris", "Whispering reeds", "Cattail thickets", "Iris festival", "Reed flutes", "Wind song"],
  turtle: ["Basking rocks", "Old shells", "Patient eyes", "Turtle island", "Hundred-year turtles", "Shell oracles", "World turtle"],
  lantern: ["Candle stubs", "Paper shades", "Moth dances", "Lantern rows", "Festival of lights", "Eternal flame", "Star lanterns"],
  waterfall: ["Mossy rocks", "Mist", "Rainbows", "Twin falls", "Thundering falls", "Sky river", "The source"],
  bridge: ["Red lacquer", "Stone pillars", "Moon bridge", "Lantern bridge", "Pilgrims' crossing", "Bridge of reflections", "Bridge to heaven"],
  gate: ["Sacred rope", "Paper charms", "Offerings", "Thousand gates", "Shrine maiden", "Kami's favour", "The gate between"],
};

function restoreUpgrades(): UpgradeDef[] {
  return RESTORATION.map(([name, desc, icon, cost], i) => ({
    id: `restore-${icon}`,
    name,
    desc: `${desc} All production +5%.`,
    kind: "restore" as const,
    cost,
    effects: [{ kind: "globalMult" as const, mult: 1.05 }],
    unlock: (s: GameState) => i === 0 || s.upgrades.includes(`restore-${RESTORATION[i - 1][2]}`),
    icon: `restore-${icon}`,
    restoreStage: i + 1,
  }));
}

function producerUpgrades(): UpgradeDef[] {
  const list: UpgradeDef[] = [];
  for (const p of PRODUCERS) {
    TIERS.forEach(([count, factor], i) => {
      list.push({
        id: `${p.id}-${i + 1}`,
        name: TIER_NAMES[p.id][i],
        desc: `${p.plural} are twice as productive.`,
        kind: "producer",
        cost: p.baseCost * factor,
        effects: [{ kind: "producerMult", producer: p.id, mult: 2 }],
        unlock: (s) => s.producers[p.id] >= count,
        icon: p.id,
      });
    });
  }
  return list;
}

function clickUpgrades(): UpgradeDef[] {
  const doubles: [string, number, number][] = [
    ["Bamboo ladle", 100, 1],
    ["Cupped hands", 500, 1],
    ["Pebble skipping", 10000, 10],
  ];
  const shares: [string, number, number][] = [
    ["Feeding time", 5e4, 50],
    ["Hand-fed koi", 5e6, 150],
    ["Splash of fortune", 5e8, 300],
    ["Dragon's paw", 5e10, 600],
    ["Infinite ripple", 5e12, 1000],
  ];
  return [
    ...doubles.map(([name, cost, clicks], i) => ({
      id: `click-${i + 1}`,
      name,
      desc: "Clicking the water earns twice as much.",
      kind: "click" as const,
      cost,
      effects: [{ kind: "clickMult" as const, mult: 2 }],
      unlock: (s: GameState) => s.clicks >= clicks,
      icon: "click",
    })),
    ...shares.map(([name, cost, clicks], i) => ({
      id: `click-rps-${i + 1}`,
      name,
      desc: "Each click also earns 1% of your ripples per second.",
      kind: "click" as const,
      cost,
      effects: [{ kind: "clickRps" as const, fraction: 0.01 }],
      unlock: (s: GameState) => s.clicks >= clicks && s.runEarned >= cost / 4,
      icon: "click",
    })),
  ];
}

function synergy(id: string, name: string, desc: string, source: ProducerId, target: ProducerId, need: number, cost: number): UpgradeDef {
  return {
    id,
    name,
    desc,
    kind: "synergy",
    cost,
    effects: [{ kind: "synergy", source, target, perUnit: 0.01 }],
    unlock: (s) => s.producers[source] >= need && s.producers[target] >= need,
    icon: target,
  };
}

const SYNERGIES: UpgradeDef[] = [
  synergy("syn-frog-lily", "Frogs on lily pads", "Lily pads +1% for every frog.", "frog", "lily", 15, 3e5),
  synergy("syn-tadpole-koi", "Tadpole snacks", "Koi +1% for every tadpole.", "tadpole", "koi", 25, 4e6),
  synergy("syn-koi-reeds", "Koi among the reeds", "Reeds +1% for every koi.", "koi", "reeds", 15, 4e7),
  synergy("syn-lily-turtle", "Turtles under the pads", "Turtles +1% for every lily pad.", "lily", "turtle", 15, 5e8),
  synergy("syn-turtle-lantern", "Turtles guard the lanterns", "Lanterns +1% for every turtle.", "turtle", "lantern", 10, 8e9),
  synergy("syn-lantern-bridge", "Lantern-lit crossing", "Bridges +1% for every lantern.", "lantern", "bridge", 10, 2e11),
];

const GOLDEN: UpgradeDef[] = [
  { id: "golden-1", name: "Glint in the water", desc: "The golden koi visits 50% more often and stays a little longer.", kind: "golden", cost: 7.7e5, effects: [{ kind: "goldenFreq", mult: 1.5 }], unlock: (s) => s.goldenClicks >= 3, icon: "golden" },
  { id: "golden-2", name: "Lucky scales", desc: "Golden koi rewards are twice as big.", kind: "golden", cost: 7.7e7, effects: [{ kind: "goldenPower", mult: 2 }], unlock: (s) => s.goldenClicks >= 7, icon: "golden" },
  { id: "golden-3", name: "Old friend", desc: "The golden koi visits even more often.", kind: "golden", cost: 7.7e9, effects: [{ kind: "goldenFreq", mult: 1.5 }], unlock: (s) => s.goldenClicks >= 27, icon: "golden" },
];

export const UPGRADES: UpgradeDef[] = [...restoreUpgrades(), ...clickUpgrades(), ...producerUpgrades(), ...SYNERGIES, ...GOLDEN];

const BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

export function upgrade(id: string): UpgradeDef | undefined {
  return BY_ID.get(id);
}
