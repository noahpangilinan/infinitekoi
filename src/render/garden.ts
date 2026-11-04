import { hex, mix, type RGB } from "./color";
import { dot, ellipse, line, rect } from "./draw";
import type { PondLayout, Spot } from "./layout";
import { hash2, mulberry32 } from "./rng";

// The garden around the pond: trees, shrubs, the pine, the basin, the pagoda
// and the moon-viewing deck. Static pieces are drawn once into the cached
// background and foreground layers; the deck and bamboo move a little and are
// drawn every frame.

// Four shades per foliage, dark underside to sunlit top.
export type Leaf = [RGB, RGB, RGB, RGB];
const leaf = (a: string, b: string, c: string, d: string): Leaf => [hex(a), hex(b), hex(c), hex(d)];

const GREEN = leaf("#2c5224", "#447a32", "#66a346", "#97cc63");
const CEDAR = leaf("#1b3826", "#2b5236", "#3f6e46", "#5f8f58");
const PINE = leaf("#1d3a28", "#2e5a38", "#477c4a", "#6f9f5e");
const BAMBOO_LEAF = leaf("#3e6a2a", "#5a8c36", "#7fb04a", "#a9d26a");

export function maplePalette(theme: string): Leaf {
  if (theme === "autumn") return leaf("#7a2a12", "#c2521e", "#e8822f", "#f8b45a");
  if (theme === "sakura") return leaf("#b5708a", "#dc93ad", "#f3b9cc", "#fde0ea");
  return leaf("#6e1a17", "#a92b25", "#d64a35", "#f07a52");
}

function broadleaf(theme: string): Leaf {
  return theme === "autumn" ? leaf("#6e4a12", "#a8741f", "#d6a23a", "#f0cf6a") : GREEN;
}

const BARK = hex("#4e382b");
const BARK_LIGHT = hex("#76584a");
const PINE_BARK = hex("#3f3029");
const STONE = hex("#9b978c");
const STONE_LIGHT = hex("#c4c0b4");
const STONE_DARK = hex("#625f57");
const MOSS = hex("#5e8b37");
const MOSS_LIGHT = hex("#8ab655");
const SHADE = hex("#24381c");

// ---- Where things go ------------------------------------------------------

export interface Bed {
  x: number;
  y: number;
  size: number;
  kind: "azalea" | "hydrangea";
  front: boolean;
}

export interface GardenPlan {
  backMaples: { x: number; y: number; size: number; lean: number }[];
  pine: Spot;
  basin: Spot;
  spout: Spot; // where the drip leaves the bamboo
  pagoda: Spot;
  beds: Bed[];
  path: { x: number; y: number; w: number; h: number }[];
  bamboo: { x: number; y: number; seed: number }[];
  scatter: Scatter[];
}

// Shrubs, trees and rocks spread over the lawn, set back from the water.
export interface Scatter {
  x: number;
  y: number;
  size: number;
  kind: "shrub" | "tree" | "rock" | "fern";
  seed: number;
}

const plans = new WeakMap<PondLayout, GardenPlan>();

