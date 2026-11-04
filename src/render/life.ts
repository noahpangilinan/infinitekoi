import { producer, type ProducerId } from "../game/data/producers";
import type { GameState } from "../game/state";
import { hex } from "./color";
import type { Light } from "./daynight";
import { dot, ellipse } from "./draw";
import type { PondLayout } from "./layout";
import type { Effects } from "./particles";
import { hash2, mulberry32 } from "./rng";
import { VARIETIES } from "../game/data/varieties";
import { drawFrog, drawFrogLeap, drawTadpole, drawTurtleBasking, drawTurtleSwimming } from "./sprites/critters";
import { goldenLook, HEADINGS, KOI_SIZE, koiLook, KoiSprites, FRAMES, type KoiLook } from "./sprites/koi";
import { drawLily, drawReeds } from "./sprites/plants";
import { drawBridge, drawGate, drawLantern, drawLanternGlow, drawWaterfall } from "./sprites/structures";

// Everything alive in and around the pond, kept in step with what you own.

export interface Pointer {
  x: number;
  y: number;
  idle: number; // seconds without moving
  over: boolean; // over the canvas
}

interface Swimmer {
  x: number;
  y: number;
  heading: number;
  speed: number;
  turn: number;
  tx: number;
  ty: number;
  burst: number; // seconds left in the current tail-beat burst, <0 gliding
  frameClock: number;
  feedX: number;
  feedY: number;
  feedLeft: number;
  nibble: number;
}

interface Fish extends Swimmer {
  key: string;
  look: KoiLook;
  golden: boolean;
}

interface Frog {
  spot: number;
  right: boolean;
  state: "sit" | "out" | "away" | "back";
  t: number;
  next: number; // seconds until it next does something
  croak: number;
  blink: number;
  wx: number; // where it lands in the water
  wy: number;
}

interface Lily {
  x: number;
  y: number;
  r: number;
  notch: number;
  bloom: number;
}

const SHADOW = hex("#0e2430");
const SPARKLE = hex("#fff5c0");
const FIREFLY = hex("#e9ff8a");
const WISP = hex("#a8ecff");
const WISP_CORE = hex("#f2fdff");

interface SkyKoi {
  x: number;
  y: number;
  dir: number; // 1 swimming right, -1 left
  speed: number;
  phase: number;
  key: string;
  look: KoiLook;
}
const ROCK = hex("#7d7a70");
const ROCK_LIGHT = hex("#a6a296");

function capped(state: GameState, id: ProducerId): number {
  return Math.min(state.producers[id], producer(id).visualCap);
}

export class PondLife {
  private sprites = new KoiSprites();
  private koi: Fish[] = [];
  private golden: Fish | null = null;
  private tadpoles: Swimmer[] = [];
  private turtles: Swimmer[] = [];
  private frogs: Frog[] = [];
  private lilies: Lily[] = [];
  private skyKoi: SkyKoi[] = [];
  private counts: Partial<Record<ProducerId, number>> = {};
  private rng = mulberry32(99);

  constructor(private L: PondLayout, private fx: Effects) {}

  setLayout(L: PondLayout): void {
    this.L = L;
    this.koi = [];
    this.tadpoles = [];
    this.turtles = [];
    this.frogs = [];
    this.lilies = [];
    this.skyKoi = [];
    this.golden = null;
  }

  // A random point well inside the water.
  private waterPoint(minDepth = 0.25, maxDepth = 1): [number, number] {
    const L = this.L;
    for (let i = 0; i < 40; i++) {
      const x = L.cx + (this.rng() * 2 - 1) * L.rx;
      const y = L.cy + (this.rng() * 2 - 1) * L.ry;
      const d = L.depth(x, y);
      if (d >= minDepth && d <= maxDepth) return [x, y];
    }
    return [L.cx, L.cy];
  }

