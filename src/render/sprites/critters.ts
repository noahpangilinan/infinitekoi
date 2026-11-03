import { hex } from "../color";
import { dot, ellipse, line, rect } from "../draw";

// Small creatures: tadpoles, frogs and turtles.

const TADPOLE = hex("#2a2a22");
const FROG = hex("#5c9a3a");
const FROG_DARK = hex("#3f7428");
const FROG_LIGHT = hex("#9ccc5a");
const FROG_BELLY = hex("#e3e0a0");
const EYE = hex("#141414");
const SHELL = hex("#6d6a3a");
const SHELL_DARK = hex("#4a4826");
const SHELL_LIGHT = hex("#9a955a");
const SKIN = hex("#7f8a52");

// A tadpole from above: a dot with a wagging tail behind it.
export function drawTadpole(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, wag: number, alpha: number): void {
  dot(ctx, x, y, TADPOLE, alpha);
  dot(ctx, x + 1, y, TADPOLE, alpha);
  const bx = x - Math.cos(heading) * 2;
  const by = y - Math.sin(heading) * 1.2;
  dot(ctx, bx + Math.sin(wag) * 0.8, by + Math.cos(wag) * 0.5, TADPOLE, alpha * 0.8);
  dot(ctx, bx - Math.cos(heading) * 1.5 + Math.sin(wag + 1) * 1.2, by - Math.sin(heading), TADPOLE, alpha * 0.5);
}

// A frog sitting side-on, facing left or right. `pose` 0 sitting, 1 croaking
// (throat puffed), 2 crouched to jump. `blink` closes the eye.
export function drawFrog(ctx: CanvasRenderingContext2D, x: number, y: number, right: boolean, pose: number, blink: boolean): void {
  const f = right ? 1 : -1;
  const X = (dx: number) => x + dx * f;
  const crouch = pose === 2 ? 1 : 0;
  // Back leg, body, head.
  ellipse(ctx, X(-2), y - 1, 3, 1.6, FROG_DARK);
  ellipse(ctx, X(0), y - 2 + crouch, 3.5, 2.2, FROG);
  ellipse(ctx, X(2), y - 3 + crouch, 2.2, 1.6, FROG);
  dot(ctx, X(-1), y - 4 + crouch, FROG_LIGHT);
  dot(ctx, X(0), y - 4 + crouch, FROG_LIGHT);
  // Eye on top of the head.
  dot(ctx, X(2), y - 5 + crouch, FROG_LIGHT);
  dot(ctx, X(3), y - 5 + crouch, blink ? FROG_DARK : EYE);
  // Front leg and belly.
  dot(ctx, X(2), y, FROG_DARK);
  dot(ctx, X(3), y, FROG_DARK);
  dot(ctx, X(1), y - 1 + crouch, FROG_BELLY);
  if (pose === 1) ellipse(ctx, X(3), y - 1, 1.6, 1.2, FROG_BELLY); // croak
}

// A frog mid-leap: stretched out, legs trailing.
export function drawFrogLeap(ctx: CanvasRenderingContext2D, x: number, y: number, right: boolean): void {
  const f = right ? 1 : -1;
  line(ctx, x - 4 * f, y + 1, x - 1 * f, y - 1, FROG_DARK);
  ellipse(ctx, x + f, y - 1, 3, 1.5, FROG);
  dot(ctx, x + 3 * f, y - 2, EYE);
  line(ctx, x + 2 * f, y, x + 4 * f, y + 1, FROG_DARK);
}

// A turtle basking side-on on its rock.
export function drawTurtleBasking(ctx: CanvasRenderingContext2D, x: number, y: number, right: boolean, headOut: number): void {
  const f = right ? 1 : -1;
  ellipse(ctx, x, y - 2, 4.5, 2.6, SHELL_DARK);
  ellipse(ctx, x, y - 2.5, 4, 2.2, SHELL);
  dot(ctx, x - 1, y - 4, SHELL_LIGHT);
  dot(ctx, x + 1, y - 3, SHELL_LIGHT);
  dot(ctx, x - 2, y - 2, SHELL_LIGHT);
  rect(ctx, x - 3, y, 2, 1, SKIN);
  rect(ctx, x + 2, y, 2, 1, SKIN);
  const hx = x + (4 + headOut) * f;
  ellipse(ctx, hx, y - 2, 1.4, 1, SKIN);
  dot(ctx, hx + f, y - 3, EYE);
}

// A turtle swimming, seen from above.
export function drawTurtleSwimming(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, paddle: number, alpha: number): void {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  const at = (u: number, v: number) => [x + u * c - v * s, y + u * s * 0.7 + v * c * 0.7] as const;
  for (const side of [-1, 1]) {
    for (const u of [2, -2]) {
      const [lx, ly] = at(u + Math.sin(paddle + u) * 0.6, side * 3.2);
      dot(ctx, lx, ly, SKIN, alpha);
    }
  }
  const [hx, hy] = at(4.5, 0);
  dot(ctx, hx, hy, SKIN, alpha);
  ellipse(ctx, x, y, 3.4, 2.4, SHELL_DARK, alpha);
  ellipse(ctx, x, y - 0.4, 2.8, 1.9, SHELL, alpha);
  dot(ctx, x, y - 1, SHELL_LIGHT, alpha);
}