export function gardenPlan(L: PondLayout): GardenPlan {
  let plan = plans.get(L);
  if (plan) return plan;
  const at = (theta: number, out: number) => L.edge(theta, out);
  const left = Math.max(10, L.cx - L.rx - 6);
  const right = Math.min(L.W - 10, L.cx + L.rx + 6);

  const beds: Bed[] = [];
  const bed = (theta: number, out: number, size: number, kind: Bed["kind"]) => {
    const p = at(theta, out);
    beds.push({ x: p.x, y: p.y, size, kind, front: Math.sin(theta) > 0.2 });
  };
  bed(-2.2, 12, 5, "azalea");
  bed(-1.62, 9, 4, "hydrangea");
  bed(-0.78, 12, 5, "azalea");
  bed(-0.32, 16, 4, "hydrangea");
  bed(-2.75, 16, 4, "hydrangea");
  bed(2.95, 22, 6, "azalea");
  bed(2.25, 24, 5, "hydrangea");
  bed(0.62, 26, 6, "azalea");
  bed(0.2, 24, 4, "hydrangea");

  // Stepping stones: from the bottom of the screen, curving to the front-left shore.
  const end = at(1.95, 5);
  const start = { x: L.cx - L.rx * 0.95, y: L.H + 3 };
  const ctrl = { x: L.cx - L.rx * 0.95, y: end.y + 6 };
  const path: GardenPlan["path"] = [];
  const n = Math.max(4, Math.round((start.y - end.y) / 7));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * ctrl.x + t * t * end.x;
    const y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * ctrl.y + t * t * end.y;
    const near = 1 - t * 0.5;
    path.push({ x: x + (i % 2 ? 2 : -2), y, w: 7 * near + 2, h: 3 * near + 1 });
  }

  const basin = at(0.42, 30);
  const reserved: Spot[] = [L.gate, L.waterfall, at(-2.35, 14), at(-2.85, 26), at(-0.25, 28), basin, ...path];
  const scatter: Scatter[] = [];
  const srng = mulberry32(77);
  const tryPlace = (x: number, y: number, kind: Scatter["kind"], size: number, room: number) => {
    if (x < 4 || x > L.W - 4 || y > L.H + 2) return;
    if (L.depth(x, y) > -0.28 - size / Math.max(L.rx, 1)) return;
    if (reserved.some((r) => Math.abs(r.x - x) < room + size && Math.abs(r.y - y) < room * 0.6 + size * 0.5)) return;
    if (scatter.some((o) => Math.abs(o.x - x) < (o.size + size) * 0.8 && Math.abs(o.y - y) < (o.size + size) * 0.45)) return;
    scatter.push({ x, y, size, kind, seed: Math.floor(srng() * 1e6) });
  };
  // The band between the fence and the pond: further back means smaller.
  for (let i = 0; i < 160; i++) {
    const x = srng() * L.W;
    const y = L.horizon + 4 + srng() * Math.max(4, L.cy - L.horizon - 4);
    const depthIn = (y - L.horizon) / Math.max(1, L.cy - L.horizon);
    if (srng() < 0.5) tryPlace(x, y, "tree", 13 + depthIn * 16, 8);
    else tryPlace(x, y, "shrub", 4 + depthIn * 4, 6);
  }
  // The front lawn.
  for (let i = 0; i < 80; i++) {
    const x = srng() * L.W;
    const y = L.cy + srng() * (L.H - L.cy + 4);
    const roll = srng();
    tryPlace(x, y, roll < 0.35 ? "shrub" : roll < 0.6 ? "rock" : "fern", roll < 0.35 ? 5 + srng() * 4 : 2.5 + srng() * 2, 8);
  }
  scatter.sort((a, b) => a.y - b.y);
  plan = {
    backMaples: [
      { ...at(-2.85, 26), size: Math.min(48, L.ry * 0.62), lean: 1 },
      { ...at(-0.25, 28), size: Math.min(42, L.ry * 0.56), lean: -1 },
    ],
    pine: { x: Math.max(left - 14, 16), y: at(2.7, 24).y },
    basin: { x: Math.min(basin.x, right + 8), y: basin.y },
    spout: { x: Math.min(basin.x, right + 8) - 2, y: basin.y - 8 },
    pagoda: at(-2.35, 14),
    beds,
    path,
    bamboo: [
      { x: 9, y: L.horizon + 12, seed: 1 },
      { x: L.W - 10, y: L.horizon + 10, seed: 2 },
    ],
    scatter,
  };
  plans.set(L, plan);
  return plan;
}

// Where hummingbirds and butterflies feed: the tops of the flower beds.
export function flowerSpots(L: PondLayout): Spot[] {
  return gardenPlan(L).beds.map((b) => ({ x: b.x, y: b.y - b.size * 1.4 }));
}

// ---- Foliage --------------------------------------------------------------

// A clump of leaves: an ellipse of pixels with ragged edges, lit from the
// upper left.
export function leafClump(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, pal: Leaf, seed: number, airy = 1): void {
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  const RX = Math.ceil(rx);
  const RY = Math.ceil(ry);
  for (let y = -RY; y <= RY; y++) {
    for (let x = -RX; x <= RX; x++) {
      const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (d > 1) continue;
      const n = hash2(x0 + x, y0 + y, seed);
      if (d > 0.62 && n < (d - 0.62) * 2.2 * airy) continue; // leafy, broken edge
      const t = y / ry + (x / rx) * 0.35 + (n - 0.5) * 0.7;
      const c = t < -0.6 ? pal[3] : t < -0.05 ? pal[2] : t < 0.5 ? pal[1] : pal[0];
      dot(ctx, x0 + x, y0 + y, c);
    }
  }
}

