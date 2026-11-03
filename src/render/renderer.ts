import { restorationLevel } from "../game/economy";
import type { GameState } from "../game/state";
import { css, hex, mix } from "./color";
import { currentPhase, lightAt, type Light } from "./daynight";
import { makeLayout, type PondLayout } from "./layout";
import { fitViewport, sizeCanvas, type Viewport } from "./pixels";
import { hash2 } from "./rng";
import { drawBackground, drawDeck, drawFallenStones, drawRim, type Look } from "./scene";
import { drawAlgae, drawTrash } from "./shabby";
import { Water } from "./water";

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
  phaseOverride: number | null = null;

  constructor(private canvas: HTMLCanvasElement) {}

  resize(width: number, height: number): void {
    this.vp = fitViewport(width, height);
    this.ctx = sizeCanvas(this.canvas, this.vp);
    this.layout = makeLayout(this.vp.W, this.vp.H);
    this.water = new Water(this.layout);
    this.lookKey = "";
  }

  light(): Light {
    return lightAt(this.phaseOverride ?? currentPhase());
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
    const light = this.light();

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

    if (level < 2) drawAlgae(ctx, L, time);
    if (level < 1) drawTrash(ctx, L, time);
    drawFallenStones(ctx, L, level);
    ctx.drawImage(this.rim, 0, 0);
    if (level >= 12) drawDeck(ctx, L);

    this.drawLight(light, level >= 9, time);
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
