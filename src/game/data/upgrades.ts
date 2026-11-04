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
  | { kind: "goldenPower"; mult: number }
  | { kind: "harmony"; perAchievement: number }; // all production +x per achievement

export type UpgradeKind = "restore" | "producer" | "click" | "synergy" | "golden" | "harmony";

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
  ["Mend the bamboo fence", "Fresh bamboo, tied with black cord.", "fence", 1.3e5],
  ["Lay a sand bed", "Pale sand and pebbles on the bottom.", "sand", 2.5e5],
  ["Azaleas and hydrangeas", "Flower beds bloom around the bank.", "flowers", 8e5],
  ["Crystal-clear water", "Every scale glints in the light.", "water2", 2.5e6],
  ["Lay stepping stones", "A winding path of flat stones to the water.", "path", 8e6],
  ["Clear skies", "The clouds part over your pond.", "sky", 3e7],
  ["Plant a green grove", "Pines and cedars fill in behind the fence.", "grove", 1.2e8],
  ["Stone water basin", "A bamboo spout drips into a mossy basin.", "basin", 5e8],
  ["Japanese maples", "Red maples lean over the water.", "garden", 2e9],
  ["Nectar flowers", "Hummingbirds and butterflies come to visit.", "nectar", 8e9],
  ["Shape a garden pine", "An old black pine, pruned into clouds.", "pine", 4e10],
  ["Raked gravel", "Calm lines around the pond.", "gravel", 2e11],
  ["Bamboo grove", "Tall bamboo sways and creaks in the corners.", "bamboo", 1e12],
  ["Moon-viewing deck", "A deck with cushions and a moon offering. At night the moon lies on the water.", "deck", 5e12],
  ["Stone pagoda", "A five-tiered stone pagoda keeps watch.", "pagoda", 2.5e13],
  ["Moon festival", "Paper lanterns strung over the deck, glowing all night.", "festival", 1.2e14],
];

export const RESTORE_STAGES = RESTORATION.length;

// Per-producer doublings at these counts, costing base × factor. The number
// is the upgrade's id suffix; later tiers were added with new numbers so
// existing saves keep theirs.
const TIERS: [number, number, number][] = [
  [1, 1, 10],
  [2, 5, 50],
  [8, 10, 1000],
  [3, 25, 500],
  [4, 50, 50000],
  [9, 75, 2e6],
  [5, 100, 5e6],
  [6, 150, 5e8],
  [7, 200, 5e10],
  [10, 250, 5e13],
  [11, 300, 5e16],
];