function trunk(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, dark: RGB, light: RGB): void {
  const n = Math.max(1, Math.ceil(Math.abs(y1 - y0)), Math.ceil(Math.abs(x1 - x0)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const w = Math.max(1, Math.round(w0 + (w1 - w0) * t));
    rect(ctx, x - w / 2, y, w, 1, dark);
    if (w > 1) dot(ctx, x - w / 2, y, light);
  }
}

// A Japanese maple: a slim, curving trunk that forks into spreading branches,
// with the leaves in flat, layered tiers like a parasol.
export function drawMaple(ctx: CanvasRenderingContext2D, x: number, base: number, size: number, pal: Leaf, seed: number, lean = 0): void {
  const rng = mulberry32(seed);
  ellipse(ctx, x + lean * size * 0.2, base, size * 0.55, size * 0.12, SHADE, 0.35);
  const forkX = x + lean * size * 0.18;
  const forkY = base - size * 0.42;
  trunk(ctx, x, base, forkX, forkY, Math.max(2, size / 9), Math.max(1, size / 14), BARK, BARK_LIGHT);
  const tiers: [number, number, number][] = [];
  const arms = 4;
  for (let i = 0; i < arms; i++) {
    const side = i % 2 ? 1 : -1;
    const spread = (0.25 + (i / arms) * 0.45 + rng() * 0.1) * size * side + lean * size * 0.15;
    const ex = forkX + spread;
    const ey = forkY - size * (0.12 + rng() * 0.38);
    trunk(ctx, forkX, forkY, ex, ey, Math.max(1, size / 16), 1, BARK, BARK_LIGHT);
    tiers.push([ex, ey, size * (0.26 + rng() * 0.12)]);
  }
  tiers.push([forkX + lean * size * 0.1, forkY - size * 0.55, size * 0.3]);
  // Higher tiers first, so the lower ones overlap them with their dark undersides.
  tiers.sort((a, b) => a[1] - b[1]);
  for (const [tx, ty, r] of tiers) {
    leafClump(ctx, tx, ty + 1, r, r * 0.42, pal, seed + Math.round(tx), 1.2);
    leafClump(ctx, tx + r * 0.25, ty - r * 0.2, r * 0.6, r * 0.28, pal, seed + 7 + Math.round(ty), 1.2);
  }
}

// A round broadleaf tree.
function drawRoundTree(ctx: CanvasRenderingContext2D, x: number, base: number, size: number, pal: Leaf, seed: number): void {
  const rng = mulberry32(seed);
  trunk(ctx, x, base, x, base - size * 0.5, 2, 1, BARK, BARK_LIGHT);
  const blobs = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < blobs; i++) {
    const bx = x + (rng() - 0.5) * size * 0.9;
    const by = base - size * (0.6 + rng() * 0.45);
    const r = size * (0.24 + rng() * 0.14);
    leafClump(ctx, bx, by, r, r * 0.8, pal, seed + i * 31);
  }
}

// A tall, narrow cedar.
function drawCedar(ctx: CanvasRenderingContext2D, x: number, base: number, size: number, pal: Leaf, seed: number): void {
  rect(ctx, x, base - size * 0.25, 1, size * 0.25, BARK);
  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const t = i / layers;
    const r = size * 0.3 * (1 - t * 0.8);
    leafClump(ctx, x, base - size * (0.3 + t * 0.75), r, r * 0.6 + 1, pal, seed + i * 17);
  }
}

// ---- The far garden -------------------------------------------------------

// A neat fence of split bamboo, poles bound with black cord.
export function drawBambooFence(ctx: CanvasRenderingContext2D, L: PondLayout): void {
  const top = L.horizon - 7;
  const pole = hex("#c9b46c");
  const poleDark = hex("#a08c4a");
  const poleLight = hex("#e2d28e");
  for (let x = 0; x < L.W; x++) {
    const c = x % 3 === 0 ? poleDark : x % 3 === 1 ? pole : poleLight;
    rect(ctx, x, top, 1, 7, c);
    if ((x + 1) % 3 === 0 && hash2(x, 1, 2) < 0.5) dot(ctx, x, top + 3, poleDark);
  }
  for (let x = 0; x < L.W; x++) {
    dot(ctx, x, top + 1, hex("#7a6a36"));
    dot(ctx, x, top + 5, hex("#7a6a36"));
  }
  for (let x = 4; x < L.W; x += 16) {
    rect(ctx, x - 1, top - 1, 2, 9, poleDark); // posts
    dot(ctx, x - 1, top + 1, hex("#1e1a18"));
    dot(ctx, x, top + 5, hex("#1e1a18"));
  }
}

