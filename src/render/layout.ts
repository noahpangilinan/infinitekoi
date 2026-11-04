import { mulberry32 } from "./rng";

// Where everything sits, for a given canvas size. The pond is a wobbly
// ellipse seen from slightly above; everything else is placed around it.

export interface Spot {
  x: number;
  y: number;
}

export interface PondLayout {
  W: number;
  H: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  horizon: number; // where the sky meets the garden
  inside(x: number, y: number): boolean;
  depth(x: number, y: number): number; // 0 at the edge, 1 in the middle, <0 outside
  edge(theta: number, out?: number): Spot; // a point on the shore, `out` pixels outside
  stones: { x: number; y: number; w: number; h: number; theta: number; seed: number }[];
  frogSpots: Spot[];
  reedSpots: Spot[];
  lanternSpots: Spot[];
  turtleRock: Spot;
  waterfall: Spot; // top of the falls, on the far shore
  gate: Spot; // base centre of the shrine gate, behind the far shore
  bridge: { x1: number; x2: number; y: number };
  deck: { x: number; y: number; w: number; h: number };
}

const WOBBLE: [number, number, number][] = [
  [2, 0.05, 0.7],
  [3, 0.045, 2.1],
  [5, 0.025, 4.0],
];

function radiusAt(theta: number): number {
  let r = 1;
  for (const [k, a, p] of WOBBLE) r += a * Math.sin(k * theta + p);
  return r;
}

export function makeLayout(W: number, H: number): PondLayout {
  const horizon = Math.round(H * 0.27);
  const cx = Math.round(W * 0.5);
  const rx = Math.round(Math.min(W * 0.36, H * 0.82));
  const ry = Math.round(Math.min(rx * 0.42, H * 0.3));
  const cy = Math.round(Math.max(horizon + ry + 16, H * 0.6));

  const inside = (x: number, y: number) => depthAt(x, y) > 0;
  function depthAt(x: number, y: number): number {
    const dx = (x + 0.5 - cx) / rx;
    const dy = (y + 0.5 - cy) / ry;
    const r = Math.hypot(dx, dy);
    return 1 - r / radiusAt(Math.atan2(dy, dx));
  }
  const edge = (theta: number, out = 0): Spot => {
    const r = radiusAt(theta);
    return {
      x: cx + Math.cos(theta) * (rx * r + out),
      y: cy + Math.sin(theta) * (ry * r + out * 0.55),
    };
  };

  // Edging stones all the way round, sized for the perspective: smaller at the back.
  const rng = mulberry32(7);
  const stones: PondLayout["stones"] = [];
  const perimeter = Math.PI * (rx + ry) * 1.5;
  const count = Math.round(perimeter / 9);
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2 + rng() * 0.05;
    const near = (Math.sin(theta) + 1) / 2; // 0 back, 1 front
    const p = edge(theta, 2);
    stones.push({
      x: p.x,
      y: p.y,
      w: Math.round(7 + near * 4 + rng() * 3),
      h: Math.round(4 + near * 2 + rng() * 2),
      theta,
      seed: Math.floor(rng() * 1e9),
    });
  }

  const angles = (list: number[], out: number) => list.map((t) => edge(t, out));
  return {
    W,
    H,
    cx,
    cy,
    rx,
    ry,
    horizon,
    inside,
    depth: depthAt,
    edge,
    stones,
    frogSpots: angles([2.6, 0.5, 1.9, 3.6, 0.15, 2.95, 1.15, 3.95, 5.6, 4.9], 1),
    reedSpots: angles([2.85, 3.1, 0.35, 0.05, 2.3, 0.8, 3.35, 5.95, 3.7, 1.55, 4.0, 5.5, 2.05, 1.3], 4),
    lanternSpots: angles([3.45, 6.1, 2.45, 0.85], 14),
    turtleRock: edge(5.1, -10),
    waterfall: edge(-1.95, -2),
    gate: edge(-1.2, 18),
    bridge: { x1: cx - rx * 0.62, x2: cx - rx * 0.12, y: cy + ry * 0.05 },
    deck: { x: Math.round(cx + rx * 0.34), y: Math.round(cy + ry * 0.56), w: Math.round(rx * 0.34), h: 11 },
  };
}
