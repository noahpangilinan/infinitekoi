import { producer, type ProducerId } from "../game/data/producers";
import type { GameState } from "../game/state";
import { hex, type RGB } from "./color";
import type { Light } from "./daynight";
import { dot, ellipse, line, rect } from "./draw";
import type { PondLayout, Spot } from "./layout";
import type { Effects } from "./particles";
import { hash2, mulberry32 } from "./rng";

// The late producers: creatures and wonders out of Japanese folklore.
// Moon rabbits on the lawn, kappa at the water's edge, cranes in the
// shallows, shrine foxes by the gate, a rainbow, a floating isle, a dragon
// under the water and the heavenly river across the night sky.

export interface BankItem {
  y: number;
  draw: () => void;
}

interface Rabbit {
  x: number;
  y: number;
  tx: number;
  ty: number;
  face: number;
  hop: number; // 0..1 through a hop, or <0 resting
  rest: number;
}

const WHITE = hex("#f4f1ea");
const WHITE_SHADE = hex("#cfc8bc");
const PINK = hex("#f0a6b4");
const INK = hex("#1e1a18");
const KAPPA = hex("#5f9a4a");
const KAPPA_DARK = hex("#3f6a32");
const KAPPA_SHELL = hex("#6b5a32");
const KAPPA_DISH = hex("#d8ece4");
const BEAK = hex("#e8c050");
const CRANE_RED = hex("#d8323a");
const FOX_RED = hex("#d8432f");
const FOXFIRE = hex("#8ad8ff");
const JADE = hex("#3fae8a");
const JADE_DARK = hex("#24705a");
const JADE_LIGHT = hex("#8fe0c0");
const GOLD = hex("#f2c14e");
const RAINBOW: RGB[] = ["#e8505a", "#f0954a", "#f2d24a", "#6fc06a", "#5a9ae0", "#8a6ad0"].map(hex);
const ROCK = hex("#7d7a70");
const ROCK_DARK = hex("#55524b");
const GRASS = hex("#5a8f3c");
const GRASS_LIGHT = hex("#78ad4c");
const STAR = hex("#fff6d8");

function capped(state: GameState, id: ProducerId): number {
  return Math.min(state.producers[id], producer(id).visualCap);
}

export class Mythic {
  private rabbits: Rabbit[] = [];
  private n: Partial<Record<ProducerId, number>> = {};
  private craneDip = [0, 0, 0];
  private rng = mulberry32(808);

  constructor(private L: PondLayout, private fx: Effects) {}

  setLayout(L: PondLayout): void {
    this.L = L;
    this.rabbits = [];
  }

  private lawnPoint(): Spot {
    const L = this.L;
    for (let i = 0; i < 60; i++) {
      const x = 10 + this.rng() * (L.W - 20);
      const y = L.cy + this.rng() * (L.H - L.cy - 6);
      if (L.depth(x, y) < -0.35) return { x, y };
    }
    return { x: 20, y: L.H - 10 };
  }

  sync(state: GameState): void {
    for (const id of ["rabbit", "kappa", "crane", "fox", "rainbow", "island", "dragon", "river"] as ProducerId[]) this.n[id] = capped(state, id);
    const want = this.n.rabbit ?? 0;
    while (this.rabbits.length > want) this.rabbits.pop();
    while (this.rabbits.length < want) {
      const p = this.lawnPoint();
      this.rabbits.push({ x: p.x, y: p.y, tx: p.x, ty: p.y, face: 1, hop: -1, rest: 1 + this.rng() * 4 });
    }
  }

  update(dt: number, time: number): void {
    for (const r of this.rabbits) {
      if (r.hop < 0) {
        r.rest -= dt;
        if (r.rest <= 0) {
          // Pick somewhere nearby on the lawn and hop toward it.
          const p = this.lawnPoint();
          r.tx = r.x + (p.x - r.x) * 0.25;
          r.ty = r.y + (p.y - r.y) * 0.25;
          r.face = r.tx >= r.x ? 1 : -1;
          r.hop = 0;
        }
      } else {
        r.hop += dt * 2.2;
        const step = Math.min(1, dt * 2.2);
        r.x += (r.tx - r.x) * step * 1.4;
        r.y += (r.ty - r.y) * step * 1.4;
        if (r.hop >= 1) {
          const close = Math.hypot(r.tx - r.x, r.ty - r.y) < 1.5;
          r.hop = close ? -1 : 0;
          if (close) r.rest = 1.5 + this.rng() * 5;
        }
      }
    }
    // Cranes dip their heads into the water now and then.
    for (let i = 0; i < this.craneDip.length; i++) {
      this.craneDip[i] -= dt;
      if (i < (this.n.crane ?? 0) && this.craneDip[i] < -4 - hash2(i, Math.floor(time / 7), 3) * 6) {
        this.craneDip[i] = 1.2;
        const s = this.craneSpot(i);
        this.fx.ripple(s.x + 5, s.y + 1, 4, 0.8, 10);
      }
    }
  }