// The rows of trees behind the fence: a hazy far row, then a near row.
export function drawBackTrees(ctx: CanvasRenderingContext2D, L: PondLayout, grove: boolean, maples: boolean, theme: string): void {
  const haze = hex("#8fb0bf");
  const fade = (p: Leaf, k: number): Leaf => p.map((c) => mix(c, haze, k)) as Leaf;
  const rng = mulberry32(41);
  const maple = maplePalette(theme);
  if (grove) {
    const far = Math.round(L.W / 16);
    for (let i = 0; i < far; i++) {
      const x = (i + rng()) * (L.W / far);
      const s = 12 + rng() * 6;
      if (i % 3 === 1) drawCedar(ctx, x, L.horizon - 3, s * 1.3, fade(CEDAR, 0.35), 900 + i);
      else drawRoundTree(ctx, x, L.horizon - 3, s, fade(broadleaf(theme), 0.35), 900 + i);
    }
  }
  const near = Math.round(L.W / 26);
  for (let i = 0; i < near; i++) {
    const x = (i + 0.2 + rng() * 0.6) * (L.W / near);
    const s = 15 + rng() * 7;
    const kind = i % 3;
    if (maples && (kind === 0 || !grove)) drawMaple(ctx, x, L.horizon, s, maple, 1000 + i, rng() - 0.5);
    else if (!grove) continue;
    else if (kind === 1) drawCedar(ctx, x, L.horizon, s * 1.5, CEDAR, 1000 + i);
    else drawRoundTree(ctx, x, L.horizon, s, broadleaf(theme), 1000 + i);
  }
}

// ---- Things on the ground -------------------------------------------------

export function drawPath(ctx: CanvasRenderingContext2D, L: PondLayout): void {
  for (const s of gardenPlan(L).path) {
    ellipse(ctx, s.x + 1, s.y + 1, s.w / 2, s.h / 2, SHADE, 0.5);
    ellipse(ctx, s.x, s.y, s.w / 2, s.h / 2, STONE);
    ellipse(ctx, s.x - s.w * 0.12, s.y - s.h * 0.15, s.w * 0.3, s.h * 0.25, STONE_LIGHT);
    dot(ctx, s.x + s.w * 0.3, s.y, STONE_DARK);
  }
}

function drawAzalea(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, seed: number, theme: string): void {
  const flowers = theme === "autumn" ? [hex("#e86a3a"), hex("#f29a5a")] : [hex("#e2457e"), hex("#f27aa6"), hex("#ffb3cf")];
  ellipse(ctx, x, y + 1, size * 1.3, size * 0.45, SHADE, 0.45);
  leafClump(ctx, x, y - size * 0.45, size * 1.25, size * 0.75, GREEN, seed, 0.4);
  const rng = mulberry32(seed);
  for (let i = 0; i < size * 6; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng());
    const fx = x + Math.cos(a) * r * size * 1.1;
    const fy = y - size * 0.55 + Math.sin(a) * r * size * 0.6 - (1 - r) * 1;
    dot(ctx, fx, fy, flowers[i % flowers.length]);
  }
}

function drawHydrangea(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, seed: number): void {
  const heads = [[hex("#5d7ad6"), hex("#8aa4f0")], [hex("#8a62c9"), hex("#b598ea")], [hex("#b7c8f2"), hex("#e4ecff")]];
  ellipse(ctx, x, y + 1, size * 1.3, size * 0.45, SHADE, 0.45);
  leafClump(ctx, x, y - size * 0.4, size * 1.3, size * 0.7, GREEN, seed, 0.4);
  const rng = mulberry32(seed);
  const count = 3 + Math.floor(size / 2);
  for (let i = 0; i < count; i++) {
    const [c, light] = heads[Math.floor(rng() * heads.length)];
    const hx = x + (rng() - 0.5) * size * 1.8;
    const hy = y - size * 0.5 + (rng() - 0.6) * size * 0.8;
    ellipse(ctx, hx, hy, 1.6, 1.3, c);
    dot(ctx, hx - 1, hy - 1, light);
    dot(ctx, hx, hy - 1, light);
  }
}

