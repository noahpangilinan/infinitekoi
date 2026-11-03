import { css, hex, mix, scale, type RGB } from "./color";
import type { PondLayout } from "./layout";
import { hash2, mulberry32 } from "./rng";

// The parts of the pond that only change when you restore something: the sky
// and garden behind, the ground, and the stone rim. Drawn once into cached
// canvases. `level` is how many restoration stages are done (0..12).

export interface Look {
  level: number;
  theme: string;
}

const C = {
  skyGreyTop: hex("#7a8186"),
  skyGreyLow: hex("#a7aaa3"),
  skyBlueTop: hex("#4d97d3"),
  skyBlueLow: hex("#b4e0f0"),
  cloudGrey: hex("#949893"),
  cloudGreyLight: hex("#b9bbb5"),
  cloud: hex("#ffffff"),
  cloudShade: hex("#d6e8f2"),
  hillFar: hex("#7591a6"),
  hillNear: hex("#5b7f74"),
  grassDead: hex("#706a40"),
  grassDeadDark: hex("#5a5534"),
  grassLush: hex("#5a8f3c"),
  grassLushDark: hex("#467a30"),
  grassLushLight: hex("#78ad4c"),
  soil: hex("#4b3a2a"),
  soilWet: hex("#33281e"),
  stone: hex("#8f8c84"),
  stoneLight: hex("#b8b5ac"),
  stoneDark: hex("#5d5a54"),
  moss: hex("#5e8b37"),
  mossLight: hex("#8ab655"),
  weed: hex("#8a7a3e"),
  weedDark: hex("#5f5530"),
  trunk: hex("#4b3627"),
  gravel: hex("#c9c4b6"),
  gravelLine: hex("#a9a395"),
  plank: hex("#9a6a3e"),
  plankDark: hex("#6e4a2b"),
  plankLight: hex("#b9875a"),
};

function canopyColors(theme: string): RGB[][] {
  switch (theme) {
    case "autumn":
      return [[hex("#d8642a"), hex("#b04621"), hex("#f0954a")], [hex("#c93a2a"), hex("#982819"), hex("#e86a4c")], [hex("#d9a03a"), hex("#a8742a"), hex("#f0c35c")]];
    case "sakura":
      return [[hex("#f2b3c8"), hex("#d98aa6"), hex("#fbd6e2")], [hex("#eaa0ba"), hex("#cc7896"), hex("#f8c8d8")]];
    default:
      return [[hex("#c94a30"), hex("#9c3220"), hex("#e3704f")], [hex("#4f8a3a"), hex("#3a6b2b"), hex("#6fa84e")], [hex("#d06a34"), hex("#a44c22"), hex("#ea9358")]];
  }
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, c: RGB, a = 1): void {
  ctx.fillStyle = css(c, a);
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: RGB, a = 1): void {
  ctx.fillStyle = css(c, a);
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// A filled pixel ellipse.
export function ellipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, c: RGB, a = 1): void {
  ctx.fillStyle = css(c, a);
  for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
    const half = rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)));
    if (half < 0.4) continue;
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), Math.max(1, Math.round(half * 2)), 1);
  }
}

function drawSky(ctx: CanvasRenderingContext2D, L: PondLayout, clear: boolean): void {
  const top = clear ? C.skyBlueTop : C.skyGreyTop;
  const low = clear ? C.skyBlueLow : C.skyGreyLow;
  // Banded gradient with a dithered seam between bands.
  const bands = 8;
  for (let y = 0; y < L.horizon; y++) {
    const t = y / L.horizon;
    const band = Math.floor(t * bands);
    const frac = t * bands - band;
    for (let x = 0; x < L.W; x++) {
      const b = frac > 0.75 && hash2(x, y, 3) < (frac - 0.75) * 4 ? band + 1 : band;
      dot(ctx, x, y, mix(top, low, b / bands));
    }
  }
  // Clouds: soft lumps, grey and heavy when overcast, small and white when clear.
  const rng = mulberry32(clear ? 11 : 5);
  const n = clear ? 4 : 7;
  for (let i = 0; i < n; i++) {
    const cx = rng() * L.W;
    const cy = 6 + rng() * L.horizon * (clear ? 0.45 : 0.6);
    const w = clear ? 14 + rng() * 18 : 30 + rng() * 40;
    for (let k = 0; k < 5; k++) {
      const ox = (k - 2) * w * 0.22 + (rng() - 0.5) * 4;
      const r = w * (0.22 + rng() * 0.12) * (k === 2 ? 1.3 : 1);
      ellipse(ctx, cx + ox, cy + 1, r, r * 0.45, clear ? C.cloudShade : C.cloudGrey);
      ellipse(ctx, cx + ox, cy, r * 0.9, r * 0.4, clear ? C.cloud : C.cloudGreyLight);
    }
  }
}

