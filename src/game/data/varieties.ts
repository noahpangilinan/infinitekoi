// Koi varieties. Every koi bought rolls one by weight; discovering a new one
// adds to production. Colours are used by the sprite painter.

export interface Variety {
  id: string;
  name: string;
  weight: number; // relative chance
  rare: boolean;
  base: string; // body colour
  patches: string[]; // patch colours, drawn in order
  coverage: number; // 0..1, how much of the back is patterned
  tancho?: boolean; // a single red spot on the head
  metallic?: boolean; // shimmering highlight
  scaled?: boolean; // net-like scale pattern (asagi)
}

export const VARIETIES: Variety[] = [
  { id: "kohaku", name: "Kohaku", weight: 30, rare: false, base: "#f4f1ea", patches: ["#e0472b"], coverage: 0.45 },
  { id: "sanke", name: "Taisho Sanke", weight: 22, rare: false, base: "#f4f1ea", patches: ["#e0472b", "#1b1a1f"], coverage: 0.5 },
  { id: "showa", name: "Showa", weight: 16, rare: false, base: "#1b1a1f", patches: ["#e0472b", "#f4f1ea"], coverage: 0.6 },
  { id: "asagi", name: "Asagi", weight: 12, rare: false, base: "#7f9bb5", patches: ["#e0602b"], coverage: 0.25, scaled: true },
  { id: "tancho", name: "Tancho", weight: 8, rare: false, base: "#f4f1ea", patches: [], coverage: 0, tancho: true },
  { id: "utsuri", name: "Shiro Utsuri", weight: 6, rare: false, base: "#1b1a1f", patches: ["#f4f1ea"], coverage: 0.55 },
  { id: "ogon", name: "Yamabuki Ogon", weight: 4, rare: true, base: "#e8b52c", patches: [], coverage: 0, metallic: true },
  { id: "ghost", name: "Ghost Koi", weight: 1.5, rare: true, base: "#6c6f6a", patches: ["#c9c3a6"], coverage: 0.35, metallic: true },
  { id: "platinum", name: "Platinum Ogon", weight: 0.5, rare: true, base: "#e9ecef", patches: [], coverage: 0, metallic: true },
];

export function variety(id: string): Variety {
  return VARIETIES.find((v) => v.id === id) ?? VARIETIES[0];
}

// Pick a variety; rareBoost multiplies the weight of rare ones.
export function rollVariety(rng: () => number, rareBoost = 1): Variety {
  const weights = VARIETIES.map((v) => v.weight * (v.rare ? rareBoost : 1));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < VARIETIES.length; i++) {
    r -= weights[i];
    if (r < 0) return VARIETIES[i];
  }
  return VARIETIES[VARIETIES.length - 1];
}
