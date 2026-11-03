import { variety, type Variety } from "../../game/data/varieties";
import { hex, mix, pack, scale, type RGB } from "../color";
import { mulberry32 } from "../rng";

// Koi seen from above, drawn by code: each pixel is turned back into the
// fish's own coordinates (t runs tail to head, s across the body) and
// coloured from its variety and personal patch pattern. The same method as
// the desktop pet's sprite generator, so every heading stays crisp.

export const KOI_SIZE = 18; // frame size in pixels
export const HEADINGS = 16;
export const FRAMES = 6;

const OUTLINE = hex("#1f1c1d");
const FIN_WHITE = hex("#ece6da");
const EYE = hex("#111111");
const BELLY_RED = hex("#d8572f");

interface Patch {
  t: number;
  s: number;
  rt: number;
  rs: number;
  color: RGB;
}

export interface KoiLook {
  variety: Variety;
  patches: Patch[];
  base: RGB;
  fin: RGB;
}

// Turn a variety and a seed into this koi's own markings.
export function koiLook(varietyId: string, seed: number): KoiLook {
  const v = variety(varietyId);
  const rng = mulberry32(seed);
  const base = hex(v.base);
  const patches: Patch[] = [];
  const colors = v.patches.map(hex);
  if (colors.length) {
    const count = 2 + Math.floor(rng() * 3 + v.coverage * 3);
    for (let i = 0; i < count; i++) {
      patches.push({
        t: 0.3 + rng() * 0.62,
        s: (rng() - 0.5) * 1.4,
        rt: 0.06 + rng() * 0.12 * (0.5 + v.coverage),
        rs: 0.4 + rng() * 0.6,
        color: colors[i % colors.length === 0 ? 0 : Math.floor(rng() * colors.length)],
      });
    }
  }
  if (v.tancho) patches.push({ t: 0.86, s: 0, rt: 0.06, rs: 0.5, color: hex("#e0472b") });
  const fin = v.id === "showa" || v.id === "utsuri" ? hex("#2a2729") : v.metallic ? scale(base, 1.05) : FIN_WHITE;
  return { variety: v, patches, base, fin };
}

export function goldenLook(): KoiLook {
  return { variety: variety("ogon"), patches: [], base: hex("#ffcf3a"), fin: hex("#fff0a0") };
}

function bodyColor(look: KoiLook, t: number, s: number, frame: number): RGB {
  let c = look.base;
  for (const p of look.patches) {
    if (((t - p.t) / p.rt) ** 2 + ((s - p.s) / p.rs) ** 2 < 1) c = p.color;
  }
  const v = look.variety;
  if (v.scaled) {
    // Asagi: a net of darker scale edges, red along the flanks.
    if (Math.abs(s) > 0.72 && t > 0.3) c = BELLY_RED;
    else if ((Math.floor(t * 22) + Math.floor((s + 1) * 4)) % 2 === 0) c = scale(c, 0.82);
  }
  if (Math.abs(s) > 0.78) c = scale(c, 0.85); // rounded flank shading
  if (v.metallic && Math.abs(s) < 0.3) {
    // A shimmer that slides along the back as it swims.
    const glint = Math.abs(((t * 3 + frame / FRAMES) % 1) - 0.5) < 0.12;
    c = mix(c, hex("#ffffff"), glint ? 0.55 : 0.18);
  }
  return c;
}

// Draw one frame into a small canvas. `sway` is tail swing in pixels.
export function drawKoiFrame(look: KoiLook, heading: number, frame: number, sway: number): HTMLCanvasElement {
  const size = KOI_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const px = new Uint32Array(img.data.buffer);
  const angle = (heading / HEADINGS) * Math.PI * 2;
  const phase = (frame / FRAMES) * Math.PI * 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const tailU = -7.5;
  const headU = 7.5;
  const length = headU - tailU;
  const spine = (t: number) => sway * Math.sin(phase - 3.2 * t) * (1 - t) ** 1.6;
  const half = (t: number) => {
    if (t < 0.17) return 0.8 + (0.17 - t) * 14; // tail fin
    if (t < 0.25) return 0.7;
    return 0.7 + 2.0 * Math.sin(Math.min(1, (t - 0.25) / 0.75) * Math.PI * 0.92);
  };
  const filled = new Uint8Array(size * size);
  const c0 = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c0;
      const dy = y + 0.5 - c0;
      const u = dx * cos + dy * sin;
      const v = -dx * sin + dy * cos;
      const t = (u - tailU) / length;
      if (t < 0 || t > 1) continue;
      const cy = spine(t);
      const hw = half(t);
      const off = Math.abs(v - cy);
      let color: RGB | null = null;
      if (off <= hw) {
        if (t < 0.17) color = Math.abs((v - cy) / hw) < 0.3 && t < 0.1 ? null : look.fin;
        else color = bodyColor(look, t, (v - cy) / hw, frame);
      } else {
        // Pectoral fins just behind the head, flapping a little.
        const reach = 1.4 + 0.5 * Math.sin(phase);
        const d = off - hw;
        if (d <= reach && t > 0.62 - d * 0.04 && t < 0.72 - d * 0.04) color = look.fin;
      }
      if (color) {
        px[y * size + x] = pack(color);
        filled[y * size + x] = 1;
      }
    }
  }
  // Eyes.
  for (const side of [-1, 1]) {
    const t = 0.93;
    const u = tailU + t * length;
    const v = spine(t) + side * (half(t) - 0.5);
    const x = Math.floor(c0 + u * cos - v * sin);
    const y = Math.floor(c0 + u * sin + v * cos);
    if (x >= 0 && y >= 0 && x < size && y < size && filled[y * size + x]) px[y * size + x] = pack(EYE);
  }
  // One-pixel outline.
  const outline = pack(OUTLINE);
  const out = new Uint32Array(px);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (filled[y * size + x]) continue;
      if ((x > 0 && filled[y * size + x - 1]) || (x < size - 1 && filled[y * size + x + 1]) ||
          (y > 0 && filled[(y - 1) * size + x]) || (y < size - 1 && filled[(y + 1) * size + x])) {
        out[y * size + x] = outline;
      }
    }
  }
  img.data.set(new Uint8ClampedArray(out.buffer));
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Frames are drawn on first use and kept.
export class KoiSprites {
  private cache = new Map<string, HTMLCanvasElement>();

  get(key: string, look: KoiLook, heading: number, frame: number, sway: number): HTMLCanvasElement {
    const k = `${key}:${heading}:${frame}:${sway}`;
    let c = this.cache.get(k);
    if (!c) {
      c = drawKoiFrame(look, heading, frame, sway);
      this.cache.set(k, c);
    }
    return c;
  }

  clear(): void {
    this.cache.clear();
  }
}