  private swimmer(minDepth = 0.25, maxDepth = 1): Swimmer {
    const [x, y] = this.waterPoint(minDepth, maxDepth);
    const [tx, ty] = this.waterPoint(minDepth, maxDepth);
    return { x, y, heading: this.rng() * Math.PI * 2, speed: 0, turn: 0, tx, ty, burst: 0, frameClock: this.rng() * FRAMES, feedX: 0, feedY: 0, feedLeft: 0, nibble: 0 };
  }

  sync(state: GameState): void {
    const want = (id: ProducerId) => capped(state, id);
    // Koi follow the individual koi remembered in the save.
    const kois = want("koi");
    while (this.koi.length > kois) this.koi.pop();
    for (let i = this.koi.length; i < kois; i++) {
      const rec = state.koi[i] ?? { variety: "kohaku", seed: i * 7919 };
      this.koi.push({ ...this.swimmer(), key: `${rec.variety}-${rec.seed}`, look: koiLook(rec.variety, rec.seed), golden: false });
    }
    const tad = want("tadpole");
    while (this.tadpoles.length > tad) this.tadpoles.pop();
    while (this.tadpoles.length < tad) this.tadpoles.push(this.swimmer(0.04, 0.3));
    const swimTurtles = Math.max(0, want("turtle") - 1);
    while (this.turtles.length > swimTurtles) this.turtles.pop();
    while (this.turtles.length < swimTurtles) this.turtles.push(this.swimmer(0.2, 0.8));
    const frogs = Math.min(want("frog"), this.L.frogSpots.length);
    while (this.frogs.length > frogs) this.frogs.pop();
    for (let i = this.frogs.length; i < frogs; i++) {
      this.frogs.push({ spot: i, right: this.L.frogSpots[i].x < this.L.cx, state: "sit", t: 0, next: 4 + this.rng() * 10, croak: 0, blink: 0, wx: 0, wy: 0 });
    }
    const lilies = want("lily");
    if (this.lilies.length !== lilies) this.placeLilies(lilies);
    for (const id of ["reeds", "lantern", "waterfall", "bridge", "gate"] as ProducerId[]) this.counts[id] = want(id);
    this.counts.turtle = want("turtle");
    this.counts.spirit = want("spirit");
    const sky = want("skykoi");
    while (this.skyKoi.length > sky) this.skyKoi.pop();
    for (let i = this.skyKoi.length; i < sky; i++) {
      const v = VARIETIES[Math.floor(hash2(i, 1, 41) * VARIETIES.length)].id;
      const seed = Math.floor(hash2(i, 2, 41) * 2 ** 31);
      this.skyKoi.push({
        x: this.rng() * this.L.W,
        y: 0,
        dir: i % 2 ? -1 : 1,
        speed: 5 + this.rng() * 4,
        phase: this.rng() * 6,
        key: `sky-${v}-${seed}`,
        look: koiLook(v, seed),
      });
    }

    if (state.golden.timeLeft > 0 && !this.golden) {
      this.golden = { ...this.swimmer(0.3), key: "golden", look: goldenLook(), golden: true };
      for (let i = 0; i < 3; i++) this.fx.ripple(this.golden.x, this.golden.y, 6 + i * 4, 1);
    } else if (state.golden.timeLeft <= 0) {
      this.golden = null;
    }
  }

  // Pads sit at stable seeded spots, so buying one more doesn't shuffle them.
  private placeLilies(count: number): void {
    const L = this.L;
    const rng = mulberry32(1234);
    const spots: Lily[] = [];
    for (let tries = 0; spots.length < count && tries < 2000; tries++) {
      const x = L.cx + (rng() * 2 - 1) * L.rx;
      const y = L.cy + (rng() * 2 - 1) * L.ry;
      const d = L.depth(x, y);
      const r = 3 + rng() * 2.5;
      const bloomRoll = rng();
      const notch = rng() * Math.PI * 2;
      if (d < 0.12 || d > 0.75) continue;
      if (spots.some((s) => Math.hypot(s.x - x, (s.y - y) * 2) < s.r + r + 1.5)) continue;
      spots.push({ x, y, r, notch, bloom: bloomRoll < 0.12 ? 2 : bloomRoll < 0.45 ? 1 : 0 });
    }
    this.lilies = spots;
  }

