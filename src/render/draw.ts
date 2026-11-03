import { css, type RGB } from "./color";

// Pixel drawing primitives on a low-resolution canvas.

export function dot(ctx: CanvasRenderingContext2D, x: number, y: number, c: RGB, a = 1): void {
  ctx.fillStyle = css(c, a);
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

export function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: RGB, a = 1): void {
  ctx.fillStyle = css(c, a);
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

export function ellipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, c: RGB, a = 1): void {
  ctx.fillStyle = css(c, a);
  for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
    const half = rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)));
    if (half < 0.4) continue;
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), Math.max(1, Math.round(half * 2)), 1);
  }
}

// The outline of an ellipse, one pixel thick (ripples).
export function ring(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, c: RGB, a = 1): void {
  ctx.fillStyle = css(c, a);
  const steps = Math.max(12, Math.ceil((rx + ry) * 3));
  let lx = NaN;
  let ly = NaN;
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(t) * rx);
    const y = Math.round(cy + Math.sin(t) * ry);
    if (x === lx && y === ly) continue;
    ctx.fillRect(x, y, 1, 1);
    lx = x;
    ly = y;
  }
}

export function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, c: RGB, a = 1): void {
  ctx.fillStyle = css(c, a);
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
  }
}