export function drawBeds(ctx: CanvasRenderingContext2D, L: PondLayout, front: boolean, theme: string): void {
  gardenPlan(L)
    .beds.filter((b) => b.front === front)
    .sort((a, b) => a.y - b.y)
    .forEach((b, i) => (b.kind === "azalea" ? drawAzalea(ctx, b.x, b.y, b.size, 70 + i, theme) : drawHydrangea(ctx, b.x, b.y, b.size, 80 + i)));
}

// A clipped shrub mound, the rounded karikomi of Japanese gardens. With the
// flower beds planted, some of them bloom.
function drawShrub(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, seed: number, bloom: boolean, theme: string): void {
  ellipse(ctx, x + 1, y + 1, size * 1.3, size * 0.42, SHADE, 0.45);
  leafClump(ctx, x, y - size * 0.45, size * 1.2, size * 0.72, GREEN, seed, 0.25);
  if (bloom && seed % 3 === 0) {
    const rng = mulberry32(seed);
    const c = theme === "autumn" ? hex("#e86a3a") : seed % 2 ? hex("#f27aa6") : hex("#ffffff");
    for (let i = 0; i < size * 4; i++) dot(ctx, x + (rng() - 0.5) * size * 2, y - size * 0.6 + (rng() - 0.5) * size * 0.9, c);
  }
}

function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, seed: number): void {
  ellipse(ctx, x + 1, y + 1, size * 1.3, size * 0.5, SHADE, 0.45);
  ellipse(ctx, x, y - size * 0.3, size * 1.2, size * 0.75, STONE_DARK);
  ellipse(ctx, x - size * 0.2, y - size * 0.5, size * 0.8, size * 0.45, STONE);
  dot(ctx, x - size * 0.4, y - size * 0.7, STONE_LIGHT);
  if (seed % 2) dot(ctx, x + size * 0.3, y - size * 0.8, MOSS_LIGHT);
}

function drawFern(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  for (let f = -2; f <= 2; f++) {
    const len = size * 2 + 2 - Math.abs(f);
    for (let k = 0; k < len; k++) dot(ctx, x + f * k * 0.45, y - k * 0.6 + (k * k * Math.abs(f)) / 18, k % 2 ? MOSS_LIGHT : MOSS);
  }
}

// The lawn scatter, by what has been restored: rocks and ferns once the moss
// is in, shrubs with the flower beds, trees with the grove (some are maples).
export function drawScatter(ctx: CanvasRenderingContext2D, L: PondLayout, stages: { moss: boolean; flowers: boolean; grove: boolean; maples: boolean }, theme: string): void {
  const maple = maplePalette(theme);
  for (const s of gardenPlan(L).scatter) {
    if (s.kind === "tree") {
      const isMaple = stages.maples && s.seed % 3 === 0;
      if (!stages.grove && !isMaple) continue;
      if (isMaple) drawMaple(ctx, s.x, s.y, s.size * 1.1, maple, s.seed, (s.seed % 5) / 2 - 1);
      else if (s.seed % 3 === 1) drawCedar(ctx, s.x, s.y, s.size * 1.4, CEDAR, s.seed);
      else {
        ellipse(ctx, s.x + 1, s.y, s.size * 0.6, s.size * 0.15, SHADE, 0.45);
        drawRoundTree(ctx, s.x, s.y, s.size, broadleaf(theme), s.seed);
      }
    } else if (s.kind === "shrub") {
      if (stages.flowers || (stages.moss && s.seed % 2 === 0)) drawShrub(ctx, s.x, s.y, s.size, s.seed, stages.flowers, theme);
    } else if (stages.moss) {
      if (s.kind === "rock") drawRock(ctx, s.x, s.y, s.size, s.seed);
      else drawFern(ctx, s.x, s.y, s.size);
    }
  }
}