  // Koi near a click rush over as if fed.
  feed(x: number, y: number): void {
    for (const f of this.koi) {
      if (Math.hypot(f.x - x, (f.y - y) * 1.6) < 90) {
        f.feedX = x + (this.rng() - 0.5) * 6;
        f.feedY = y + (this.rng() - 0.5) * 3;
        f.feedLeft = 2.5;
      }
    }
  }

  hitGolden(x: number, y: number): boolean {
    return !!this.golden && Math.hypot(this.golden.x - x, this.golden.y - y) < 10;
  }

  update(dt: number, pointer: Pointer, goldenLeft: number): void {
    const L = this.L;
    const resting = pointer.over && pointer.idle > 1.2 && L.depth(pointer.x, pointer.y) > 0.1;
    for (const f of this.koi) {
      if (resting && f.feedLeft <= 0 && Math.hypot(f.x - pointer.x, f.y - pointer.y) < 70 && this.rng() < dt * 0.3) {
        f.feedX = pointer.x;
        f.feedY = pointer.y;
        f.feedLeft = 3;
      }
      this.swim(f, dt, 9, 0.25);
    }
    if (this.golden) {
      this.swim(this.golden, dt, 16, 0.3);
      if (goldenLeft < 1.5 && this.rng() < dt * 6) this.fx.ripple(this.golden.x, this.golden.y, 5, 0.6);
    }
    for (const t of this.tadpoles) {
      // Little darts in the shallows.
      if (this.rng() < dt * 1.5) {
        const [tx, ty] = this.waterPoint(0.04, 0.3);
        t.tx = t.x + (tx - t.x) * 0.3;
        t.ty = t.y + (ty - t.y) * 0.3;
        t.burst = 0.4;
      }
      this.swim(t, dt, 7, 0.04, 0.3);
    }
    for (const t of this.turtles) this.swim(t, dt, 4, 0.2);
    for (const k of this.skyKoi) {
      k.x += k.dir * k.speed * dt;
      k.phase += dt;
      if (k.x > L.W + KOI_SIZE) k.x = -KOI_SIZE;
      if (k.x < -KOI_SIZE) k.x = L.W + KOI_SIZE;
    }
    for (const fr of this.frogs) this.frog(fr, dt);
  }

