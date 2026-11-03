import { hex, mix, pack, scale, type RGB } from "./color";
import type { PondLayout } from "./layout";
import { hash2 } from "./rng";

// The water surface, drawn pixel by pixel every frame into its own canvas.
// `clarity` runs from 0 (murky, brown-green, silty) to 1 (clear teal, sand
// showing in the shallows, light dancing on the bottom).

const MURKY_SHALLOW = hex("#6e6c40");
const MURKY_DEEP = hex("#3c4731");
const SILT = hex("#57583a");
const CLEAR_SHALLOW = hex("#5cb7ae");
const CLEAR_DEEP = hex("#1d5a79");
const SAND = hex("#cdb98a");
const CAUSTIC = hex("#9ee0d6");
const SPARKLE = hex("#ffffff");
const SHADOW = hex("#172a2a");

export interface WaterLook {
  clarity: number; // 0..1
  sand: boolean;
  sky: RGB; // colour reflected near the far shore
}

export class Water {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private image: ImageData;
  private pixels: Uint32Array;
  private cells: { i: number; x: number; y: number; d: number; back: number }[] = [];

  constructor(private L: PondLayout) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = L.W;
    this.canvas.height = L.H;
    this.ctx = this.canvas.getContext("2d")!;
    this.image = this.ctx.createImageData(L.W, L.H);
    this.pixels = new Uint32Array(this.image.data.buffer);
    const top = L.cy - L.ry * 1.15;
    for (let y = Math.floor(top); y < L.cy + L.ry * 1.15; y++) {
      for (let x = Math.floor(L.cx - L.rx * 1.15); x < L.cx + L.rx * 1.15; x++) {
        const d = L.depth(x, y);
        if (d <= 0) continue;
        // How close to the far shore, for the sky reflection.
        const back = Math.max(0, 1 - (y - top) / (L.ry * 0.7));
        this.cells.push({ i: y * L.W + x, x, y, d, back });
      }
    }
  }

  inside(x: number, y: number): boolean {
    return this.L.inside(x, y);
  }

  draw(time: number, look: WaterLook): void {
    const { clarity, sand, sky } = look;
    const shallow = mix(MURKY_SHALLOW, CLEAR_SHALLOW, clarity);
    const deep = mix(MURKY_DEEP, CLEAR_DEEP, clarity);
    const t4 = Math.floor(time * 4);
    const drift = time * 0.6;
    const px = this.pixels;
    for (const c of this.cells) {
      const depth = Math.pow(c.d, 0.6);
      let col = mix(shallow, deep, depth);
      if (sand) col = mix(col, SAND, Math.max(0, 0.45 - c.d) * 1.6 * clarity);
      // Silt: slow-moving blotches that fade as the water clears.
      if (clarity < 1) {
        const n = hash2(Math.floor((c.x + drift) / 5), Math.floor(c.y / 3), 2);
        if (n < 0.35) col = mix(col, SILT, (1 - clarity) * 0.6);
      }
      // Caustics: soft bright lines on the bottom in clear water.
      if (clarity > 0.4) {
        const w =
          Math.sin(c.x * 0.31 + Math.sin(c.y * 0.23 + time * 0.7) * 2 + time * 0.9) +
          Math.sin(c.y * 0.57 - c.x * 0.11 - time * 1.2 + Math.sin(c.x * 0.17) * 1.5);
        if (w > 1.55) col = mix(col, CAUSTIC, (clarity - 0.4) * 0.55 * (1 - c.d * 0.6));
      }
      // The far shore's shadow and the sky's reflection on the far half.
      if (c.d < 0.07 && c.back > 0.2) col = mix(col, SHADOW, 0.45);
      else if (c.back > 0) col = mix(col, sky, c.back * 0.35);
      if (c.d < 0.03) col = scale(col, 1.18); // wet bright edge
      // Sparkles, mostly where the sky is reflected.
      if (hash2(c.x, c.y, t4) > 0.9993 - c.back * 0.004) col = mix(col, SPARKLE, 0.75);
      px[c.i] = pack(col);
    }
    this.ctx.putImageData(this.image, 0, 0);
  }
}
