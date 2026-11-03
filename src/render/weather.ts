import { hex, type RGB } from "./color";
import { dot, ellipse, line } from "./draw";
import type { PondLayout } from "./layout";
import type { Effects } from "./particles";
import { hash2 } from "./rng";

// Rain showers now and then, and petals or leaves drifting down onto the water.

const RAIN = hex("#c9dde6");
const PETALS: RGB[] = [hex("#f6c3d3"), hex("#f0a9c0"), hex("#fbe1ea")];
const LEAVES: RGB[] = [hex("#d8642a"), hex("#c93a2a"), hex("#e3a03a")];

// Showers follow the real clock: a 90-second window is rainy about 1 time in 7.
export function raining(nowMs = Date.now()): number {
  const t = nowMs / 1000;
  const window = Math.floor(t / 90);
  if (hash2(window, 0, 77) > 0.14) return 0;
  const p = (t % 90) / 90;
  return Math.min(1, Math.min(p, 1 - p) * 6); // fade in and out
}

interface Drift {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  color: RGB;
  floating: number; // seconds left floating once it lands on the water
}

export class Weather {
  private drifts: Drift[] = [];

  constructor(private L: PondLayout, private fx: Effects) {}

  setLayout(L: PondLayout): void {
    this.L = L;
    this.drifts = [];
  }

  // `petals` 0 none, 1 sakura petals, 2 autumn leaves.
  update(dt: number, rain: number, petals: number): void {
    const L = this.L;
    if (rain > 0) {
      for (let i = 0; i < rain * 14 * dt * 10; i++) {
        const x = L.cx + (Math.random() * 2 - 1) * L.rx;
        const y = L.cy + (Math.random() * 2 - 1) * L.ry;
        if (L.depth(x, y) > 0.05 && Math.random() < 0.25) this.fx.ripple(x, y, 3 + Math.random() * 3, 0.7, 9);
      }
    }
    if (petals && this.drifts.length < 40 && Math.random() < dt * 2.5) {
      const colors = petals === 2 ? LEAVES : PETALS;
      this.drifts.push({
        x: Math.random() * L.W * 1.2 - L.W * 0.2,
        y: -4,
        vx: 6 + Math.random() * 6,
        vy: 8 + Math.random() * 5,
        spin: Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        floating: 0,
      });
    }
    for (const d of this.drifts) {
      if (d.floating > 0) {
        d.floating -= dt;
        d.x += 1.5 * dt;
        continue;
      }
      d.spin += dt * 3;
      d.x += (d.vx + Math.sin(d.spin) * 6) * dt;
      d.y += d.vy * dt;
      if (L.depth(d.x, d.y) > 0.08 && d.y > L.cy - L.ry * 0.6 && Math.random() < dt * 1.5) {
        d.floating = 6 + Math.random() * 6;
        this.fx.ripple(d.x, d.y, 3, 0.6, 6);
      }
    }
    this.drifts = this.drifts.filter((d) => d.y < L.H + 4 && d.x < L.W + 4 && !(d.floating < 0));
  }

  // Petals resting on the water, drawn with the surface.
  drawFloating(ctx: CanvasRenderingContext2D): void {
    for (const d of this.drifts) if (d.floating > 0) dot(ctx, d.x, d.y, d.color, Math.min(1, d.floating));
  }

  // Falling petals and rain, drawn over everything.
  drawAir(ctx: CanvasRenderingContext2D, time: number, rain: number): void {
    for (const d of this.drifts) {
      if (d.floating > 0) continue;
      dot(ctx, d.x, d.y, d.color);
      if (Math.sin(d.spin) > 0) dot(ctx, d.x + 1, d.y, d.color, 0.7);
    }
    if (rain <= 0) return;
    const L = this.L;
    ctx.globalAlpha = 1;
    const count = Math.floor(L.W * 0.35 * rain);
    for (let i = 0; i < count; i++) {
      const speed = 160 + hash2(i, 1, 3) * 60;
      const x = (hash2(i, 2, 3) * (L.W + 60) + time * 40) % (L.W + 60) - 30;
      const y = (hash2(i, 3, 3) * L.H + time * speed) % L.H;
      line(ctx, x, y, x - 2, y - 5, RAIN, 0.35 * rain);
    }
  }

  // A soft grey veil over the scene while it rains.
  drawGloom(ctx: CanvasRenderingContext2D, rain: number): void {
    if (rain <= 0) return;
    ctx.fillStyle = `rgba(70, 80, 92, ${0.22 * rain})`;
    ctx.fillRect(0, 0, this.L.W, this.L.H);
  }
}

// ---- The Dragon Gate scene ----------------------------------------------

const DRAGON = hex("#c4382c");
const DRAGON_DARK = hex("#8e2219");
const DRAGON_BELLY = hex("#f2c14e");
const WHISKER = hex("#fff1b0");

// A koi swims to the waterfall and climbs it; a flash; a dragon rises and
// flies off across the sky. `t` runs 0..1 over the whole scene.
export function drawAscension(ctx: CanvasRenderingContext2D, L: PondLayout, t: number): void {
  const fall = L.waterfall;
  if (t < 0.45) {
    // The climbing koi: a golden streak working its way up the falls.
    const p = t / 0.45;
    const y = fall.y - p * 26;
    const x = fall.x + Math.sin(p * 20) * 1.5;
    ellipse(ctx, x, y, 1.6, 3.2, hex("#ffcf3a"));
    dot(ctx, x, y - 3, hex("#fff5c0"));
    for (let i = 0; i < 4; i++) dot(ctx, x + (Math.random() - 0.5) * 8, y + Math.random() * 6, hex("#ffffff"));
  } else if (t < 0.55) {
    // Flash.
    const a = 1 - Math.abs(t - 0.5) / 0.05;
    ctx.fillStyle = `rgba(255, 245, 210, ${Math.max(0, a) * 0.9})`;
    ctx.fillRect(0, 0, L.W, L.H);
  }
  if (t >= 0.5) {
    // The dragon: a chain of segments following a winding path upward.
    const p = (t - 0.5) / 0.5;
    const headX = fall.x + p * L.W * 0.9 - p * p * L.W * 0.2;
    const headY = fall.y - 30 - p * (fall.y - 10) * 1.1;
    const segs = 26;
    for (let i = segs - 1; i >= 0; i--) {
      const back = i * 4.2;
      const x = headX - back * 0.9;
      const y = headY + back * 0.35 + Math.sin(p * 14 - i * 0.55) * 5;
      const r = 3.2 - (i / segs) * 2.2;
      ellipse(ctx, x, y + 1, r, r, DRAGON_DARK);
      ellipse(ctx, x, y, r, r * 0.9, DRAGON);
      if (i % 2 === 0) dot(ctx, x, y + r * 0.5, DRAGON_BELLY);
      if (i % 6 === 3) {
        dot(ctx, x - 1, y - r - 1, DRAGON_BELLY); // spines
      }
    }
    // Head: snout, horns, whiskers trailing.
    ellipse(ctx, headX + 3, headY, 4, 3, DRAGON);
    dot(ctx, headX + 4, headY - 1, hex("#111111"));
    line(ctx, headX + 1, headY - 3, headX - 2, headY - 7, DRAGON_BELLY);
    line(ctx, headX + 3, headY - 3, headX + 1, headY - 7, DRAGON_BELLY);
    line(ctx, headX + 6, headY + 1, headX + 1, headY + 6 + Math.sin(p * 20) * 2, WHISKER);
    line(ctx, headX + 6, headY, headX - 1, headY + 3 + Math.cos(p * 20) * 2, WHISKER);
  }
}
