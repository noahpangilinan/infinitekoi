import { hex } from "./color";
import { dot, ring } from "./draw";

// Short-lived effects: ripple rings on the water and splash droplets.

const RIPPLE = hex("#e8f6f4");
const DROP = hex("#d9f1f4");

interface Ripple {
  x: number;
  y: number;
  r: number;
  max: number;
  speed: number;
  strength: number;
}

interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export class Effects {
  private ripples: Ripple[] = [];
  private drops: Drop[] = [];

  ripple(x: number, y: number, max = 10, strength = 1, speed = 12): void {
    if (this.ripples.length > 120) this.ripples.shift();
    this.ripples.push({ x, y, r: 0.5, max, speed, strength });
  }

  // A ring or two plus droplets thrown up, for clicks and frogs diving in.
  splash(x: number, y: number, size = 1): void {
    this.ripple(x, y, 9 * size, 1);
    this.ripple(x, y, 5 * size, 0.7, 8);
    for (let i = 0; i < 6 * size; i++) {
      const a = Math.random() * Math.PI * 2;
      this.drops.push({ x, y, vx: Math.cos(a) * 14 * size, vy: -12 - Math.random() * 14, life: 0.5 });
    }
  }

  update(dt: number): void {
    for (const r of this.ripples) r.r += r.speed * dt * (1 - (r.r / r.max) * 0.5);
    this.ripples = this.ripples.filter((r) => r.r < r.max);
    for (const d of this.drops) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 70 * dt;
      d.life -= dt;
    }
    this.drops = this.drops.filter((d) => d.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const r of this.ripples) {
      const fade = 1 - r.r / r.max;
      ring(ctx, r.x, r.y, r.r, r.r * 0.5, RIPPLE, 0.55 * fade * r.strength);
    }
    for (const d of this.drops) dot(ctx, d.x, d.y, DROP, Math.min(1, d.life * 3));
  }
}
