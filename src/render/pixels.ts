// The game canvas: drawn at a low resolution (about 400×225) and scaled up
// by a whole number so every pixel stays crisp. The logical size stretches a
// little to fit the window exactly.

export const BASE_W = 400;
export const BASE_H = 225;

export interface Viewport {
  W: number; // logical pixels
  H: number;
  scale: number; // screen pixels per logical pixel
}

export function fitViewport(width: number, height: number): Viewport {
  const scale = Math.max(1, Math.floor(Math.min(width / BASE_W, height / BASE_H)));
  return { W: Math.ceil(width / scale), H: Math.ceil(height / scale), scale };
}

export function sizeCanvas(canvas: HTMLCanvasElement, vp: Viewport): CanvasRenderingContext2D {
  canvas.width = vp.W;
  canvas.height = vp.H;
  canvas.style.width = `${vp.W * vp.scale}px`;
  canvas.style.height = `${vp.H * vp.scale}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

// Screen position to logical pixel.
export function toLogical(canvas: HTMLCanvasElement, vp: Viewport, clientX: number, clientY: number): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  return { x: (clientX - r.left) / vp.scale, y: (clientY - r.top) / vp.scale };
}