const TIER_NAMES: Record<ProducerId, string[]> = {
  tadpole: ["Warm shallows", "Mosquito larvae", "Spring rain", "Tadpole schools", "Clear streams", "Endless spawn", "Ancient eggs", "Puddle nursery", "Froglets", "Primordial soup", "Tadpole tide"],
  frog: ["Flat stones", "Loud croaks", "Long legs", "Bullfrog chorus", "Golden frogs", "Frog kings", "The great toad", "Lily hoppers", "Tree frogs", "Thunder croak", "Frog emperor"],
  lily: ["Rich mud", "Lotus blooms", "Morning dew", "Giant pads", "Sacred lotus", "Floating gardens", "Moon lilies", "Pad clusters", "Water hyacinth", "Lotus throne", "Thousand-petal lotus"],
  koi: ["Koi pellets", "Deep corners", "Clean filters", "Champion bloodlines", "Show koi", "Living jewels", "Dragon blood", "Hand-picked fry", "Grand champions", "Koi of legend", "Ten-thousand-year koi"],
  reeds: ["Wet banks", "Purple iris", "Whispering reeds", "Cattail thickets", "Iris festival", "Reed flutes", "Wind song", "Sedge banks", "Rush mats", "Singing marsh", "Reed sea"],
  turtle: ["Basking rocks", "Old shells", "Patient eyes", "Turtle island", "Hundred-year turtles", "Shell oracles", "World turtle", "Soft shells", "Shell mosaics", "Turtle tower", "Cosmic shell"],
  lantern: ["Candle stubs", "Paper shades", "Moth dances", "Lantern rows", "Festival of lights", "Eternal flame", "Star lanterns", "Oil lamps", "Lantern walk", "Ghost lights", "Sun lantern"],
  waterfall: ["Mossy rocks", "Mist", "Rainbows", "Twin falls", "Thundering falls", "Sky river", "The source", "Plunge pools", "Rainbow mist", "Waterfall ladder", "Falling sky"],
  bridge: ["Red lacquer", "Stone pillars", "Moon bridge", "Lantern bridge", "Pilgrims' crossing", "Bridge of reflections", "Bridge to heaven", "Zigzag planks", "Moon gate", "Floating bridge", "Rainbow bridge"],
  gate: ["Sacred rope", "Paper charms", "Offerings", "Thousand gates", "Shrine maiden", "Kami's favour", "The gate between", "Fox statues", "Vermilion path", "Mountain shrine", "Gate of ages"],
  spirit: ["Faint wisps", "Blue flames", "Will-o'-wisps", "Fox fire", "Ancestor lights", "Spirit choir", "Lights of Obon", "Firefly kin", "Lantern ghosts", "Star souls", "Glow eternal"],
  rabbit: ["Mochi mallets", "Moon dust", "Long ears", "Rabbit warren", "Harvest moon", "Jade rabbit", "Rabbit in the moon", "Clover patches", "Mochi festival", "Lunar court", "Moon's own rabbit"],
  kappa: ["Fresh cucumbers", "Full dishes", "Sumo practice", "Kappa clans", "River lords", "Ancient pacts", "Kappa king", "Webbed hands", "Polite bows", "Water magic", "Elder of the rivers"],
  crane: ["Red crowns", "Long legs", "Courtship dance", "Paper cranes", "Thousand cranes", "Crane wives", "Crane of ages", "Shallow feeding", "Winter flocks", "Cloud wings", "Crane immortal"],
  fox: ["Rice offerings", "Red bibs", "Fox-fire", "Fox weddings", "Nine tails", "Inari's favour", "Celestial fox", "Shrine bells", "Sun showers", "Thousand-year fox", "Fox of heaven"],
  rainbow: ["Sun showers", "Double arcs", "Moonbows", "Spectrum", "Rainbow bridge", "Endless arc", "Colour of heaven", "Misty mornings", "Pot of koi", "Prism waters", "The first rainbow"],
  island: ["Floating stones", "Hanging gardens", "Sky shrine", "Island chains", "Cloud harbour", "Drifting realm", "Island of the immortals", "Sky moss", "Falling springs", "Sky village", "Heaven's shore"],
  dragon: ["Pearl of wisdom", "Rain calling", "Jade scales", "Dragon's breath", "Dragon king", "Storm rider", "Ancestor dragon", "Whiskers", "Thunder coils", "Dragon palace", "Dragon of the source"],
  river: ["Stardust", "Weaver star", "Cowherd star", "Tanabata", "Magpie bridge", "Star koi", "River of heaven", "Wishing papers", "Meteor showers", "Galaxy spiral", "The endless river"],
  skykoi: ["Cloud fins", "Wind scales", "High currents", "Rainbow trails", "Thunder koi", "Comet tails", "Milky Way koi", "Updrafts", "Cloud schools", "Sun-chasers", "Koi of heaven"],
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
    for (const [n, count, factor] of TIERS) {
      list.push({
        id: `${p.id}-${n}`,
        name: TIER_NAMES[p.id][n - 1],
        desc: `${p.plural} are twice as productive.`,
        kind: "producer",
        cost: p.baseCost * factor,
        effects: [{ kind: "producerMult", producer: p.id, mult: 2 }],
        unlock: (s) => s.producers[p.id] >= count,
        icon: p.id,
      });
    }
  }
  return list;
}