  // Shared swimming: keep a heading, turn gently, burst and glide, stay
  // inside the water, and go for food when there is some.
  private swim(f: Swimmer, dt: number, cruise: number, minDepth: number, maxDepth = 1): void {
    const L = this.L;
    f.feedLeft -= dt;
    const feeding = f.feedLeft > 0;
    let tx = feeding ? f.feedX : f.tx;
    let ty = feeding ? f.feedY : f.ty;
    const dist = Math.hypot(tx - f.x, (ty - f.y) * 1.6);
    if (!feeding && dist < 6) {
      [f.tx, f.ty] = this.waterPoint(minDepth, maxDepth);
      tx = f.tx;
      ty = f.ty;
    }
    if (feeding && dist < 5) {
      // Nibbling: small rings where the mouth meets the food.
      f.nibble -= dt;
      if (f.nibble <= 0) {
        this.fx.ripple(tx, ty, 4, 0.8, 10);
        f.nibble = 0.35 + this.rng() * 0.4;
      }
    }
    f.burst -= dt;
    if (f.burst < -1.2 - this.rng() * 2) f.burst = 0.5 + this.rng() * 0.6;
    const thrust = feeding || f.burst > 0;
    const top = cruise * (feeding ? 2.4 : 1.4);
    f.speed += ((thrust ? top : cruise * 0.35) - f.speed) * Math.min(1, dt * (thrust ? 3 : 0.8));
    if (feeding && dist < 8) f.speed = Math.min(f.speed, dist * 2);

    // Steer toward the target; swing away from the shore if heading for it.
    let want = Math.atan2((ty - f.y) * 1.6, tx - f.x);
    const ahead = 8;
    const ax = f.x + Math.cos(f.heading) * ahead;
    const ay = f.y + (Math.sin(f.heading) * ahead) / 1.6;
    if (L.depth(ax, ay) < minDepth * 0.6) want = Math.atan2((L.cy - f.y) * 1.6, L.cx - f.x);
    want += Math.sin(f.frameClock * 0.4) * 0.25;
    let diff = want - f.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxTurn = feeding ? 3.5 : 1.6;
    f.turn += (Math.max(-maxTurn, Math.min(maxTurn, diff * 2.5)) - f.turn) * Math.min(1, dt * 4);
    f.heading += f.turn * dt;
    const nx = f.x + Math.cos(f.heading) * f.speed * dt;
    const ny = f.y + (Math.sin(f.heading) * f.speed * dt) / 1.6; // the pond is seen at an angle
    if (L.depth(nx, ny) > minDepth * 0.3) {
      f.x = nx;
      f.y = ny;
    } else {
      f.heading += Math.PI * dt * 2;
    }
    f.frameClock += dt * (thrust ? 10 : 4);
  }

  private frog(fr: Frog, dt: number): void {
    const spot = this.L.frogSpots[fr.spot];
    fr.t += dt;
    fr.blink -= dt;
    fr.croak -= dt;
    if (fr.blink < -3 - this.rng() * 3) fr.blink = 0.15;
    if (fr.state === "sit") {
      fr.next -= dt;
      if (fr.croak < -4 && this.rng() < dt * 0.15) fr.croak = 0.7;
      if (fr.next <= 0) {
        // Into the water.
        const inward = Math.atan2(this.L.cy - spot.y, this.L.cx - spot.x);
        fr.wx = spot.x + Math.cos(inward) * 14;
        fr.wy = spot.y + Math.sin(inward) * 7;
        fr.right = fr.wx > spot.x;
        fr.state = "out";
        fr.t = 0;
      }
    } else if (fr.state === "out" && fr.t > 0.55) {
      this.fx.splash(fr.wx, fr.wy, 0.8);
      fr.state = "away";
      fr.t = 0;
    } else if (fr.state === "away" && fr.t > 2 + this.rng() * 3) {
      fr.state = "back";
      fr.right = spot.x > fr.wx;
      fr.t = 0;
      this.fx.ripple(fr.wx, fr.wy, 6, 0.8);
    } else if (fr.state === "back" && fr.t > 0.55) {
      fr.state = "sit";
      fr.next = 8 + this.rng() * 18;
      fr.t = 0;
    }
  }

  private frameFor(f: Fish): HTMLCanvasElement {
    let h = Math.round((f.heading / (Math.PI * 2)) * HEADINGS) % HEADINGS;
    if (h < 0) h += HEADINGS;
    const frame = Math.floor(f.frameClock) % FRAMES;
    const sway = f.speed > 10 ? 2 : 1;
    return this.sprites.get(f.key, f.look, h, frame, sway);
  }

