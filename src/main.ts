import "@fontsource/tiny5/400.css";
import "./style.css";
import { debugState } from "./debug";
import { ACHIEVEMENTS } from "./game/data/achievements";
import { producer } from "./game/data/producers";
import { upgrade } from "./game/data/upgrades";
import { variety } from "./game/data/varieties";
import { checkAchievements, click, tick } from "./game/economy";
import { catchGolden, tickGolden } from "./game/events";
import { formatNumber as fmt, formatTime } from "./game/format";
import { applyOffline } from "./game/offline";
import { ascend } from "./game/prestige";
import { deserialize, newGame, serialize, type GameState } from "./game/state";
import { toLogical } from "./render/pixels";
import { Renderer } from "./render/renderer";
import { icon } from "./ui/icons";
import { dialog, floatText, toast } from "./ui/overlay";
import { Panel } from "./ui/panel";

const SAVE_KEY = "infinitekoi-save";
const PANEL_WIDTH = 360; // the shop on the right; the pond fills the rest
const STEP = 1 / 30;
const AUTOSAVE = 30;

const params = new URLSearchParams(location.search);
const debug = params.get("debug");

function load(): GameState {
  if (debug) return debugState(debug) ?? newGame();
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) return deserialize(saved);
  } catch {
    // Unreadable or blocked storage: start fresh.
  }
  return newGame();
}

let state = load();

function save(): void {
  if (debug) return;
  state.lastSeen = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, serialize(state));
  } catch {
    // Storage full or blocked; nothing more to do.
  }
}

const canvas = document.getElementById("pond") as HTMLCanvasElement;
const renderer = new Renderer(canvas);
if (params.has("t")) renderer.phaseOverride = Number(params.get("t"));
if (debug && params.has("rain")) renderer.rainOverride = Number(params.get("rain"));
if (debug && params.has("ascend")) renderer.ascensionFreeze = Number(params.get("ascend"));
if (debug && params.has("theme")) state.theme = params.get("theme")!;

const panel = new Panel(document.getElementById("ui")!, state, {
  bought(id, result) {
    for (const v of result.newVarieties) {
      toast("New koi variety!", `${variety(v).name} joins your pond. +2% production.`, icon(`variety-${v}`), variety(v).rare ? "gold" : "");
    }
    if (result.bought > 0 && state.producers[id] === result.bought) {
      toast(`First ${producer(id).name.toLowerCase()}`, producer(id).desc, icon(id));
    }
  },
  upgraded(id) {
    const u = upgrade(id);
    if (u?.restoreStage) toast(u.name, "The pond looks better already.", icon(u.icon));
  },
  ascend() {
    if (renderer.ascending) return;
    // The pond resets at the flash, halfway through the scene.
    renderer.ascend(() => {
      const gained = ascend(state);
      if (gained > 0) {
        toast("Through the Dragon Gate", `A koi became a dragon. +${gained} Dragon Scale${gained === 1 ? "" : "s"}.`, icon("golden"), "gold");
        panel.setState(state);
        save();
      }
    });
  },
  save() {
    save();
    toast("Saved", "Your pond is safe.");
  },
  exportSave: () => serialize(state),
  importSave(text) {
    try {
      state = deserialize(text);
    } catch {
      return false;
    }
    panel.setState(state);
    save();
    toast("Imported", "Welcome back to your pond.");
    return true;
  },
  reset() {
    state = newGame();
    panel.setState(state);
    save();
  },
  setTheme(theme) {
    state.theme = theme;
  },
});

if (debug && params.has("tab")) panel.open(params.get("tab") as Parameters<Panel["open"]>[0]);

// A nudge for brand-new ponds, gone after the first click.
const hint = document.createElement("div");
hint.id = "hint";
hint.textContent = "Click the water to make ripples";
document.body.append(hint);