// The big maples standing just behind the pond, one on each side.
export function drawBackMaples(ctx: CanvasRenderingContext2D, L: PondLayout, theme: string): void {
  const pal = maplePalette(theme);
  for (const [i, m] of gardenPlan(L).backMaples.entries()) drawMaple(ctx, m.x, m.y, m.size, pal, 300 + i * 11, m.lean);
}

// A five-tiered stone pagoda.
export function drawPagoda(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ellipse(ctx, x, y + 1, 7, 2, SHADE, 0.5);
  rect(ctx, x - 4, y - 3, 9, 3, STONE_DARK);
  rect(ctx, x - 3, y - 3, 7, 1, STONE);
  let top = y - 3;
  for (let i = 0; i < 5; i++) {
    const body = 5 - Math.floor(i / 2);
    rect(ctx, x - Math.floor(body / 2), top - 2, body, 2, STONE);
    dot(ctx, x - Math.floor(body / 2), top - 2, STONE_LIGHT);
    top -= 2;
    const roof = 11 - i * 1.5;
    const half = Math.floor(roof / 2);
    rect(ctx, x - half, top - 1, half * 2 + 1, 1, STONE_DARK);
    rect(ctx, x - half + 1, top - 2, half * 2 - 1, 1, STONE_LIGHT);
    dot(ctx, x - half - 1, top - 2, STONE);
    dot(ctx, x + half + 1, top - 2, STONE);
    if (hash2(i, 3, 9) < 0.6) dot(ctx, x - half + 2, top - 1, MOSS);
    top -= 2;
  }
  // The spire: stacked rings and a jewel on top.
  for (let k = 0; k < 4; k++) dot(ctx, x, top - k, k % 2 ? STONE_LIGHT : STONE_DARK);
  dot(ctx, x, top - 4, STONE_LIGHT);
}

// ---- Near the viewer ------------------------------------------------------

// An old black pine, its trunk twisting toward the water and its branches
// pruned into flat clouds of needles.
export function drawPine(ctx: CanvasRenderingContext2D, x: number, base: number, size: number): void {
  ellipse(ctx, x + size * 0.3, base + 1, size * 0.6, size * 0.12, SHADE, 0.45);
  const pts: Spot[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push({ x: x + t * size * 0.55 + Math.sin(t * 5) * size * 0.07, y: base - t * size * 0.8 });
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const w = Math.max(1, Math.round(4 - i * 0.3));
    trunk(ctx, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, w, w, PINE_BARK, BARK_LIGHT);
  }
  const pads: [number, number, number][] = [
    [3, 1, 0.34],
    [5, -1, 0.3],
    [7, 1, 0.3],
    [9, -1, 0.22],
    [10, 0, 0.2],
  ];
  for (const [i, side, r] of pads) {
    const p = pts[i];
    const ex = p.x + side * size * 0.28 + size * 0.06;
    line(ctx, p.x, p.y, ex, p.y - 1, PINE_BARK);
    leafClump(ctx, ex, p.y - 2, size * r, size * r * 0.34 + 1, PINE, 500 + i, 0.6);
  }
}

// A low stone basin with a bamboo spout dripping into it, moss around it.
export function drawBasin(ctx: CanvasRenderingContext2D, L: PondLayout): void {
  const { basin: b, spout } = gardenPlan(L);
  ellipse(ctx, b.x, b.y + 1, 9, 3, SHADE, 0.5);
  for (const [dx, dy] of [[-8, 1], [7, 2], [-5, 3], [9, -1], [3, 4]]) {
    ellipse(ctx, b.x + dx, b.y + dy, 2, 1.2, STONE_DARK);
    dot(ctx, b.x + dx - 1, b.y + dy - 1, STONE_LIGHT);
  }
  ellipse(ctx, b.x, b.y, 6, 3, STONE_DARK);
  ellipse(ctx, b.x, b.y - 1, 6, 2.6, STONE);
  ellipse(ctx, b.x, b.y - 1.5, 4, 1.4, hex("#2c5560"));
  dot(ctx, b.x - 2, b.y - 2, hex("#7fb8c4"));
  for (let k = 0; k < 6; k++) dot(ctx, b.x - 6 + hash2(k, 1, 4) * 12, b.y - hash2(k, 2, 4) * 2, hash2(k, 3, 4) < 0.5 ? MOSS : MOSS_LIGHT);
  // Bamboo post and spout.
  const post = hex("#8faa4a");
  const postDark = hex("#5f7a2e");
  rect(ctx, spout.x + 5, spout.y - 2, 2, b.y - spout.y + 1, post);
  dot(ctx, spout.x + 5, spout.y + 3, postDark);
  rect(ctx, spout.x, spout.y - 1, 7, 1, post);
  rect(ctx, spout.x, spout.y, 7, 1, postDark);
  // A fern tucked behind.
  for (let f = 0; f < 3; f++) {
    for (let k = 0; k < 5; k++) dot(ctx, b.x + 8 + (f - 1) * k * 0.8, b.y - 2 - k * 0.7 + (k * k) / 12, k % 2 ? MOSS_LIGHT : MOSS);
  }
}