  private kappaSpot(i: number): Spot {
    return this.L.edge([1.25, 3.8, 5.7][i], 3);
  }

  private craneSpot(i: number): Spot {
    return this.L.edge([2.55, 0.3, 4.55][i], -9);
  }

  private foxSpot(i: number): Spot {
    const g = this.L.gate;
    return { x: g.x + (i === 0 ? -17 : 17), y: g.y + 1 };
  }

  // Sky wonders, drawn over the sky before the night tint.
  drawSky(ctx: CanvasRenderingContext2D, time: number, light: Light): void {
    const L = this.L;
    if (this.n.rainbow && light.night < 0.6) {
      const a = 0.32 * (1 - light.night / 0.6);
      const r0 = Math.min(L.W * 0.42, L.horizon * 1.6);
      const cx = L.cx - L.W * 0.08;
      for (let b = 0; b < RAINBOW.length; b++) {
        const r = r0 - b;
        for (let x = -r; x <= r; x++) {
          const y = L.horizon - Math.sqrt(r * r - x * x) * 0.75;
          const fade = Math.min(1, (L.horizon - 14 - y) / 20);
          if (fade > 0) dot(ctx, cx + x, y, RAINBOW[b], a * fade);
        }
      }
    }
    if (this.n.island) {
      // A rock with a grassy top, a little pine and shrine, and a trickle of water.
      const x = Math.round(L.W * 0.2);
      const y = Math.round(L.horizon * 0.42 + Math.sin(time * 0.5) * 2);
      for (let k = 0; k < 10; k++) {
        const w = 13 - k * 1.3;
        if (w > 0) rect(ctx, x - w, y + k, w * 2, 1, k % 3 === 2 ? ROCK_DARK : ROCK);
      }
      ellipse(ctx, x, y, 14, 2.5, GRASS);
      ellipse(ctx, x - 3, y - 1, 7, 1.2, GRASS_LIGHT);
      rect(ctx, x - 7, y - 5, 1, 5, hex("#4e382b"));
      ellipse(ctx, x - 7, y - 6, 4, 2, hex("#2e5a38"));
      // A tiny red shrine.
      rect(ctx, x + 3, y - 4, 5, 3, hex("#c4382c"));
      rect(ctx, x + 2, y - 5, 7, 1, INK);
      for (let k = 0; k < 14; k++) {
        const fy = y + 2 + k + ((time * 20) % 3);
        dot(ctx, x + 11, fy, hex("#cfeef2"), 0.8 - k * 0.05);
      }
    }
  }

  // Under the surface: the pond dragon winding through the water.
  drawUnder(ctx: CanvasRenderingContext2D, time: number, clarity: number): void {
    if (!this.n.dragon) return;
    const L = this.L;
    const at = (t: number): Spot => ({
      x: L.cx + Math.cos(t * 0.13) * L.rx * 0.55 + Math.sin(t * 0.31) * L.rx * 0.12,
      y: L.cy + Math.sin(t * 0.26) * L.ry * 0.45,
    });
    const see = 0.7 + 0.3 * clarity;
    const segs = 26;
    for (let i = segs; i >= 0; i--) {
      const p = at(time - i * 0.5);
      const r = 4.2 - (i / segs) * 2.8;
      ellipse(ctx, p.x + 2, p.y + 3, r + 0.5, r * 0.5, hex("#0e2430"), 0.15 * clarity);
      ellipse(ctx, p.x, p.y, r, r * 0.75, i % 2 ? JADE : JADE_DARK, see);
      if (i % 3 === 0) dot(ctx, p.x, p.y - r * 0.6, GOLD, see);
    }
    const head = at(time);
    const next = at(time + 0.3);
    const ang = Math.atan2(next.y - head.y, next.x - head.x);
    const hx = head.x + Math.cos(ang) * 3;
    const hy = head.y + Math.sin(ang) * 2;
    ellipse(ctx, hx, hy, 4, 3, JADE, see);
    dot(ctx, hx + Math.cos(ang) * 2, hy + Math.sin(ang) * 1.5, JADE_LIGHT, see);
    dot(ctx, hx - Math.sin(ang), hy - 1, INK, see);
    // Whiskers and horns.
    line(ctx, hx, hy, hx - Math.cos(ang) * 6, hy + 4 + Math.sin(time * 3) * 1.5, GOLD, see * 0.8);
    line(ctx, hx, hy, hx - Math.cos(ang) * 6, hy - 4 + Math.cos(time * 3) * 1.5, GOLD, see * 0.8);
  }

