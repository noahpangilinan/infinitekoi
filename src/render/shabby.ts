import { css, hex, type RGB } from "./color";
import type { PondLayout } from "./layout";
import { hash2, mulberry32 } from "./rng";
import { ellipse } from "./scene";

// Floating junk and algae, there until the first two restorations clear them.

const TIRE = hex("#26231f");
const TIRE_LIGHT = hex("#45403a");
const CAN = hex("#b9bcbf");
const CAN_RED = hex("#b8322a");
const BOTTLE = hex("#4f8f5a");
const BOTTLE_LIGHT = hex("#8fd29a");
const ALGAE = hex("#5f7a2a");
const ALGAE_LIGHT = hex("#86a23a");
const SCUM = hex("#8a8a4a");

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, c: RGB): void {
  ctx.fillStyle = css(c);
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

export function drawTrash(ctx: CanvasRenderingContext2D, L: PondLayout, time: number): void {
  const bob = (k: number) => Math.round(Math.sin(time * 1.3 + k) * 0.6);
  // A half-sunk tyre.
  const tx = L.cx + L.rx * 0.32;
  const ty = L.cy - L.ry * 0.15 + bob(0);
  ellipse(ctx, tx, ty, 7, 3.5, TIRE);
  ellipse(ctx, tx, ty - 1, 6, 2.5, TIRE_LIGHT);
  ellipse(ctx, tx, ty - 0.5, 3, 1.2, hex("#3d4a33"));
  // Cans and a bottle.
  const items: [number, number, RGB, RGB][] = [
    [-0.35, 0.2, CAN, CAN_RED],
    [0.1, 0.45, CAN, hex("#2f5fa8")],
    [-0.6, -0.25, BOTTLE, BOTTLE_LIGHT],
  ];
  items.forEach(([fx, fy, a, b], k) => {
    const x = L.cx + L.rx * fx;
    const y = L.cy + L.ry * fy + bob(k + 1);
    const flip = k % 2 === 0;
    for (let i = 0; i < 4; i++) dot(ctx, x + (flip ? i : 0), y + (flip ? 0 : i * 0.5), i === 1 ? b : a);
    dot(ctx, x + 1, y - 1, hex("#dfe3e6"));
  });
}

export function drawAlgae(ctx: CanvasRenderingContext2D, L: PondLayout, time: number): void {
  const rng = mulberry32(41);
  for (let i = 0; i < 9; i++) {
    const theta = rng() * Math.PI * 2;
    const p = L.edge(theta, -6 - rng() * 14);
    const r = 4 + rng() * 6;
    const sway = Math.sin(time * 0.5 + i) * 0.7;
    for (let k = 0; k < r * r * 1.4; k++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * r;
      const x = p.x + Math.cos(a) * d + sway;
      const y = p.y + Math.sin(a) * d * 0.45;
      if (!L.inside(x, y)) continue;
      const n = hash2(Math.round(x), Math.round(y), 6);
      dot(ctx, x, y, n < 0.25 ? ALGAE_LIGHT : n < 0.4 ? SCUM : ALGAE);
    }
  }
}