// ---- Moving parts ---------------------------------------------------------

// Clumps of bamboo in the far corners, swaying, leafy toward the top.
export function drawBamboo(ctx: CanvasRenderingContext2D, L: PondLayout, time: number): void {
  const culm = hex("#6f9a3a");
  const node = hex("#4b6e27");
  const shine = hex("#a3c763");
  const top = Math.min(L.horizon * 0.8 + 16, 80);
  for (const clump of gardenPlan(L).bamboo) {
    const rng = mulberry32(clump.seed * 77);
    const leaves: [number, number, number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const bx = clump.x + (rng() - 0.5) * 18;
      const by = clump.y + rng() * 4;
      const h = top * (0.7 + rng() * 0.3);
      const phase = rng() * 6;
      const sway = (k: number) => Math.sin(time * 0.7 + phase) * 2.5 * (k / h) ** 2;
      for (let k = 0; k < h; k++) {
        const x = Math.round(bx + sway(k));
        const y = by - k;
        const isNode = k % 7 === 0;
        dot(ctx, x, y, isNode ? node : culm);
        dot(ctx, x + 1, y, isNode ? node : k % 2 ? culm : shine);
      }
      for (let k = h * 0.45; k < h; k += 3) leaves.push([bx + sway(k), by - k, rng() < 0.5 ? -1 : 1, Math.floor(rng() * 3)]);
    }
    // Drooping sprays of slim leaves, drawn over the canes.
    for (const [x, y, dir, shade] of leaves) {
      for (let s = 0; s < 5; s++) dot(ctx, x + dir * (s + 1), y + s * 0.6, BAMBOO_LEAF[s < 2 ? shade + 1 : shade]);
      for (let s = 0; s < 3; s++) dot(ctx, x + dir * (s + 1), y + 1 + s * 0.9, BAMBOO_LEAF[shade]);
    }
  }
}

// ---- The moon-viewing deck -------------------------------------------------

const PLANK = hex("#9a6a3e");
const PLANK_DARK = hex("#6e4a2b");
const PLANK_LIGHT = hex("#b9875a");
const PLANK_DEEP = hex("#4a311d");

// Where the festival lanterns hang, for the deck and its night glow.
export function festivalLanterns(L: PondLayout, time: number): Spot[] {
  const { x, y, w } = L.deck;
  const top = y - 16;
  const out: Spot[] = [];
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const sag = Math.sin(t * Math.PI) * 4;
    out.push({ x: x + w * t + Math.sin(time * 1.3 + i) * 0.4, y: top + sag + 3 });
  }
  return out;
}

