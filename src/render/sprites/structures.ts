import { hex, mix } from "../color";
import { dot, ellipse, line, rect } from "../draw";
import { hash2 } from "../rng";

// The big pieces: stone lanterns, the waterfall, the arched bridge and the
// shrine gate.

const STONE = hex("#9b978c");
const STONE_LIGHT = hex("#c4c0b4");
const STONE_DARK = hex("#625f57");
const GLOW = hex("#ffd27a");
const WATER_FALL = hex("#cfeef2");
const WATER_FALL_DARK = hex("#7cc1cf");
const FOAM = hex("#ffffff");
const LACQUER = hex("#c4382c");
const LACQUER_DARK = hex("#8e2219");
const LACQUER_LIGHT = hex("#e05a43");
const BLACK = hex("#2a2523");
const ROPE = hex("#e8d9a8");

// A tōrō: base, post, light box, roof with upturned corners.
export function drawLantern(ctx: CanvasRenderingContext2D, x: number, y: number, lit: number): void {
  rect(ctx, x - 3, y - 2, 7, 2, STONE_DARK);
  rect(ctx, x - 1, y - 7, 3, 5, STONE);
  dot(ctx, x - 1, y - 6, STONE_LIGHT);
  rect(ctx, x - 3, y - 8, 7, 1, STONE_DARK);
  rect(ctx, x - 2, y - 12, 5, 4, STONE);
  rect(ctx, x - 1, y - 11, 3, 2, lit > 0.05 ? mix(hex("#4a3a2a"), GLOW, lit) : hex("#3a332c"));
  rect(ctx, x - 4, y - 13, 9, 1, STONE_DARK);
  rect(ctx, x - 3, y - 14, 7, 1, STONE);
  dot(ctx, x - 4, y - 14, STONE);
  dot(ctx, x + 4, y - 14, STONE);
  rect(ctx, x - 1, y - 15, 3, 1, STONE_LIGHT);
  dot(ctx, x, y - 16, STONE_DARK);
}

// Additive glow drawn after the night tint.
export function drawLanternGlow(ctx: CanvasRenderingContext2D, x: number, y: number, lit: number, flicker: number): void {
  if (lit <= 0.05) return;
  const a = lit * (0.85 + flicker * 0.15);
  ellipse(ctx, x, y - 10, 9, 6, GLOW, 0.1 * a);
  ellipse(ctx, x, y - 10, 5, 3.5, GLOW, 0.18 * a);
  rect(ctx, x - 1, y - 11, 3, 2, GLOW, 0.8 * a);
  ellipse(ctx, x, y + 4, 6, 2, GLOW, 0.12 * a); // reflection pooled below
}

// Rocks piled on the far shore with water spilling down into the pond.
export function drawWaterfall(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const top = y - 22;
  // Rock pile.
  const rocks: [number, number, number, number][] = [[-11, -4, 7, 5], [10, -5, 8, 6], [-7, -16, 6, 5], [8, -17, 7, 5], [0, -24, 9, 4], [-13, -11, 5, 5], [13, -12, 5, 5]];
  for (const [dx, dy, rx, ry] of rocks) {
    ellipse(ctx, x + dx, y + dy + 1, rx, ry, STONE_DARK);
    ellipse(ctx, x + dx, y + dy, rx * 0.9, ry * 0.85, STONE);
    ellipse(ctx, x + dx - rx * 0.3, y + dy - ry * 0.3, rx * 0.35, ry * 0.3, STONE_LIGHT);
  }
  // The falling sheet: streaks that scroll downward.
  for (let fx = -4; fx <= 4; fx++) {
    for (let fy = top; fy < y; fy++) {
      const n = hash2(fx + 50, Math.floor(fy - time * 30), 3);
      dot(ctx, x + fx, fy, n < 0.35 ? WATER_FALL_DARK : n > 0.9 ? FOAM : WATER_FALL);
    }
  }
  // Foam churning where it lands.
  for (let i = 0; i < 26; i++) {
    const a = hash2(i, Math.floor(time * 8), 4) * Math.PI * 2;
    const r = hash2(i, Math.floor(time * 8), 5);
    dot(ctx, x + Math.cos(a) * r * 9, y + 1 + Math.sin(a) * r * 3, FOAM, 0.9);
  }
}

// A red arched bridge, seen from the side, spanning part of the pond.
export function drawBridge(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number): void {
  const span = x2 - x1;
  const rise = span * 0.16;
  const deckY = (x: number) => y - rise * Math.sin(((x - x1) / span) * Math.PI);
  // Shadow and reflection on the water.
  for (let x = Math.round(x1); x <= x2; x++) {
    dot(ctx, x, y + 3 + (deckY(x) - y) * -0.3, hex("#1d3a40"), 0.35);
  }
  for (let x = Math.round(x1); x <= x2; x++) {
    const d = deckY(x);
    rect(ctx, x, d, 1, 3, x % 4 === 0 ? hex("#7a5a3a") : hex("#9a7650"));
    dot(ctx, x, d + 3, LACQUER_DARK);
    // Railing.
    dot(ctx, x, d - 5, LACQUER_LIGHT);
    dot(ctx, x, d - 4, LACQUER);
  }
  // Posts, with gold caps at the ends.
  for (let i = 0; i <= 6; i++) {
    const px = x1 + (span * i) / 6;
    const d = deckY(px);
    rect(ctx, px, d - 5, 1, 5, LACQUER_DARK);
    if (i === 0 || i === 6) {
      rect(ctx, px - 1, d - 7, 3, 7, LACQUER);
      dot(ctx, px, d - 8, hex("#e8c35a"));
    }
  }
  // Piers into the water.
  for (const px of [x1 + span * 0.25, x1 + span * 0.75]) rect(ctx, px, deckY(px) + 3, 2, y - deckY(px) + 1, LACQUER_DARK);
}

// A torii: two pillars, a crossbar, and the curved black top beam.
export function drawGate(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const h = 26;
  const halfW = 11;
  for (const side of [-1, 1]) {
    const px = x + side * (halfW - 3);
    rect(ctx, px - 1, y - h + 4, 3, h - 4, LACQUER);
    dot(ctx, px - 1, y - h + 6, LACQUER_LIGHT);
    rect(ctx, px - 2, y - 2, 5, 2, BLACK);
  }
  rect(ctx, x - halfW + 1, y - h + 9, halfW * 2 - 1, 2, LACQUER); // nuki crossbar
  rect(ctx, x - halfW + 1, y - h + 11, halfW * 2 - 1, 1, LACQUER_DARK);
  rect(ctx, x - halfW, y - h + 4, halfW * 2 + 1, 2, LACQUER); // shimaki
  // Kasagi: the top beam, curving up at the ends.
  for (let dx = -halfW - 3; dx <= halfW + 3; dx++) {
    const lift = Math.round((dx * dx) / 60);
    rect(ctx, x + dx, y - h + 1 - lift, 1, 3, BLACK);
  }
  rect(ctx, x - 1, y - h + 4, 3, 5, BLACK); // gakuzuka plaque post
  // A shimenawa rope with paper streamers.
  line(ctx, x - halfW + 3, y - h + 14, x + halfW - 3, y - h + 14, ROPE);
  for (const dx of [-4, 0, 4]) {
    dot(ctx, x + dx, y - h + 15, hex("#ffffff"));
    dot(ctx, x + dx, y - h + 16, hex("#ffffff"));
  }
}