  // Under the surface: koi, tadpoles, swimming turtles. Murky water hides them.
  drawUnder(ctx: CanvasRenderingContext2D, clarity: number, time: number): void {
    const see = 0.3 + 0.7 * clarity;
    for (const t of this.tadpoles) drawTadpole(ctx, t.x, t.y, t.heading, t.frameClock * 3, 0.5 + 0.4 * clarity);
    for (const t of this.turtles) {
      if (clarity > 0.3) ellipse(ctx, t.x + 2, t.y + 2, 3, 1.6, SHADOW, 0.2 * clarity);
      drawTurtleSwimming(ctx, t.x, t.y, t.heading, t.frameClock, see);
    }
    const fish = this.golden ? [...this.koi, this.golden] : this.koi;
    for (const f of fish) {
      if (clarity > 0.3) ellipse(ctx, f.x + 2, f.y + 3, 5, 2, SHADOW, 0.22 * clarity);
    }
    const half = KOI_SIZE / 2;
    for (const f of fish) {
      ctx.globalAlpha = f.golden ? 1 : see;
      ctx.drawImage(this.frameFor(f), Math.round(f.x - half), Math.round(f.y - half));
    }
    ctx.globalAlpha = 1;
    if (this.golden) {
      for (let i = 0; i < 5; i++) {
        const a = hash2(i, Math.floor(time * 6), 2) * Math.PI * 2;
        const r = 4 + hash2(i, Math.floor(time * 6), 3) * 7;
        dot(ctx, this.golden.x + Math.cos(a) * r, this.golden.y + Math.sin(a) * r * 0.6, SPARKLE);
      }
    }
  }

  // On the surface: lily pads (and a rock for turtles to bask on).
  drawSurface(ctx: CanvasRenderingContext2D, time: number): void {
    for (const [i, l] of this.lilies.entries()) {
      const drift = Math.sin(time * 0.25 + i) * 0.5;
      drawLily(ctx, l.x + drift, l.y, l.r, l.notch, l.bloom);
    }
    if ((this.counts.turtle ?? 0) > 0) {
      const r = this.L.turtleRock;
      ellipse(ctx, r.x, r.y + 1, 8, 3.4, hex("#3c4a44"), 0.6);
      ellipse(ctx, r.x, r.y, 7.5, 3.2, ROCK);
      ellipse(ctx, r.x - 2, r.y - 1, 3.5, 1.4, ROCK_LIGHT);
    }
  }

