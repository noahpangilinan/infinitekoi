import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/700.css";
import "./style.css";
import { debugState } from "./debug";
import { tick } from "./game/economy";
import { newGame, type GameState } from "./game/state";
import { Renderer } from "./render/renderer";

const PANEL_WIDTH = 360; // the shop on the right; the pond fills the rest
const STEP = 1 / 30;

const params = new URLSearchParams(location.search);
const debug = params.get("debug");
const state: GameState = (debug && debugState(debug)) || newGame();

const canvas = document.getElementById("pond") as HTMLCanvasElement;
const renderer = new Renderer(canvas);
if (params.has("t")) renderer.phaseOverride = Number(params.get("t"));

function resize(): void {
  renderer.resize(Math.max(200, window.innerWidth - PANEL_WIDTH), window.innerHeight);
}
window.addEventListener("resize", resize);
resize();

// Fixed-step simulation, drawing every animation frame.
let last = performance.now();
let acc = 0;
let time = 0;
function loop(now: number): void {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  acc += dt;
  while (acc >= STEP) {
    if (!debug) tick(state, STEP);
    acc -= STEP;
  }
  time += dt;
  renderer.frame(state, time, dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
