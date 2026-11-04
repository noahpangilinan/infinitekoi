import { rps } from "../game/economy";
import { upgrade } from "../game/data/upgrades";
import type { GameState } from "../game/state";
import { css, hex, mix } from "./color";
import { currentPhase, lightAt, type Light } from "./daynight";
import { makeLayout, type PondLayout } from "./layout";
import { PondLife, type Pointer } from "./life";
import { Effects } from "./particles";
import { fitViewport, sizeCanvas, type Viewport } from "./pixels";
import { ellipse } from "./draw";
import { hash2 } from "./rng";
import { drawBamboo, drawDeck, festivalLanterns } from "./garden";
import { drawBackground, drawFallenStones, drawForeground, drawRim, type Look } from "./scene";
import { drawAlgae, drawTrash } from "./shabby";
import { Water } from "./water";
import { drawAscension, raining, Weather } from "./weather";
import { Wildlife } from "./wildlife";

const ASCENSION_SECONDS = 5;

// Puts the frame together, back to front: garden, water, things under the
// surface, things on it, the stone rim, things on the bank, then light.

export class Renderer {
  vp!: Viewport;
  layout!: PondLayout;
  private ctx!: CanvasRenderingContext2D;
  private water!: Water;
  private background = document.createElement("canvas");
  private rim = document.createElement("canvas");
  private front = document.createElement("canvas");
  private lookKey = "";
  private clarity = -1;
  private ambient = 0;
  readonly fx = new Effects();
  life!: PondLife;
  private weather!: Weather;
  private wildlife!: Wildlife;
  private ascension: { t: number; onFlash: () => void; flashed: boolean } | null = null;
  pointer: Pointer = { x: -100, y: -100, idle: 0, over: false };
  phaseOverride: number | null = null;
  rainOverride: number | null = null; // debug
  ascensionFreeze: number | null = null; // debug: draw the Dragon Gate scene at this point

  constructor(private canvas: HTMLCanvasElement) {}

  resize(width: number, height: number): void {
    this.vp = fitViewport(width, height);
    this.ctx = sizeCanvas(this.canvas, this.vp);
    this.layout = makeLayout(this.vp.W, this.vp.H);
    this.water = new Water(this.layout);
    if (this.life) {
      this.life.setLayout(this.layout);
      this.weather.setLayout(this.layout);
      this.wildlife.setLayout(this.layout);
    } else {
      this.life = new PondLife(this.layout, this.fx);
      this.weather = new Weather(this.layout, this.fx);
      this.wildlife = new Wildlife(this.layout);
    }
    this.lookKey = "";
  }

  light(theme = "classic"): Light {
    if (theme === "moonlit") return lightAt(0.82); // the moonlit pond is always night
    return lightAt(this.phaseOverride ?? currentPhase());
  }

  // Play the Dragon Gate scene; `onFlash` runs at the flash, when the pond resets.
  ascend(onFlash: () => void): void {
    this.ascension = { t: 0, onFlash, flashed: false };
  }

  get ascending(): boolean {
    return this.ascension !== null;
  }

  private ensureCaches(look: Look): void {
    const key = `${this.vp.W}x${this.vp.H}:${[...look.done].sort().join(",")}:${look.theme}`;
    if (key === this.lookKey) return;
    this.lookKey = key;
    for (const [canvas, draw] of [[this.background, drawBackground], [this.rim, drawRim], [this.front, drawForeground]] as const) {
      canvas.width = this.vp.W;
      canvas.height = this.vp.H;
      const c = canvas.getContext("2d")!;
      c.clearRect(0, 0, canvas.width, canvas.height);
      draw(c, this.layout, look);
    }
  }

  frame(state: GameState, time: number, dt: number): void {
    const ctx = this.ctx;
    const L = this.layout;
    const done = new Set<string>();
    for (const id of state.upgrades) if (upgrade(id)?.restoreStage) done.add(id.slice(8));
    const has = (stage: string) => done.has(stage);
    const look: Look = { done, theme: state.theme };
    this.ensureCaches(look);
    const light = this.light(state.theme);
    const rain = this.rainOverride ?? raining();
    const petals = state.theme === "autumn" ? 2 : state.theme === "sakura" || state.producers.gate > 0 ? 1 : 0;

    // Water clears gradually after each restoration.
    const target = has("water2") ? 1 : has("water") ? 0.55 : 0;
    this.clarity = this.clarity < 0 ? target : this.clarity + (target - this.clarity) * Math.min(1, dt * 0.8);

    ctx.drawImage(this.background, 0, 0);
    this.life.drawSky(ctx, time);
    this.water.draw(time, {
      clarity: this.clarity,
      sand: has("sand"),
      sky: has("sky") ? hex("#b9e2f2") : hex("#a7aaa3"),
    });
    ctx.drawImage(this.water.canvas, 0, 0);

    // The pond's earnings, made visible: rings appear faster as ripples/s grows.
    this.ambient += dt * Math.min(4, Math.log10(rps(state) + 1) * 0.5);
    while (this.ambient > 1) {
      this.ambient -= 1;
      const x = L.cx + (Math.random() * 2 - 1) * L.rx;
      const y = L.cy + (Math.random() * 2 - 1) * L.ry;
      if (L.depth(x, y) > 0.1) this.fx.ripple(x, y, 5 + Math.random() * 6, 0.6, 8);
    }

    this.life.sync(state);
    this.life.update(dt, this.pointer, state.golden.timeLeft);
    this.fx.update(dt);
    this.weather.update(dt, rain, petals);
    this.wildlife.update(dt, has("nectar"));
    this.life.drawUnder(ctx, this.clarity, time);
    if (!has("algae")) drawAlgae(ctx, L, time);
    if (!has("trash")) drawTrash(ctx, L, time);
    drawFallenStones(ctx, L, look);
    this.fx.draw(ctx);
    this.life.drawSurface(ctx, time);
    this.weather.drawFloating(ctx);
    ctx.drawImage(this.rim, 0, 0);
    if (has("deck")) drawDeck(ctx, L, time, has("festival"), light.night);
    this.life.drawBank(ctx, time, light);
    ctx.drawImage(this.front, 0, 0);
    if (has("basin")) this.wildlife.drawBasin(ctx);
    if (has("bamboo")) drawBamboo(ctx, L, time);
    if (has("nectar")) this.wildlife.draw(ctx, time, Math.max(0, 1 - light.night * 1.6) * (rain > 0.5 ? 0.3 : 1));

    this.weather.drawGloom(ctx, rain);
    this.drawLight(light, has("sky") && rain < 0.5, time, has("deck"));
    if (has("festival")) this.drawFestivalGlow(light, time);
    this.life.drawGlow(ctx, time, light, has("moss") || state.producers.reeds > 0);
    this.weather.drawAir(ctx, time, rain);

    if (this.ascensionFreeze !== null) drawAscension(ctx, L, this.ascensionFreeze);
    if (this.ascension) {
      const a = this.ascension;
      a.t += dt / ASCENSION_SECONDS;
      if (!a.flashed && a.t >= 0.5) {
        a.flashed = true;
        a.onFlash();
      }
      drawAscension(ctx, L, Math.min(1, a.t));
      if (a.t >= 1) this.ascension = null;
    }
  }