function clickUpgrades(): UpgradeDef[] {
  const doubles: [string, number, number][] = [
    ["Bamboo ladle", 100, 1],
    ["Cupped hands", 500, 1],
    ["Pebble skipping", 10000, 10],
    ["Willow switch", 1e7, 100],
    ["Koi whisperer", 1e10, 300],
  ];
  const shares: [string, number, number][] = [
    ["Feeding time", 5e4, 50],
    ["Hand-fed koi", 5e6, 150],
    ["Splash of fortune", 5e8, 300],
    ["Dragon's paw", 5e10, 600],
    ["Infinite ripple", 5e12, 1000],
    ["Moonlit splash", 5e14, 1500],
    ["Ripple without end", 5e16, 2000],
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
  synergy("syn-lily-tadpole", "Tadpoles under the pads", "Tadpoles +1% for every lily pad.", "lily", "tadpole", 25, 5e5),
  synergy("syn-tadpole-frog", "Growing up", "Frogs +1% for every tadpole.", "tadpole", "frog", 50, 2e6),
  synergy("syn-reeds-frog", "Frogs in the reeds", "Frogs +1% for every reed.", "reeds", "frog", 15, 2e7),
  synergy("syn-frog-turtle", "Old pond neighbours", "Turtles +1% for every frog.", "frog", "turtle", 25, 2e9),
  synergy("syn-koi-waterfall", "Koi climb the falls", "Waterfalls +1% for every koi.", "koi", "waterfall", 25, 3e10),
  synergy("syn-reeds-lantern", "Lanterns among the reeds", "Lanterns +1% for every reed.", "reeds", "lantern", 25, 5e10),
  synergy("syn-turtle-koi", "Slow and steady", "Koi +1% for every turtle.", "turtle", "koi", 25, 1e11),
  synergy("syn-waterfall-bridge", "Spray on the bridge", "Bridges +1% for every waterfall.", "waterfall", "bridge", 15, 5e11),
  synergy("syn-bridge-gate", "Pilgrims' path", "Shrine gates +1% for every bridge.", "bridge", "gate", 15, 8e12),
  synergy("syn-lantern-gate", "Shrine lanterns", "Shrine gates +1% for every lantern.", "lantern", "gate", 25, 2e13),
  synergy("syn-gate-spirit", "Spirits of the shrine", "Spirit lights +1% for every shrine gate.", "gate", "spirit", 10, 1e14),
  synergy("syn-lantern-spirit", "Lanterns call the spirits", "Spirit lights +1% for every lantern.", "lantern", "spirit", 25, 3e14),
  synergy("syn-koi-skykoi", "Koi dream of flying", "Sky koi +1% for every koi.", "koi", "skykoi", 50, 1e15),
  synergy("syn-spirit-skykoi", "Spirit currents", "Sky koi +1% for every spirit light.", "spirit", "skykoi", 10, 3e15),
  synergy("syn-lantern-rabbit", "Lanterns light the way", "Moon rabbits +1% for every lantern.", "lantern", "rabbit", 50, 1e16),
  synergy("syn-koi-kappa", "Kappa and koi", "Kappa +1% for every koi.", "koi", "kappa", 100, 1e17),
  synergy("syn-reeds-crane", "Cranes in the reeds", "Cranes +1% for every reed.", "reeds", "crane", 100, 1.3e18),
  synergy("syn-gate-fox", "Messengers of the shrine", "Shrine foxes +1% for every shrine gate.", "gate", "fox", 50, 1.5e19),
  synergy("syn-waterfall-rainbow", "Rainbow in the spray", "Rainbows +1% for every waterfall.", "waterfall", "rainbow", 50, 3.5e21),
  synergy("syn-skykoi-island", "Koi circle the isle", "Floating isles +1% for every sky koi.", "skykoi", "island", 50, 6e23),
  synergy("syn-koi-dragon", "The koi's ascent", "Pond dragons +1% for every koi.", "koi", "dragon", 150, 1e26),
  synergy("syn-spirit-river", "Souls in the river", "Heavenly rivers +1% for every spirit light.", "spirit", "river", 50, 2.5e28),
];

// Harmony: production grows with every achievement earned.
const HARMONY: [string, string, number, number, number][] = [
  ["harmony-1", "Pond harmony", 1e6, 10, 0.0025],
  ["harmony-2", "Garden harmony", 1e8, 20, 0.004],
  ["harmony-3", "Still water", 1e10, 30, 0.005],
  ["harmony-4", "Moon harmony", 1e12, 40, 0.0075],
  ["harmony-5", "Heaven and earth", 1e14, 50, 0.01],
  ["harmony-6", "One with the pond", 1e16, 60, 0.015],
];

const HARMONIES: UpgradeDef[] = HARMONY.map(([id, name, cost, need, per]) => ({
  id,
  name,
  desc: `All production +${+(per * 100).toFixed(2)}% for every achievement earned.`,
  kind: "harmony",
  cost,
  effects: [{ kind: "harmony", perAchievement: per }],
  unlock: (s) => s.achievements.length >= need,
  icon: "harmony",
}));

const GOLDEN: UpgradeDef[] = [
  { id: "golden-1", name: "Glint in the water", desc: "The golden koi visits 50% more often and stays a little longer.", kind: "golden", cost: 7.7e5, effects: [{ kind: "goldenFreq", mult: 1.5 }], unlock: (s) => s.goldenClicks >= 3, icon: "golden" },
  { id: "golden-2", name: "Lucky scales", desc: "Golden koi rewards are twice as big.", kind: "golden", cost: 7.7e7, effects: [{ kind: "goldenPower", mult: 2 }], unlock: (s) => s.goldenClicks >= 7, icon: "golden" },
  { id: "golden-3", name: "Old friend", desc: "The golden koi visits even more often.", kind: "golden", cost: 7.7e9, effects: [{ kind: "goldenFreq", mult: 1.5 }], unlock: (s) => s.goldenClicks >= 27, icon: "golden" },
  { id: "golden-4", name: "Golden wake", desc: "Golden koi rewards are twice as big.", kind: "golden", cost: 7.7e11, effects: [{ kind: "goldenPower", mult: 2 }], unlock: (s) => s.goldenClicks >= 50, icon: "golden" },
  { id: "golden-5", name: "Sun-kissed scales", desc: "The golden koi visits 25% more often.", kind: "golden", cost: 7.7e13, effects: [{ kind: "goldenFreq", mult: 1.25 }], unlock: (s) => s.goldenClicks >= 77, icon: "golden" },
  { id: "golden-6", name: "Koi of fortune", desc: "Golden koi rewards are twice as big.", kind: "golden", cost: 7.7e15, effects: [{ kind: "goldenPower", mult: 2 }], unlock: (s) => s.goldenClicks >= 127, icon: "golden" },
];

export const UPGRADES: UpgradeDef[] = [...restoreUpgrades(), ...clickUpgrades(), ...producerUpgrades(), ...SYNERGIES, ...GOLDEN, ...HARMONIES];

const BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

export function upgrade(id: string): UpgradeDef | undefined {
  return BY_ID.get(id);
}