function resize(): void {
  renderer.resize(Math.max(200, window.innerWidth - PANEL_WIDTH), window.innerHeight);
  const L = renderer.layout;
  hint.style.left = `${L.cx * renderer.vp.scale}px`;
  hint.style.top = `${(L.cy - L.ry - 14) * renderer.vp.scale}px`;
}
window.addEventListener("resize", resize);
resize();

// Pointer: clicks earn ripples, hovering still over the water draws the koi.
canvas.addEventListener("pointermove", (e) => {
  const p = toLogical(canvas, renderer.vp, e.clientX, e.clientY);
  renderer.pointer = { x: p.x, y: p.y, idle: 0, over: true };
});
canvas.addEventListener("pointerleave", () => (renderer.pointer.over = false));
canvas.addEventListener("pointerdown", (e) => {
  const p = toLogical(canvas, renderer.vp, e.clientX, e.clientY);
  if (renderer.clickAt(p.x, p.y) === "golden") {
    const out = catchGolden(state);
    if (!out) return;
    floatText("Golden koi!", e.clientX, e.clientY, "gold");
    if (out.kind === "lucky") toast("Lucky!", `+${fmt(out.amount)} ripples`, icon("golden"), "gold");
    else if (out.kind === "frenzy") toast("Frenzy!", `Production ×${fmt(out.mult)} for ${out.seconds}s`, icon("golden"), "gold");
    else toast("Feeding frenzy!", `Clicks ×${fmt(out.mult)} for ${out.seconds}s`, icon("golden"), "gold");
    return;
  }
  floatText(`+${fmt(click(state))}`, e.clientX, e.clientY);
});

// Earnings while away.
if (!debug) {
  const away = applyOffline(state);
  if (away.seconds > 60 && away.earned > 0) {
    dialog("While you were away", `Your pond rippled on for <b>${formatTime(away.seconds)}</b> and made <b>${fmt(away.earned)}</b> ripples.` +
      (away.counted < away.seconds ? `<br><span class="small">Offline time counts for up to ${formatTime(away.counted)}.</span>` : ""), [{ label: "Lovely" }]);
  }
}
window.addEventListener("beforeunload", save);
document.addEventListener("visibilitychange", () => document.hidden && save());

// The simulation follows the wall clock, so the pond keeps earning while the
// tab is hidden or the window is unfocused. Browsers pause animation frames
// in background tabs and slow timers to once a second (or less), so each
// call catches up on however much real time has passed.
let simLast = Date.now();
let simAcc = 0;
function simulate(): void {
  const now = Date.now();
  simAcc += Math.max(0, (now - simLast) / 1000);
  simLast = now;
  // Fine steps normally; coarser ones after a long throttled gap.
  const step = Math.max(STEP, simAcc / 600);
  while (simAcc >= step) {
    if (!debug) {
      tick(state, step);
      tickGolden(state, step);
    }
    simAcc -= step;
  }
}

let lastSave = Date.now();
function housekeeping(): void {
  const earned = checkAchievements(state);
  if (earned.length > 3) {
    toast(`${earned.length} achievements earned`, `+${earned.length}% production. See the Feats tab.`);
  } else {
    for (const id of earned) {
      const a = ACHIEVEMENTS.find((x) => x.id === id)!;
      toast(`Achievement: ${a.name}`, `${a.desc} +1% production.`);
    }
  }
  if (Date.now() - lastSave > AUTOSAVE * 1000) {
    save();
    lastSave = Date.now();
  }
}

// In the background: keep simulating and saving without drawing.
setInterval(() => {
  if (!document.hidden) return;
  simulate();
  housekeeping();
}, 1000);

// In the foreground: simulate and draw every animation frame.
let last = performance.now();
let time = 0;
let slow = 0;
function loop(now: number): void {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  simulate();
  time += dt;
  slow += dt;
  renderer.pointer.idle += dt;
  renderer.frame(state, time, dt);
  if (slow > 0.1) {
    panel.update(slow);
    hint.classList.toggle("shown", state.clicks === 0 && !debug);
    housekeeping();
    slow = 0;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
