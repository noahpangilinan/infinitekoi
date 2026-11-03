import { restorationLevel, rps } from "../game/economy";
import type { GameState } from "../game/state";
import { css, hex, mix } from "./color";
import { currentPhase, lightAt, type Light } from "./daynight";
import { makeLayout, type PondLayout } from "./layout";
import { PondLife, type Pointer } from "./life";
import { Effects } from "./particles";
import { fitViewport, sizeCanvas, type Viewport } from "./pixels";
import { hash2 } from "./rng";
import { drawBackground, drawDeck, drawFallenStones, drawRim, type Look } from "./scene";
import { drawAlgae, drawTrash } from "./shabby";
import { Water } from "./water";
import { drawAscension, raining, Weather } from "./weather";

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
  private lookKey = "";
  private clarity = -1;
  private ambient = 0;
  readonly fx = new Effects();
  life!: PondLife;
  private weather!: Weather;
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
    } else {
      this.life = new PondLife(this.layout, this.fx);
      this.weather = new Weather(this.layout, this.fx);
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
    const key = `${this.vp.W}x${this.vp.H}:${look.level}:${look.theme}`;
    if (key === this.lookKey) return;
    this.lookKey = key;
    for (const [canvas, draw] of [[this.background, drawBackground], [this.rim, drawRim]] as const) {
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
    const level = restorationLevel(state);
    const look: Look = { level, theme: state.theme };
    this.ensureCaches(look);
    const light = this.light(state.theme);
    const rain = this.rainOverride ?? raining();
    const petals = state.theme === "autumn" ? 2 : state.theme === "sakura" || state.producers.gate > 0 ? 1 : 0;

    // Water clears gradually after each restoration.
    const target = level >= 8 ? 1 : level >= 6 ? 0.55 : 0;
    this.clarity = this.clarity < 0 ? target : this.clarity + (target - this.clarity) * Math.min(1, dt * 0.8);

    ctx.drawImage(this.background, 0, 0);
    this.water.draw(time, {
      clarity: this.clarity,
      sand: level >= 7,
      sky: level >= 9 ? hex("#b9e2f2") : hex("#a7aaa3"),
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
    this.life.drawUnder(ctx, this.clarity, time);
    if (level < 2) drawAlgae(ctx, L, time);
    if (level < 1) drawTrash(ctx, L, time);
    drawFallenStones(ctx, L, level);
    this.fx.draw(ctx);
    this.life.drawSurface(ctx, time);
    this.weather.drawFloating(ctx);
    ctx.drawImage(this.rim, 0, 0);
    if (level >= 12) drawDeck(ctx, L);
    this.life.drawBank(ctx, time, light);

    this.weather.drawGloom(ctx, rain);
    this.drawLight(light, level >= 9 && rain < 0.5, time);
    this.life.drawGlow(ctx, time, light, level >= 5 || state.producers.reeds > 0);
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

  private drawLight(light: Light, clearSky: boolean, time: number): void {
    const ctx = this.ctx;
    const { W, H, horizon } = this.layout;
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = css(light.tint);
    ctx.fillRect(0, 0, W, H);
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
      const mx = W * 0.8;
      const my = horizon * 0.35;
      ctx.fillStyle = css(mix(hex("#fff3c4"), hex("#ffffff"), 0.5), a);
      for (let y = -4; y <= 4; y++) {
        const half = Math.round(Math.sqrt(16 - y * y));
        ctx.fillRect(Math.round(mx - half), Math.round(my + y), half * 2, 1);
      }
    }
  }
}
