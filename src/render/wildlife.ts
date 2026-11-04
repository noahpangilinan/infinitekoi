import { hex, type RGB } from "./color";
import { dot, ring } from "./draw";
import { flowerSpots, gardenPlan } from "./garden";
import type { PondLayout, Spot } from "./layout";

// Small visitors to the garden: hummingbirds darting between the flowers and
// hovering to feed, butterflies fluttering over the beds (both by day), and
// the slow drip of the bamboo spout into the basin.

interface Hummingbird {
  x: number;
  y: number;
  target: number;
  state: "hover" | "fly";
  t: number;
  stay: number;
  face: number; // -1 left, 1 right
}

interface Butterfly {
  x: number;
  y: number;
  anchor: number;
  phase: number;
  speed: number;
  color: RGB;
}

const BIRD = hex("#3fae7a");
const BIRD_DARK = hex("#24704e");
const THROAT = hex("#d23a4a");
const BEAK = hex("#2a2523");
const WING = hex("#d8e4dc");
const WINGS: RGB[] = [hex("#fbf6e8"), hex("#f2d24a"), hex("#f0954a"), hex("#a8c8f0")];
const DROP = hex("#bfe6ef");

export class Wildlife {
  private birds: Hummingbird[] = [];
  private flies: Butterfly[] = [];
  private spots: Spot[] = [];
  private drip = 0;

  constructor(private L: PondLayout) {
    this.reset();
  }

  setLayout(L: PondLayout): void {
    this.L = L;
    this.reset();
  }

  private reset(): void {
    this.spots = flowerSpots(this.L);
    this.birds = [0, 4].map((i) => {
      const s = this.spots[i % this.spots.length];
      return { x: s.x, y: s.y, target: i, state: "hover" as const, t: 0, stay: 2 + i, face: 1 };
    });
    this.flies = [1, 5, 7].map((i, k) => {
      const s = this.spots[i % this.spots.length];
      return { x: s.x, y: s.y, anchor: i, phase: k * 2, speed: 0.6 + k * 0.15, color: WINGS[k % WINGS.length] };
    });
  }

  update(dt: number, nectar: boolean): void {
    this.drip += dt;
    if (!nectar) return;
    for (const b of this.birds) {
      const s = this.spots[b.target];
      b.t += dt;
      if (b.state === "hover") {
        b.x += (s.x + 3 * -b.face - b.x) * Math.min(1, dt * 4); // beak at the flower
        b.y += (s.y - 2 - b.y) * Math.min(1, dt * 4);
        if (b.t > b.stay) {
          let next = Math.floor(Math.random() * this.spots.length);
          if (next === b.target) next = (next + 1) % this.spots.length;
          b.target = next;
          b.state = "fly";
          b.t = 0;
        }
      } else {
        // Quick, slightly arcing dashes.
        const dx = s.x - b.x;
        const dy = s.y - 2 - b.y - Math.sin(b.t * 6) * 3;
        const d = Math.hypot(dx, dy);
        b.face = dx >= 0 ? 1 : -1;
        const step = Math.min(d, 90 * dt);
        b.x += (dx / (d || 1)) * step;
        b.y += (dy / (d || 1)) * step;
        if (d < 4) {
          b.state = "hover";
          b.t = 0;
          b.stay = 1.5 + Math.random() * 3;
        }
      }
    }
    for (const f of this.flies) {
      f.phase += dt * f.speed;
      const s = this.spots[f.anchor];
      const tx = s.x + Math.sin(f.phase * 1.3) * 14;
      const ty = s.y - 6 + Math.sin(f.phase * 2.1) * 5;
      f.x += (tx - f.x) * Math.min(1, dt * 1.5);
      f.y += (ty - f.y) * Math.min(1, dt * 1.5);
      if (Math.random() < dt * 0.05) f.anchor = Math.floor(Math.random() * this.spots.length);
    }
  }

  // The basin's drip, every few seconds: a falling drop, then a tiny ring.
  drawBasin(ctx: CanvasRenderingContext2D): void {
    const { basin, spout } = gardenPlan(this.L);
    const cycle = this.drip % 2.6;
    const fall = basin.y - 2 - spout.y;
    if (cycle < 0.35) dot(ctx, spout.x, spout.y + 1 + (cycle / 0.35) * fall, DROP);
    else if (cycle < 1.2) ring(ctx, spout.x, basin.y - 1.5, 1 + (cycle - 0.35) * 3, 0.5 + (cycle - 0.35), hex("#ffffff"), 0.6 * (1.2 - cycle));
  }

  // `day` fades them out as night falls.
  draw(ctx: CanvasRenderingContext2D, time: number, day: number): void {
    if (day <= 0.05) return;
    for (const f of this.flies) {
      const open = Math.sin(time * 14 + f.phase * 5) > 0;
      dot(ctx, f.x, f.y, BEAK, day);
      if (open) {
        dot(ctx, f.x - 1, f.y - 1, f.color, day);
        dot(ctx, f.x + 1, f.y - 1, f.color, day);
        dot(ctx, f.x - 1, f.y, f.color, day);
        dot(ctx, f.x + 1, f.y, f.color, day);
      } else {
        dot(ctx, f.x, f.y - 1, f.color, day);
      }
    }
    for (const b of this.birds) {
      const bob = b.state === "hover" ? Math.round(Math.sin(time * 5 + b.target)) : 0;
      const x = Math.round(b.x);
      const y = Math.round(b.y) + bob;
      const f = b.face;
      // Wings: a pale blur above the back, flickering.
      const up = Math.floor(time * 30) % 2 === 0;
      dot(ctx, x, y - 1, WING, day * 0.7);
      dot(ctx, x - f, y - (up ? 2 : 1), WING, day * 0.5);
      // Body, tail, head, red throat and the long beak.
      dot(ctx, x, y, BIRD, day);
      dot(ctx, x - f, y + 1, BIRD_DARK, day);
      dot(ctx, x - f * 2, y + 1, BIRD_DARK, day);
      dot(ctx, x + f, y - 1, BIRD, day);
      dot(ctx, x + f, y, THROAT, day);
      dot(ctx, x + f * 2, y - 1, BEAK, day);
      dot(ctx, x + f * 3, y - 1, BEAK, day);
    }
  }
}