  // Creatures on and around the bank, merged into the depth-sorted bank pass.
  bankItems(ctx: CanvasRenderingContext2D, time: number): BankItem[] {
    const items: BankItem[] = [];
    for (const r of this.rabbits) {
      const lift = r.hop >= 0 ? Math.sin(r.hop * Math.PI) * 3 : 0;
      items.push({ y: r.y, draw: () => drawRabbit(ctx, r.x, r.y, lift, r.face, time) });
    }
    for (let i = 0; i < (this.n.kappa ?? 0); i++) {
      const s = this.kappaSpot(i);
      items.push({ y: s.y, draw: () => drawKappa(ctx, s.x, s.y, s.x < this.L.cx ? 1 : -1, time + i * 3) });
    }
    for (let i = 0; i < (this.n.crane ?? 0); i++) {
      const s = this.craneSpot(i);
      items.push({ y: s.y, draw: () => drawCrane(ctx, s.x, s.y, i === 1 ? -1 : 1, Math.max(0, this.craneDip[i])) });
    }
    for (let i = 0; i < (this.n.fox ?? 0); i++) {
      const s = this.foxSpot(i);
      items.push({ y: s.y, draw: () => drawFox(ctx, s.x, s.y, i === 0 ? 1 : -1, time + i) });
    }
    return items;
  }

  // Light added after the night tint: fox-fire and the heavenly river.
  drawGlow(ctx: CanvasRenderingContext2D, time: number, light: Light): void {
    const L = this.L;
    for (let i = 0; i < (this.n.fox ?? 0); i++) {
      if (light.night < 0.2) break;
      const s = this.foxSpot(i);
      const x = s.x + Math.sin(time * 1.3 + i) * 3;
      const y = s.y - 14 + Math.sin(time * 2.1 + i) * 2;
      ellipse(ctx, x, y, 4, 4, FOXFIRE, 0.15 * light.night);
      ellipse(ctx, x, y, 1.6, 2, FOXFIRE, 0.6 * light.night);
      dot(ctx, x, y - 2, FOXFIRE, 0.4 * light.night);
    }
    if (this.n.river && light.night > 0.3) {
      const a = (light.night - 0.3) / 0.7;
      const band = (x: number) => L.horizon * 0.15 + (x / L.W) * L.horizon * 0.45;
      const count = Math.floor(L.W * 1.6);
      for (let i = 0; i < count; i++) {
        const x = hash2(i, 1, 61) * L.W;
        const spread = (hash2(i, 2, 61) + hash2(i, 3, 61) - 1) * 9;
        const tw = hash2(i, Math.floor(time * 1.5), 62) > 0.9 ? 0.4 : 1;
        dot(ctx, x, band(x) + spread, STAR, a * tw * (0.25 + 0.5 * (1 - Math.abs(spread) / 9)));
      }
      // Star koi swimming along the river.
      for (let k = 0; k < 4; k++) {
        const x = ((time * (6 + k) + k * L.W * 0.27) % (L.W + 20)) - 10;
        const y = band(x) + Math.sin(time + k * 2) * 3;
        dot(ctx, x, y, STAR, a);
        dot(ctx, x - 1, y, STAR, a * 0.8);
        dot(ctx, x - 2, y - 1, GOLD, a * 0.7);
        dot(ctx, x - 2, y + 1, GOLD, a * 0.7);
        ellipse(ctx, x, y, 3, 2, STAR, a * 0.12);
      }
    }
  }
}

// ---- Sprites --------------------------------------------------------------

export function drawRabbit(ctx: CanvasRenderingContext2D, x: number, y: number, lift: number, f: number, time: number): void {
  ellipse(ctx, x, y + 1, 3, 1, hex("#24381c"), 0.35);
  const by = y - 2 - lift;
  ellipse(ctx, x, by, 2.6, 1.8, WHITE_SHADE);
  ellipse(ctx, x, by - 0.4, 2.3, 1.4, WHITE);
  dot(ctx, x - f * 3, by, WHITE); // tail
  ellipse(ctx, x + f * 2, by - 2, 1.5, 1.3, WHITE);
  const twitch = Math.sin(time * 3 + x) > 0.95 ? 1 : 0;
  dot(ctx, x + f * 1, by - 4, WHITE);
  dot(ctx, x + f * 1, by - 5 + twitch, WHITE);
  dot(ctx, x + f * 2, by - 4, PINK);
  dot(ctx, x + f * 2, by - 5, WHITE);
  dot(ctx, x + f * 3, by - 2, INK);
}