function drawHills(ctx: CanvasRenderingContext2D, L: PondLayout, clear: boolean): void {
  const far = clear ? C.hillFar : mix(C.hillFar, C.skyGreyLow, 0.5);
  const near = clear ? C.hillNear : mix(C.hillNear, C.grassDeadDark, 0.4);
  for (let x = 0; x < L.W; x++) {
    const h1 = 10 + 6 * Math.sin(x * 0.021 + 1) + 4 * Math.sin(x * 0.053 + 0.4);
    rect(ctx, x, L.horizon - h1, 1, h1, far);
    const h2 = 4 + 4 * Math.sin(x * 0.034 + 2.5) + 2 * Math.sin(x * 0.09);
    rect(ctx, x, L.horizon - h2, 1, h2, near);
  }
}

function tree(ctx: CanvasRenderingContext2D, x: number, base: number, size: number, colors: RGB[], seed: number): void {
  const rng = mulberry32(seed);
  rect(ctx, x - 1, base - size * 0.9, 2, size * 0.9, C.trunk);
  const blobs = 6 + Math.floor(rng() * 3);
  for (let i = 0; i < blobs; i++) {
    const bx = x + (rng() - 0.5) * size * 1.3;
    const by = base - size * 0.95 + (rng() - 0.5) * size * 0.6;
    const r = size * (0.35 + rng() * 0.2);
    ellipse(ctx, bx + 1, by + 1, r, r * 0.8, colors[1]);
    ellipse(ctx, bx, by, r * 0.9, r * 0.72, colors[0]);
    ellipse(ctx, bx - r * 0.25, by - r * 0.25, r * 0.4, r * 0.3, colors[2]);
  }
}

function bareTree(ctx: CanvasRenderingContext2D, x: number, base: number, size: number, seed: number): void {
  const rng = mulberry32(seed);
  rect(ctx, x, base - size, 1, size, C.trunk);
  for (let i = 0; i < 4; i++) {
    const y = base - size * (0.4 + rng() * 0.55);
    const dir = rng() < 0.5 ? -1 : 1;
    const len = 2 + rng() * size * 0.4;
    for (let k = 0; k < len; k++) dot(ctx, x + dir * k, y - k * 0.6, C.trunk);
  }
}

function drawGarden(ctx: CanvasRenderingContext2D, L: PondLayout, look: Look): void {
  const rng = mulberry32(21);
  if (look.level >= 10) {
    const palettes = canopyColors(look.theme);
    // A low stone wall, then a row of maples along it.
    for (let x = 0; x < L.W; x++) {
      const h = 3;
      rect(ctx, x, L.horizon - h, 1, h, hash2(x >> 2, 1, 9) < 0.5 ? C.stone : C.stoneDark);
      if (x % 4 === 0) dot(ctx, x, L.horizon - h, C.stoneLight);
    }
    const count = Math.round(L.W / 34);
    for (let i = 0; i < count; i++) {
      const x = (i + 0.3 + rng() * 0.4) * (L.W / count);
      tree(ctx, x, L.horizon + 1, 12 + rng() * 7, palettes[i % palettes.length], 100 + i);
    }
  } else {
    // A sagging fence and a few dead trees.
    for (let x = 0; x < L.W; x += 9) {
      if (hash2(x, 2, 4) < 0.25) continue;
      const lean = hash2(x, 3, 4) < 0.3 ? 1 : 0;
      rect(ctx, x + lean, L.horizon - 6, 1, 6, C.trunk);
    }
    for (let x = 0; x < L.W; x++) if (hash2(x >> 3, 5, 4) > 0.3) dot(ctx, x, L.horizon - 4 + (x % 9 > 4 ? 1 : 0), C.trunk);
    for (let i = 0; i < 3; i++) bareTree(ctx, L.W * (0.15 + i * 0.33 + rng() * 0.1), L.horizon + 1, 12 + rng() * 6, 200 + i);
  }
}

