// Things that earn ripples on their own. Each also adds something visible to
// the pond, up to `visualCap` of them so the scene stays readable.

export type ProducerId =
  | "tadpole"
  | "frog"
  | "lily"
  | "koi"
  | "reeds"
  | "turtle"
  | "lantern"
  | "waterfall"
  | "bridge"
  | "gate"
  | "spirit"
  | "skykoi"
  | "rabbit"
  | "kappa"
  | "crane"
  | "fox"
  | "rainbow"
  | "island"
  | "dragon"
  | "river";

export interface ProducerDef {
  id: ProducerId;
  name: string;
  plural: string;
  desc: string;
  baseCost: number;
  baseRate: number; // ripples per second, each
  visualCap: number;
}

export const PRODUCERS: ProducerDef[] = [
  { id: "tadpole", name: "Tadpole", plural: "Tadpoles", desc: "Wriggles in the shallows. Every little splash counts.", baseCost: 15, baseRate: 0.1, visualCap: 24 },
  { id: "frog", name: "Frog", plural: "Frogs", desc: "Sits on a stone and plops in now and then.", baseCost: 100, baseRate: 1, visualCap: 10 },
  { id: "lily", name: "Lily pad", plural: "Lily pads", desc: "Rocks gently, sending out slow rings.", baseCost: 1100, baseRate: 8, visualCap: 22 },
  { id: "koi", name: "Koi", plural: "Koi", desc: "A living jewel. Each one is a different variety.", baseCost: 12000, baseRate: 47, visualCap: 28 },
  { id: "reeds", name: "Reeds & iris", plural: "Reeds & iris", desc: "Sways at the water's edge, rustling the surface.", baseCost: 130000, baseRate: 260, visualCap: 14 },
  { id: "turtle", name: "Turtle", plural: "Turtles", desc: "Basks on a rock, then slides in with a splash.", baseCost: 1.4e6, baseRate: 1400, visualCap: 4 },
  { id: "lantern", name: "Stone lantern", plural: "Stone lanterns", desc: "Its glow draws moths, and moths draw fish.", baseCost: 2e7, baseRate: 7800, visualCap: 4 },
  { id: "waterfall", name: "Waterfall", plural: "Waterfalls", desc: "Falling water, endless ripples.", baseCost: 3.3e8, baseRate: 44000, visualCap: 1 },
  { id: "bridge", name: "Arched bridge", plural: "Arched bridges", desc: "Footsteps above, reflections below.", baseCost: 5.1e9, baseRate: 260000, visualCap: 1 },
  { id: "gate", name: "Shrine gate", plural: "Shrine gates", desc: "Blessed waters ripple on their own.", baseCost: 7.5e10, baseRate: 1.6e6, visualCap: 1 },
  { id: "spirit", name: "Spirit light", plural: "Spirit lights", desc: "A soft wisp that drifts over the water, humming.", baseCost: 1e12, baseRate: 1e7, visualCap: 10 },
  { id: "skykoi", name: "Sky koi", plural: "Sky koi", desc: "A koi that has learned to swim through the clouds.", baseCost: 1.4e13, baseRate: 6.5e7, visualCap: 6 },
  { id: "rabbit", name: "Moon rabbit", plural: "Moon rabbits", desc: "Hops down from the moon to pound mochi by the water.", baseCost: 1.7e14, baseRate: 4.3e8, visualCap: 6 },
  { id: "kappa", name: "Kappa", plural: "Kappa", desc: "A river imp with a dish of water on its head. Loves cucumbers.", baseCost: 2.1e15, baseRate: 2.9e9, visualCap: 3 },
  { id: "crane", name: "Crane", plural: "Cranes", desc: "Wades the shallows on long legs. Said to live a thousand years.", baseCost: 2.6e16, baseRate: 2.1e10, visualCap: 3 },
  { id: "fox", name: "Shrine fox", plural: "Shrine foxes", desc: "A white messenger of the shrine, trailing fox-fire at night.", baseCost: 3.1e17, baseRate: 1.5e11, visualCap: 2 },
  { id: "rainbow", name: "Rainbow", plural: "Rainbows", desc: "An arc of colour over the garden. The koi leap to touch it.", baseCost: 7.1e19, baseRate: 1.1e12, visualCap: 1 },
  { id: "island", name: "Floating isle", plural: "Floating isles", desc: "A scrap of land drifting in the sky, a tiny shrine on top.", baseCost: 1.2e22, baseRate: 8.3e12, visualCap: 1 },
  { id: "dragon", name: "Pond dragon", plural: "Pond dragons", desc: "A koi that climbed the falls, come home to coil in the deep.", baseCost: 1.9e24, baseRate: 6.4e13, visualCap: 1 },
  { id: "river", name: "Heavenly river", plural: "Heavenly rivers", desc: "The Milky Way pours across the night, full of star koi.", baseCost: 5.4e26, baseRate: 4.3e14, visualCap: 1 },
];

export const PRODUCER_IDS = PRODUCERS.map((p) => p.id);

export function producer(id: ProducerId): ProducerDef {
  return PRODUCERS.find((p) => p.id === id)!;
}