export function drawKappa(ctx: CanvasRenderingContext2D, x: number, y: number, f: number, time: number): void {
  ellipse(ctx, x, y + 1, 4, 1.2, hex("#24381c"), 0.35);
  ellipse(ctx, x - f, y - 3, 3, 3, KAPPA_SHELL); // shell on the back
  ellipse(ctx, x, y - 2.5, 2.5, 2.8, KAPPA);
  dot(ctx, x + f * 2, y - 2, KAPPA_DARK); // arm
  ellipse(ctx, x + f * 0.5, y - 7, 2.6, 2.2, KAPPA);
  ellipse(ctx, x + f * 0.5, y - 8.6, 1.8, 0.8, KAPPA_DISH); // the water dish on its head
  dot(ctx, x + f * 2.5, y - 6.5, BEAK);
  dot(ctx, x + f * 3.5, y - 6.5, BEAK);
  const blink = Math.sin(time * 0.9) > 0.97;
  dot(ctx, x + f * 1.5, y - 7.5, blink ? KAPPA_DARK : INK);
  // Sometimes it holds a cucumber.
  if (Math.sin(time * 0.2) > 0.3) {
    line(ctx, x + f * 2, y - 3, x + f * 4, y - 5, hex("#4f8a3a"));
    dot(ctx, x + f * 4, y - 5, hex("#9fd06a"));
  }
}

export function drawCrane(ctx: CanvasRenderingContext2D, x: number, y: number, f: number, dip: number): void {
  // Legs in the water, with a ring where they enter it.
  ellipse(ctx, x, y + 1, 3, 0.8, hex("#ffffff"), 0.3);
  line(ctx, x - 1, y, x - 1, y - 5, INK);
  line(ctx, x + 1, y, x + 1, y - 5, INK);
  ellipse(ctx, x, y - 7, 4, 2.4, WHITE);
  ellipse(ctx, x - f * 1, y - 6.5, 3, 1.4, WHITE_SHADE);
  for (const k of [3, 4, 5]) dot(ctx, x - f * k, y - 7 + (k - 4), INK); // black tail plumes
  // Neck: up and proud, or dipped down to the water.
  const d = Math.sin(Math.min(1, dip) * Math.PI);
  const hx = x + f * (3 + d * 3);
  const hy = y - 15 + d * 13;
  line(ctx, x + f * 2, y - 8, hx, hy + 2, WHITE);
  line(ctx, x + f * 2, y - 8, x + f * (2 + d * 1.5), y - 11 + d * 3, INK);
  ellipse(ctx, hx, hy, 1.4, 1.1, WHITE);
  dot(ctx, hx, hy - 1, CRANE_RED);
  line(ctx, hx + f, hy, hx + f * 3, hy + 1, hex("#a89a7a"));
}

export function drawFox(ctx: CanvasRenderingContext2D, x: number, y: number, f: number, time: number): void {
  ellipse(ctx, x, y + 1, 4, 1.2, hex("#24381c"), 0.35);
  // A stone plinth, then the fox sitting upright on it.
  rect(ctx, x - 4, y - 2, 9, 2, hex("#8f8c84"));
  rect(ctx, x - 4, y - 2, 9, 1, hex("#b8b5ac"));
  ellipse(ctx, x, y - 5, 2.5, 3, WHITE);
  ellipse(ctx, x - f, y - 4.5, 1.8, 2, WHITE_SHADE);
  // Big tail curling up behind, with a red tip.
  const sway = Math.sin(time * 1.5) * 0.6;
  for (let k = 0; k < 5; k++) dot(ctx, x - f * (3 + Math.sin(k * 0.6) * 1.5) + sway, y - 3 - k, k > 3 ? FOX_RED : WHITE);
  ellipse(ctx, x + f * 0.5, y - 9, 1.8, 1.5, WHITE);
  dot(ctx, x - f * 0.5, y - 11, WHITE); // ears
  dot(ctx, x + f * 1.5, y - 11, WHITE);
  dot(ctx, x + f * 2.5, y - 8.5, WHITE); // snout
  dot(ctx, x + f * 1.2, y - 9.3, FOX_RED); // markings
  dot(ctx, x, y - 7, FOX_RED); // a red bib
  dot(ctx, x + 1, y - 7, FOX_RED);
}