function drawGround(ctx: CanvasRenderingContext2D, L: PondLayout, look: Look): void {
  const lush = look.level >= 4;
  const base = lush ? C.grassLush : C.grassDead;
  const dark = lush ? C.grassLushDark : C.grassDeadDark;
  for (let y = L.horizon; y < L.H; y++) {
    for (let x = 0; x < L.W; x++) {
      const n = hash2(x, y, 1);
      let c = n < 0.18 ? dark : base;
      if (lush && n > 0.94) c = C.grassLushLight;
      // Damp soil in a ring just outside the water.
      const d = L.depth(x, y);
      if (d > -0.08 && d <= 0) c = d > -0.04 ? C.soilWet : C.soil;
      dot(ctx, x, y, c);
    }
  }
  if (lush && look.level >= 5) {
    // Small flowers scattered in the grass.
    const flowers = [hex("#f2e3a0"), hex("#e7a3c0"), hex("#ffffff"), hex("#b7a5e8")];
    const rng = mulberry32(31);
    for (let i = 0; i < L.W * 0.25; i++) {
      const x = rng() * L.W;
      const y = L.horizon + 4 + rng() * (L.H - L.horizon - 4);
      if (L.depth(x, y) > -0.15) continue;
      dot(ctx, x, y, flowers[i % flowers.length]);
    }
  }
}

function drawGravel(ctx: CanvasRenderingContext2D, L: PondLayout): void {
  // A narrow strip of raked gravel along the front shore, lines following the
  // water's edge and fading out toward the sides.
  for (let y = L.cy; y < L.H; y++) {
    for (let x = 0; x < L.W; x++) {
      const d = L.depth(x, y);
      const side = Math.abs(x - L.cx) / (L.rx * 1.25);
      const outer = -0.13 - 0.12 * (1 - side * side);
      if (d > -0.1 || d < outer || side > 1) continue;
      const line = Math.floor(-d * 55) % 3 === 0;
      dot(ctx, x, y, line ? C.gravelLine : hash2(x, y, 8) < 0.12 ? C.gravelLine : C.gravel);
    }
  }
}

// A small viewing platform reaching out over the front edge of the water,
// planks running across, with posts and a low rail.
export function drawDeck(ctx: CanvasRenderingContext2D, L: PondLayout): void {
  const { x, y, w, h } = L.deck;
  ellipse(ctx, x + w / 2, y + h + 1, w / 2 + 2, 2, C.soilWet, 0.6); // shadow on the water
  for (let row = 0; row < h; row++) {
    const c = row % 3 === 0 ? C.plankDark : row % 3 === 1 ? C.plankLight : C.plank;
    rect(ctx, x, y + row, w, 1, c);
  }
  for (let px = x + 3; px < x + w - 1; px += 7) rect(ctx, px, y + 1, 1, h - 1, C.plankDark, 0.6);
  rect(ctx, x - 1, y + h, w + 2, 1, C.plankDark);
  // Posts and rail.
  for (const px of [x, x + w - 2]) {
    rect(ctx, px, y - 6, 2, 7, C.plankDark);
    rect(ctx, px, y + h, 2, 3, C.plankDark);
  }
  rect(ctx, x, y - 6, w, 1, C.plankLight);
  rect(ctx, x, y - 5, w, 1, C.plankDark);
}