// A wooden deck reaching over the water, with a low rail, cushions, a vase of
// pampas grass and an offering of moon dumplings. The festival adds a string
// of paper lanterns.
export function drawDeck(ctx: CanvasRenderingContext2D, L: PondLayout, time: number, festival: boolean, night: number): void {
  const { x, y, w, h } = L.deck;
  // Shadow and post reflections on the water in front.
  ellipse(ctx, x + w / 2, y + h + 3, w / 2 + 3, 2.5, hex("#0e2430"), 0.35);
  for (const px of [x + 1, x + Math.floor(w / 2), x + w - 2]) {
    rect(ctx, px, y + h + 2, 1, 4, PLANK_DEEP);
    for (let k = 0; k < 4; k++) dot(ctx, px + Math.round(Math.sin(time * 2 + k + px) * 0.6), y + h + 6 + k, PLANK_DARK, 0.35 - k * 0.07);
  }
  // Floor: planks running across, lit toward the back edge.
  for (let row = 0; row < h; row++) {
    const c = row === 0 ? PLANK_LIGHT : row % 3 === 0 ? PLANK_DARK : row % 3 === 1 ? PLANK : mix(PLANK, PLANK_LIGHT, 0.4);
    rect(ctx, x, y + row, w, 1, c);
    for (let jx = x + ((row * 5) % 9) + 2; jx < x + w - 1; jx += 9) if (row % 3 !== 0) dot(ctx, jx, y + row, PLANK_DARK);
  }
  rect(ctx, x - 1, y + h, w + 2, 2, PLANK_DARK); // front edge
  rect(ctx, x - 1, y + h + 1, w + 2, 1, PLANK_DEEP);
  // Rail along the back and down the sides.
  for (const px of [x, x + Math.floor(w / 2), x + w - 1]) rect(ctx, px, y - 6, 1, 6, PLANK_DARK);
  rect(ctx, x, y - 6, w, 1, PLANK_LIGHT);
  rect(ctx, x, y - 3, w, 1, PLANK_DARK);
  rect(ctx, x, y - 6, 1, h, PLANK_DARK);
  rect(ctx, x + w - 1, y - 6, 1, h, PLANK_DARK);
  // Cushions.
  for (const cx of [x + Math.round(w * 0.3), x + Math.round(w * 0.62)]) {
    rect(ctx, cx - 2, y + h - 5, 5, 3, hex("#2f4377"));
    rect(ctx, cx - 2, y + h - 5, 5, 1, hex("#5a72b4"));
  }
  // The offering: a little stand with a pyramid of white dumplings.
  const ox = x + Math.round(w * 0.47);
  const oy = y + 3;
  rect(ctx, ox - 3, oy, 7, 2, PLANK_LIGHT);
  rect(ctx, ox - 2, oy + 2, 5, 1, PLANK_DARK);
  const dango = hex("#f6f1e4");
  const dangoShade = hex("#d4cab2");
  for (const [dx, dy] of [[-2, -1], [0, -1], [2, -1], [-1, -2], [1, -2], [0, -3]]) {
    dot(ctx, ox + dx, oy + dy, dango);
    dot(ctx, ox + dx, oy + dy + 0.5, dangoShade, 0.4);
  }
  // A vase of pampas grass in the corner, plumes nodding.
  const vx = x + 3;
  const vy = y + 4;
  rect(ctx, vx - 1, vy - 3, 3, 4, hex("#3a3a46"));
  dot(ctx, vx - 1, vy - 3, hex("#6a6a7a"));
  for (let s = 0; s < 4; s++) {
    const lean = (s - 1.5) * 0.35 + Math.sin(time * 0.9 + s) * 0.15;
    let px = vx;
    let py = vy - 3;
    for (let k = 0; k < 9; k++) {
      px = vx + lean * k + (k * k * lean) / 20;
      py = vy - 4 - k;
      dot(ctx, px, py, k > 5 ? hex("#e8d9a8") : hex("#9a9a5a"));
    }
    dot(ctx, px + lean * 2, py, hex("#f5ead0"));
  }
  if (festival) {
    // Poles at the back corners and a sagging cord of paper lanterns.
    rect(ctx, x, y - 17, 1, 11, PLANK_DEEP);
    rect(ctx, x + w - 1, y - 17, 1, 11, PLANK_DEEP);
    for (let k = 0; k <= w; k++) {
      const t = k / w;
      dot(ctx, x + k, y - 17 + Math.sin(t * Math.PI) * 4, hex("#2a2523"));
    }
    const red = hex("#d8432f");
    const white = hex("#f4ecd8");
    const warm = hex("#ffd27a");
    for (const [i, p] of festivalLanterns(L, time).entries()) {
      const body = mix(i % 2 ? white : red, warm, night * 0.6);
      rect(ctx, p.x - 1, p.y - 2, 3, 4, body);
      dot(ctx, p.x - 2, p.y - 1, body);
      dot(ctx, p.x + 2, p.y - 1, body);
      dot(ctx, p.x - 2, p.y, body);
      dot(ctx, p.x + 2, p.y, body);
      rect(ctx, p.x - 1, p.y - 3, 3, 1, hex("#2a2523"));
      rect(ctx, p.x - 1, p.y + 2, 3, 1, hex("#2a2523"));
    }
  }
}