  // On and around the bank, back to front.
  drawBank(ctx: CanvasRenderingContext2D, time: number, light: Light, extra: { y: number; draw: () => void }[] = []): void {
    const L = this.L;
    const items: { y: number; draw: () => void }[] = [...extra];
    if ((this.counts.gate ?? 0) > 0) items.push({ y: L.gate.y, draw: () => drawGate(ctx, L.gate.x, L.gate.y) });
    if ((this.counts.waterfall ?? 0) > 0) items.push({ y: L.waterfall.y - 30, draw: () => drawWaterfall(ctx, L.waterfall.x, L.waterfall.y, time) });
    for (let i = 0; i < (this.counts.reeds ?? 0); i++) {
      const s = L.reedSpots[i];
      items.push({ y: s.y, draw: () => drawReeds(ctx, s.x, s.y, 300 + i, time, i % 3) });
    }
    for (let i = 0; i < (this.counts.lantern ?? 0); i++) {
      const s = L.lanternSpots[i];
      items.push({ y: s.y, draw: () => drawLantern(ctx, s.x, s.y, light.night) });
    }
    if ((this.counts.turtle ?? 0) > 0) {
      const r = L.turtleRock;
      items.push({ y: r.y, draw: () => drawTurtleBasking(ctx, r.x, r.y - 1, true, Math.sin(time * 0.4) > 0.6 ? 1 : 0) });
    }
    for (const fr of this.frogs) {
      const s = L.frogSpots[fr.spot];
      items.push({
        y: s.y,
        draw: () => {
          if (fr.state === "sit") drawFrog(ctx, s.x, s.y, fr.right, fr.croak > 0 ? 1 : 0, fr.blink > 0);
          else if (fr.state === "out" || fr.state === "back") {
            const p = Math.min(1, fr.t / 0.55);
            const [ax, ay, bx, by] = fr.state === "out" ? [s.x, s.y, fr.wx, fr.wy] : [fr.wx, fr.wy, s.x, s.y];
            drawFrogLeap(ctx, ax + (bx - ax) * p, ay + (by - ay) * p - Math.sin(p * Math.PI) * 9, fr.right);
          }
        },
      });
    }
    items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());
    if ((this.counts.bridge ?? 0) > 0) drawBridge(ctx, L.bridge.x1, L.bridge.x2, L.bridge.y);
  }

  // Koi swimming through the sky, drawn over the clouds and behind the trees'
  // tops. They bob as if riding waves of air and leave a faint wake.
  drawSky(ctx: CanvasRenderingContext2D, time: number): void {
    const L = this.L;
    for (const [i, k] of this.skyKoi.entries()) {
      const band = L.horizon * (0.25 + (i % 3) * 0.2);
      const y = band + Math.sin(k.phase * 0.8) * 4;
      const climb = Math.cos(k.phase * 0.8) * 0.25; // nose up as it rises
      const heading = (k.dir > 0 ? 0 : Math.PI) - climb * k.dir;
      let h = Math.round((heading / (Math.PI * 2)) * HEADINGS) % HEADINGS;
      if (h < 0) h += HEADINGS;
      for (let w = 1; w <= 4; w++) {
        dot(ctx, k.x - k.dir * (6 + w * 3), y + Math.sin(k.phase * 0.8 - w * 0.4) * 2, hex("#ffffff"), 0.45 - w * 0.09);
      }
      ctx.globalAlpha = 0.92;
      ctx.drawImage(this.sprites.get(k.key, k.look, h, Math.floor(time * 4 + i) % FRAMES, 1), Math.round(k.x - KOI_SIZE / 2), Math.round(y - KOI_SIZE / 2));
      ctx.globalAlpha = 1;
    }
  }

  // Added light, drawn after the night tint: lantern glow and fireflies.
  drawGlow(ctx: CanvasRenderingContext2D, time: number, light: Light, fireflies: boolean): void {
    const L = this.L;
    for (let i = 0; i < (this.counts.lantern ?? 0); i++) {
      const s = L.lanternSpots[i];
      drawLanternGlow(ctx, s.x, s.y, light.night, Math.sin(time * 9 + i * 3));
    }
    // Spirit lights: soft wisps drifting over the water, brighter at night.
    const spirits = this.counts.spirit ?? 0;
    const glow = 0.45 + 0.55 * light.night;
    for (let i = 0; i < spirits; i++) {
      const t = time * (0.12 + hash2(i, 1, 51) * 0.08) + i * 2.1;
      const x = L.cx + Math.cos(t) * L.rx * (0.3 + hash2(i, 2, 51) * 0.45);
      const water = L.cy + Math.sin(t * 1.3) * L.ry * 0.5;
      const y = water - 7 - Math.sin(time * 1.7 + i) * 2;
      ellipse(ctx, x, water + 1, 3, 1, WISP, 0.12 * glow); // reflection
      for (let k = 1; k <= 3; k++) dot(ctx, x - Math.cos(t) * k * 1.5, y + k * 0.8, WISP, (0.35 - k * 0.09) * glow);
      ellipse(ctx, x, y, 5, 4, WISP, 0.1 * glow);
      ellipse(ctx, x, y, 2.5, 2, WISP, 0.35 * glow);
      dot(ctx, x, y, WISP_CORE, glow);
    }
    if (fireflies && light.night > 0.5) {
      const a = (light.night - 0.5) * 2;
      for (let i = 0; i < 16; i++) {
        const theta = hash2(i, 1, 8) * Math.PI * 2;
        const base = L.edge(theta, 6 + hash2(i, 2, 8) * 16);
        const x = base.x + Math.sin(time * 0.7 + i) * 6;
        const y = base.y - 6 + Math.cos(time * 0.9 + i * 2) * 4;
        const blink = Math.sin(time * 2.2 + i * 1.7);
        if (blink < 0) continue;
        dot(ctx, x, y, FIREFLY, a * blink);
        ellipse(ctx, x, y, 2, 1.5, FIREFLY, a * blink * 0.15);
      }
    }
  }
}