export function drawBackground(ctx: CanvasRenderingContext2D, L: PondLayout, look: Look): void {
  const clear = look.level >= 9;
  drawSky(ctx, L, clear);
  drawHills(ctx, L, clear);
  drawGround(ctx, L, look);
  drawGarden(ctx, L, look);
  if (look.level >= 11) drawGravel(ctx, L);
}

function stone(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, moss: boolean, cracked: boolean): void {
  const rng = mulberry32(seed);
  ellipse(ctx, x, y + 1, w / 2, h / 2, C.stoneDark);
  ellipse(ctx, x, y, w / 2, h / 2, C.stone);
  ellipse(ctx, x - w * 0.12, y - h * 0.18, w * 0.28, h * 0.22, C.stoneLight);
  if (cracked) {
    for (let k = 0; k < 3; k++) dot(ctx, x - 1 + k, y - 1 + (k % 2), C.stoneDark);
  }
  if (moss) {
    for (let k = 0; k < w * 0.6; k++) {
      const mx = x - w / 2 + rng() * w;
      const my = y - h / 2 + rng() * h * 0.5;
      dot(ctx, mx, my, rng() < 0.5 ? C.moss : C.mossLight);
    }
  }
}

function weeds(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number): void {
  const rng = mulberry32(seed);
  for (let b = 0; b < 4; b++) {
    const bx = x + (rng() - 0.5) * 6;
    const h = 3 + rng() * 5;
    const lean = (rng() - 0.5) * 0.8;
    for (let k = 0; k < h; k++) dot(ctx, bx + lean * k, y - k, k > h - 2 ? C.weed : C.weedDark);
  }
}

function fern(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number): void {
  const rng = mulberry32(seed);
  for (let f = 0; f < 3; f++) {
    const dir = f - 1;
    const len = 4 + rng() * 3;
    for (let k = 0; k < len; k++) {
      const fx = x + dir * k * 0.8;
      const fy = y - k * 0.7 + (k * k) / 12;
      dot(ctx, fx, fy, C.moss);
      if (k % 2 === 0) dot(ctx, fx, fy - 1, C.mossLight);
    }
  }
}

// Stones round the water, plus weeds early on and moss and ferns later.
export function drawRim(ctx: CanvasRenderingContext2D, L: PondLayout, look: Look): void {
  const tidy = look.level >= 3;
  const moss = look.level >= 5;
  const sorted = [...L.stones].sort((a, b) => a.y - b.y);
  for (const s of sorted) {
    const missing = !tidy && hash2(s.seed, 1) < 0.4;
    if (missing) continue;
    const jitter = tidy ? 0 : (hash2(s.seed, 2) - 0.5) * 3;
    stone(ctx, s.x + jitter, s.y + Math.abs(jitter) * 0.5, s.w, s.h, s.seed, moss, !tidy && hash2(s.seed, 3) < 0.4);
  }
  if (look.level < 4) {
    for (let i = 0; i < 26; i++) {
      const p = L.edge((i / 26) * Math.PI * 2 + 0.1, 6);
      if (hash2(i, 9) < 0.7) weeds(ctx, p.x, p.y, 500 + i);
    }
  }
  if (moss) {
    for (let i = 0; i < 9; i++) {
      const p = L.edge(0.4 + i * 0.7, 8);
      fern(ctx, p.x, p.y, 700 + i);
    }
  }
}

// The fallen stones that lie in the water before the rim is reset.
export function drawFallenStones(ctx: CanvasRenderingContext2D, L: PondLayout, level: number): void {
  if (level >= 3) return;
  for (const s of L.stones) {
    if (hash2(s.seed, 1) >= 0.4 || hash2(s.seed, 4) > 0.45) continue;
    const p = L.edge(s.theta, -7 - hash2(s.seed, 5) * 6);
    ellipse(ctx, p.x, p.y, s.w * 0.45, s.h * 0.4, scale(C.stoneDark, 0.8));
    ellipse(ctx, p.x - 1, p.y - 1, s.w * 0.25, s.h * 0.2, C.stone, 0.7);
  }
}
