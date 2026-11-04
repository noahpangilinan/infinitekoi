import { hex } from "../render/color";
import { dot, ellipse, rect, ring } from "../render/draw";
import { drawFrog, drawTadpole, drawTurtleBasking } from "../render/sprites/critters";
import { drawKoiFrame, goldenLook, koiLook } from "../render/sprites/koi";
import { drawLily, drawReeds } from "../render/sprites/plants";
import { drawGate, drawLantern } from "../render/sprites/structures";

// Small pixel icons for the shop, drawn with the same code as the pond and
// cached as image URLs. 20×20 pixels, shown at 2× or 3×.

const SIZE = 20;
const cache = new Map<string, string>();
const WATER = hex("#2f7f91");
const WATER_LIGHT = hex("#5cb7ae");

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  return [c, c.getContext("2d")!];
}

function pool(ctx: CanvasRenderingContext2D): void {
  ellipse(ctx, 10, 12, 9, 6, WATER);
  ellipse(ctx, 7, 10, 4, 2, WATER_LIGHT, 0.5);
}

const PAINTERS: Record<string, (ctx: CanvasRenderingContext2D) => void> = {
  tadpole: (ctx) => {
    pool(ctx);
    drawTadpole(ctx, 7, 10, 0.3, 0, 1);
    drawTadpole(ctx, 12, 14, 2.6, 1, 1);
    drawTadpole(ctx, 13, 9, 1, 2, 1);
  },
  frog: (ctx) => {
    ellipse(ctx, 10, 15, 7, 2.5, hex("#8f8c84"));
    drawFrog(ctx, 10, 14, true, 1, false);
  },
  lily: (ctx) => {
    pool(ctx);
    drawLily(ctx, 10, 12, 6, 0.6, 1);
  },
  koi: (ctx) => {
    pool(ctx);
    ctx.drawImage(drawKoiFrame(koiLook("kohaku", 3), 14, 0, 1), 1, 2);
  },
  reeds: (ctx) => drawReeds(ctx, 10, 18, 300, 0, 0),
  turtle: (ctx) => {
    ellipse(ctx, 10, 15, 8, 3, hex("#7d7a70"));
    drawTurtleBasking(ctx, 10, 14, true, 1);
  },
  lantern: (ctx) => drawLantern(ctx, 10, 19, 1),
  waterfall: (ctx) => {
    for (const [x, y, r] of [[5, 9, 4], [15, 8, 4], [10, 4, 4]]) ellipse(ctx, x, y, r, r * 0.8, hex("#9b978c"));
    rect(ctx, 8, 4, 4, 11, hex("#cfeef2"));
    for (let y = 5; y < 15; y += 3) rect(ctx, 9, y, 1, 2, hex("#7cc1cf"));
    ellipse(ctx, 10, 16, 7, 2.5, WATER);
    ring(ctx, 10, 16, 5, 1.5, hex("#ffffff"), 0.8);
  },
  bridge: (ctx) => {
    ellipse(ctx, 10, 15, 9, 3, WATER);
    for (let x = 1; x < 19; x++) {
      const y = 12 - Math.round(4 * Math.sin(((x - 1) / 17) * Math.PI));
      rect(ctx, x, y, 1, 2, hex("#9a7650"));
      dot(ctx, x, y - 3, hex("#c4382c"));
    }
    rect(ctx, 1, 8, 2, 6, hex("#c4382c"));
    rect(ctx, 17, 8, 2, 6, hex("#c4382c"));
  },
  gate: (ctx) => drawGate(ctx, 10, 31),
  click: (ctx) => {
    pool(ctx);
    ring(ctx, 10, 12, 6, 3, hex("#ffffff"), 0.9);
    ring(ctx, 10, 12, 3, 1.5, hex("#ffffff"), 0.7);
  },
  golden: (ctx) => {
    pool(ctx);
    ctx.drawImage(drawKoiFrame(goldenLook(), 14, 0, 1), 1, 2);
    dot(ctx, 4, 6, hex("#fff5c0"));
    dot(ctx, 16, 15, hex("#fff5c0"));
  },
};

// Restoration icons: a broom-and-sparkle badge tinted per stage.
const RESTORE_COLORS: Record<string, string> = {
  trash: "#8a7a5a", algae: "#6f8f3a", stones: "#9b978c", weeds: "#b59a4a", moss: "#5e8b37", water: "#4fa3b0",
  sand: "#cdb98a", water2: "#5cc7d9", sky: "#6db3e0", garden: "#c94a30", gravel: "#c9c4b6", deck: "#9a6a3e",
  fence: "#c9b46c", flowers: "#e2457e", path: "#7d7a70", grove: "#3f7a3a", basin: "#5a8fa0", nectar: "#3fae7a",
  pine: "#2e5a38", bamboo: "#8fb84a", pagoda: "#b8b5ac", festival: "#d8432f",
};

function restoreIcon(ctx: CanvasRenderingContext2D, key: string): void {
  const c = hex(RESTORE_COLORS[key] ?? "#9b978c");
  ellipse(ctx, 10, 11, 8, 8, hex("#2a2018"));
  ellipse(ctx, 10, 10, 7, 7, c);
  ellipse(ctx, 8, 7, 3, 2, hex("#ffffff"), 0.35);
  for (const [x, y] of [[15, 4], [4, 15], [16, 15]]) {
    dot(ctx, x, y, hex("#fff5c0"));
    dot(ctx, x - 1, y, hex("#fff5c0"), 0.6);
    dot(ctx, x + 1, y, hex("#fff5c0"), 0.6);
    dot(ctx, x, y - 1, hex("#fff5c0"), 0.6);
    dot(ctx, x, y + 1, hex("#fff5c0"), 0.6);
  }
}

export function icon(name: string): string {
  let url = cache.get(name);
  if (url) return url;
  const [c, ctx] = canvas();
  if (name.startsWith("restore-")) restoreIcon(ctx, name.slice(8));
  else if (name.startsWith("variety-")) ctx.drawImage(drawKoiFrame(koiLook(name.slice(8), 11), 14, 0, 1), 1, 1);
  else (PAINTERS[name] ?? PAINTERS.click)(ctx);
  url = c.toDataURL();
  cache.set(name, url);
  return url;
}