  // A click on the canvas: ripples and fed koi if it lands in the water.
  // Returns true if it hit the golden koi instead.
  clickAt(x: number, y: number): "golden" | "water" | "land" {
    if (this.life.hitGolden(x, y)) return "golden";
    if (this.layout.depth(x, y) > 0.02) {
      this.fx.splash(x, y, 0.7);
      this.life.feed(x, y);
      return "water";
    }
    return "land";
  }

  private drawFestivalGlow(light: Light, time: number): void {
    if (light.night < 0.1) return;
    const glow = hex("#ffd27a");
    for (const [i, p] of festivalLanterns(this.layout, time).entries()) {
      const a = light.night * (0.9 + Math.sin(time * 7 + i * 2) * 0.1);
      ellipse(this.ctx, p.x, p.y, 6, 5, glow, 0.12 * a);
      ellipse(this.ctx, p.x, p.y, 2.5, 2.5, glow, 0.35 * a);
      ellipse(this.ctx, p.x, this.layout.deck.y + this.layout.deck.h + 6 + i % 2, 2, 1, glow, 0.25 * a); // on the water
    }
  }

  private drawLight(light: Light, clearSky: boolean, time: number, viewing: boolean): void {
    const ctx = this.ctx;
    const L = this.layout;
    const { W, horizon } = L;
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = css(light.tint);
    ctx.fillRect(0, 0, W, L.H);
    ctx.globalCompositeOperation = "source-over";
    if (light.night > 0.4 && clearSky) {
      // Stars and a moon over a clear night sky.
      const a = (light.night - 0.4) / 0.6;
      for (let i = 0; i < W * 0.12; i++) {
        const x = Math.floor(hash2(i, 1, 5) * W);
        const y = Math.floor(hash2(i, 2, 5) * horizon * 0.8);
        const twinkle = hash2(i, Math.floor(time * 2), 6) > 0.85 ? 0.4 : 1;
        ctx.fillStyle = css(hex("#fff6d8"), a * twinkle);
        ctx.fillRect(x, y, 1, 1);
      }
      const moon = mix(hex("#fff3c4"), hex("#ffffff"), 0.5);
      const mx = Math.round(L.cx + L.rx * 0.45);
      const my = Math.round(horizon * 0.38);
      const r = viewing ? 7 : 5;
      // A soft halo, the disc, and its grey seas.
      ellipse(ctx, mx, my, r * 2.6, r * 2.6, moon, 0.05 * a);
      ellipse(ctx, mx, my, r * 1.7, r * 1.7, moon, 0.08 * a);
      ellipse(ctx, mx, my, r, r, moon, a);
      const sea = hex("#e0d7b4");
      for (const [dx, dy, s] of [[-2, -2, 1.6], [2, 1, 1.4], [-1, 3, 1], [3, -2, 0.8]] as const) {
        ellipse(ctx, mx + (dx * r) / 7, my + (dy * r) / 7, (s * r) / 7, (s * r) / 7, sea, a);
      }
      if (viewing) {
        // Moonlight lying on the water: a broken, shimmering column.
        let top = horizon;
        while (top < L.H && L.depth(mx, top) <= 0.02) top++;
        const span = L.ry * 1.3;
        for (let k = 0; k < span; k += 1 + (k % 3 === 0 ? 1 : 0)) {
          const y = top + k;
          const fade = 1 - k / span;
          const n = hash2(k, Math.floor(time * 3), 12);
          if (n < 0.2) continue; // gaps between the glints
          const half = (2 + fade * 6) * (0.3 + n * 0.9);
          const off = Math.sin(time * 1.5 + k * 0.6) * 1.5;
          for (let x = Math.round(mx + off - half); x <= mx + off + half; x++) {
            const edge = 1 - Math.abs(x - mx - off) / (half + 1);
            if (L.depth(x, y) > 0.02 && hash2(x, y + Math.floor(time * 4), 13) < 0.35 + edge * 0.6) {
              ctx.fillStyle = css(moon, a * fade * (0.25 + edge * 0.5));
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
      }
    }
  }
}
