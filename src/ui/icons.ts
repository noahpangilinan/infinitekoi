import { hex } from "../render/color";
import { dot, ellipse, rect, ring } from "../render/draw";
import { drawFrog, drawTadpole, drawTurtleBasking } from "../render/sprites/critters";
import { drawKoiFrame, goldenLook, koiLook } from "../render/sprites/koi";
import { drawLily, drawReeds } from "../render/sprites/plants";
import { drawGate, drawLantern } from "../render/sprites/structures";
import { drawCrane, drawFox, drawKappa, drawRabbit } from "../render/mythic";

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
  spirit: (ctx) => {
    ellipse(ctx, 10, 11, 9, 8, hex("#1d2b4a"));
    ellipse(ctx, 10, 10, 6, 5, hex("#a8ecff"), 0.2);
    ellipse(ctx, 10, 10, 3.5, 3, hex("#a8ecff"), 0.6);
    ellipse(ctx, 10, 10, 1.5, 1.5, hex("#f2fdff"));
    dot(ctx, 7, 13, hex("#a8ecff"), 0.6);
    dot(ctx, 5, 15, hex("#a8ecff"), 0.35);
  },
  skykoi: (ctx) => {
    ellipse(ctx, 10, 11, 9, 8, hex("#6db3e0"));
    ellipse(ctx, 6, 15, 5, 2, hex("#ffffff"));
    ellipse(ctx, 14, 16, 4, 1.5, hex("#ffffff"));
    ctx.drawImage(drawKoiFrame(koiLook("showa", 5), 15, 0, 1), 1, 0);
  },
  rabbit: (ctx) => {
    ellipse(ctx, 10, 11, 9, 8, hex("#1d2b4a"));
    ellipse(ctx, 13, 7, 4, 4, hex("#fff3c4"));
    drawRabbit(ctx, 9, 17, 0, 1, 0);
  },
  kappa: (ctx) => {
    pool(ctx);
    drawKappa(ctx, 9, 17, 1, 0);
  },
  crane: (ctx) => {
    pool(ctx);
    drawCrane(ctx, 8, 18, 1, 0);
  },
  fox: (ctx) => {
    ellipse(ctx, 10, 11, 9, 8, hex("#3a2a1d"));
    drawFox(ctx, 10, 18, 1, 0);
    ellipse(ctx, 15, 5, 1.5, 2, hex("#8ad8ff"));
  },
  rainbow: (ctx) => {
    ellipse(ctx, 10, 11, 9, 8, hex("#6db3e0"));
    const bands = ["#e8505a", "#f0954a", "#f2d24a", "#6fc06a", "#5a9ae0", "#8a6ad0"];
    bands.forEach((c, b) => ring(ctx, 10, 16, 8 - b, 8 - b, hex(c)));
    ctx.clearRect(0, 16, 20, 4);
  },
  island: (ctx) => {
    ellipse(ctx, 10, 11, 9, 8, hex("#6db3e0"));
    for (let k = 0; k < 7; k++) rect(ctx, 10 - (7 - k), 9 + k, (7 - k) * 2, 1, hex(k % 3 === 2 ? "#55524b" : "#7d7a70"));
    ellipse(ctx, 10, 9, 8, 1.5, hex("#5a8f3c"));
    rect(ctx, 11, 6, 3, 2, hex("#c4382c"));
    ellipse(ctx, 6, 6, 2.5, 1.5, hex("#2e5a38"));
  },
  dragon: (ctx) => {
    pool(ctx);
    for (let i = 8; i >= 0; i--) ellipse(ctx, 4 + i * 1.5, 12 + Math.sin(i) * 2.5, 2.2 - i * 0.12, 1.6, hex(i % 2 ? "#3fae8a" : "#24705a"));
    ellipse(ctx, 3, 12, 2.5, 2, hex("#3fae8a"));
    dot(ctx, 2, 11, hex("#1e1a18"));
    dot(ctx, 6, 10, hex("#f2c14e"));
  },
  river: (ctx) => {
    ellipse(ctx, 10, 11, 9, 8, hex("#141c3a"));
    for (let i = 0; i < 40; i++) {
      const x = 2 + ((i * 7) % 16);
      const y = 4 + x * 0.6 + (((i * 13) % 7) - 3);
      dot(ctx, x, y, hex("#fff6d8"), 0.4 + ((i * 3) % 6) / 10);
    }
    dot(ctx, 10, 10, hex("#fff6d8"));
    dot(ctx, 9, 10, hex("#f2c14e"));
  },
  harmony: (ctx) => {
    pool(ctx);
    ctx.drawImage(drawKoiFrame(koiLook("kohaku", 3), 4, 0, 1), -3, -2);
    ctx.drawImage(drawKoiFrame(koiLook("ghost", 8), 12, 0, 1), 5, 4);
  },
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
