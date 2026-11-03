import { hex, type RGB } from "../color";
import { dot, ellipse, line } from "../draw";
import { mulberry32 } from "../rng";

// Lily pads with lotus flowers, and reeds, iris and cattails at the edge.

const PAD = hex("#4f8f3a");
const PAD_DARK = hex("#356b28");
const PAD_LIGHT = hex("#76b452");
const LOTUS = hex("#f3b6cc");
const LOTUS_DEEP = hex("#dc7fa3");
const LOTUS_WHITE = hex("#fbf3f0");
const LOTUS_HEART = hex("#f5d76a");
const REED = hex("#5f8f38");
const REED_DARK = hex("#40692a");
const REED_TIP = hex("#9fbf5a");
const IRIS = hex("#7b5cc9");
const IRIS_LIGHT = hex("#b5a0f0");
const CATTAIL = hex("#6b4529");

// A round pad with a wedge notch; `bloom` adds a flower.
export function drawLily(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, notch: number, bloom: number): void {
  ellipse(ctx, x, y + 0.5, r, r * 0.5, PAD_DARK);
  ellipse(ctx, x, y, r, r * 0.48, PAD);
  ellipse(ctx, x - r * 0.25, y - r * 0.12, r * 0.45, r * 0.2, PAD_LIGHT);
  // The notch: a thin wedge from the middle to the rim.
  for (let k = 0; k <= r; k++) {
    dot(ctx, x + Math.cos(notch) * k, y + Math.sin(notch) * k * 0.48, PAD_DARK);
  }
  if (bloom > 0) {
    const white = bloom > 1;
    const petal = white ? LOTUS_WHITE : LOTUS;
    const fy = y - 2;
    ellipse(ctx, x + 1, fy + 1, 2.4, 1.2, white ? hex("#e2d6d6") : LOTUS_DEEP);
    dot(ctx, x - 1, fy - 1, petal);
    dot(ctx, x + 3, fy - 1, petal);
    dot(ctx, x + 1, fy - 2, petal);
    dot(ctx, x, fy, petal);
    dot(ctx, x + 2, fy, petal);
    dot(ctx, x + 1, fy - 1, LOTUS_HEART);
  }
}

// A clump at the water's edge that sways with the breeze.
export function drawReeds(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number, time: number, kind: number): void {
  const rng = mulberry32(seed);
  const blades = 5 + Math.floor(rng() * 4);
  for (let b = 0; b < blades; b++) {
    const bx = x + (rng() - 0.5) * 7;
    const h = 7 + rng() * 9;
    const lean = (rng() - 0.5) * 0.5;
    const sway = Math.sin(time * 1.3 + bx * 0.3 + seed) * 0.12;
    let tx = bx;
    let ty = y;
    for (let k = 0; k < h; k++) {
      const f = k / h;
      tx = bx + (lean + sway * f) * k;
      ty = y - k;
      dot(ctx, tx, ty, k > h - 2 ? REED_TIP : b % 2 ? REED_DARK : REED);
    }
    if (kind === 0 && b === 1) iris(ctx, tx, ty);
    if (kind === 1 && b % 3 === 0) {
      line(ctx, tx, ty, tx, ty + 2, CATTAIL);
      dot(ctx, tx, ty - 1, REED_TIP);
    }
  }
}

function iris(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const petals: [number, number, RGB][] = [[-1, 0, IRIS], [1, 0, IRIS], [0, -1, IRIS_LIGHT], [0, 1, IRIS], [0, 0, hex("#f2d24a")]];
  for (const [dx, dy, c] of petals) dot(ctx, x + dx, y + dy, c);
}
