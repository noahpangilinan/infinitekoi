import { ACHIEVEMENTS } from "../game/data/achievements";
import { CELESTIAL } from "../game/data/celestial";
import { PRODUCERS, type ProducerId } from "../game/data/producers";
import { upgrade, UPGRADES, type UpgradeDef, type UpgradeKind } from "../game/data/upgrades";
import { VARIETIES } from "../game/data/varieties";
import {
  availableUpgrades,
  buffMult,
  buyProducer,
  buyUpgrade,
  costOf,
  globalMult,
  maxAffordable,
  producerRate,
  rps,
  type BuyResult,
} from "../game/economy";
import { formatNumber as fmt, formatTime } from "../game/format";
import {
  buyCelestial,
  canAscend,
  canBuyCelestial,
  nextScaleAt,
  pendingScales,
  scalesAvailable,
  unlockedThemes,
} from "../game/prestige";
import { hasCelestial, type GameState } from "../game/state";
import { clear, h } from "./dom";
import { icon } from "./icons";
import { dialog, hideTip, showTip } from "./overlay";

// The shop panel on the right: ripples, tabs, producers and upgrades.

export interface PanelHooks {
  bought(id: ProducerId, result: BuyResult): void;
  upgraded(id: string): void;
  ascend(): void;
  save(): void;
  exportSave(): string;
  importSave(text: string): boolean;
  reset(): void;
  setTheme(theme: string): void;
}

type Tab = "pond" | "koi" | "feats" | "gate" | "options";
const TABS: [Tab, string][] = [["pond", "Pond"], ["koi", "Koi"], ["feats", "Feats"], ["gate", "Gate"], ["options", "Options"]];

const KIND_NAMES: [UpgradeKind, string][] = [
  ["restore", "Restoration"],
  ["producer", "Pond life"],
  ["click", "Clicks"],
  ["synergy", "Synergies"],
  ["golden", "Golden koi"],
  ["harmony", "Harmony"],
];

const THEME_NAMES: Record<string, string> = { classic: "Classic", moonlit: "Moonlit", autumn: "Autumn", sakura: "Sakura" };

export class Panel {
  private tab: Tab = "pond";
  private ripplesEl = h("div", { class: "ripples" });
  private rateEl = h("div", { class: "rate" });
  private buffsEl = h("div", { class: "buffs" });
  private tabEls = new Map<Tab, HTMLButtonElement>();
  private body = h("div", { class: "body" });
  private structureKey = "";
  private rows = new Map<ProducerId, { row: HTMLElement; owned: HTMLElement; cost: HTMLElement }>();
  private upgradeEls = new Map<string, HTMLElement>();
  private slowClock = 0;

  constructor(root: HTMLElement, private state: GameState, private hooks: PanelHooks) {
    const tabs = h("nav", { class: "tabs" });
    for (const [id, label] of TABS) {
      const b = h("button", { onclick: () => this.open(id) }, label);
      this.tabEls.set(id, b);
      tabs.append(b);
    }
    root.append(
      h("header", {}, h("div", { class: "title" }, "Infinite Koi"), this.ripplesEl, this.rateEl, this.buffsEl),
      tabs,
      this.body,
    );
    this.open("pond");
  }

  setState(state: GameState): void {
    this.state = state;
    this.structureKey = "";
    this.render();
  }

  open(tab: Tab): void {
    this.tab = tab;
    for (const [id, el] of this.tabEls) el.classList.toggle("on", id === tab);
    this.structureKey = "";
    this.render();
  }

  // Called often: cheap text updates, rebuilding only when the shop changes.
  update(dt: number): void {
    const s = this.state;
    this.ripplesEl.textContent = `${fmt(s.ripples)} ripples`;
    this.rateEl.textContent = `${fmt(rps(s))} per second`;
    const buffs = s.buffs.map((b) => `${b.kind === "frenzy" ? "Frenzy" : "Feeding frenzy"} ×${fmt(b.mult)} · ${Math.ceil(b.timeLeft)}s`);
    this.buffsEl.textContent = buffs.join("  ");
    this.tabEls.get("gate")!.classList.toggle("glow", canAscend(s));

    this.slowClock += dt;
    const key =
      this.tab === "pond" ? this.pondKey()
      : this.tab === "feats" ? `feats:${s.achievements.length}:${s.upgrades.length}`
      : this.tab;
    if (key !== this.structureKey) {
      this.structureKey = key;
      this.render();
    } else if (this.tab === "pond") {
      this.refreshPond();
    } else if (this.slowClock > 1 && this.tab !== "options" && this.tab !== "feats") {
      this.slowClock = 0;
      this.render();
    }
  }

  // ---- Pond tab -----------------------------------------------------------

  private revealedCount(): number {
    // Producers you own or can nearly afford are shown; the next one is "???".
    const s = this.state;
    let shown = 0;
    PRODUCERS.forEach((p, i) => {
      if (s.producers[p.id] > 0 || s.runEarned >= p.baseCost * 0.6) shown = i + 1;
    });
    return Math.min(PRODUCERS.length, Math.max(1, shown));
  }

  private pondKey(): string {
    return `pond:${this.revealedCount()}:${availableUpgrades(this.state).map((u) => u.id).join(",")}:${this.state.buyAmount}`;
  }

  private amountFor(id: ProducerId): number {
    const s = this.state;
    return s.buyAmount < 0 ? Math.max(1, maxAffordable(id, s.producers[id], s.ripples)) : s.buyAmount;
  }

  private renderPond(): void {
    const s = this.state;
    this.rows.clear();
    this.upgradeEls.clear();
    const ups = availableUpgrades(s).slice(0, 24);
    const grid = h("div", { class: "upgrades" });
    for (const u of ups) {
      const b = h("button", {
        class: `upg kind-${u.kind}`,
        onclick: () => {
          if (buyUpgrade(s, u.id)) {
            hideTip();
            this.hooks.upgraded(u.id);
          }
        },
        onmouseenter: (e: Event) => this.upgradeTip(u, e as MouseEvent),
        onmousemove: (e: Event) => this.upgradeTip(u, e as MouseEvent),
        onmouseleave: hideTip,
      }, h("img", { src: icon(u.icon), alt: u.name }));
      this.upgradeEls.set(u.id, b);
      grid.append(b);
    }

    const amounts = h("div", { class: "amounts" });
    for (const [n, label] of [[1, "×1"], [10, "×10"], [100, "×100"], [-1, "Max"]] as const) {
      amounts.append(h("button", { class: s.buyAmount === n ? "on" : "", onclick: () => { s.buyAmount = n; } }, label));
    }

    const list = h("div", { class: "producers" });
    const revealed = this.revealedCount();
    PRODUCERS.forEach((p, i) => {
      if (i > revealed) return;
      if (i === revealed) {
        list.append(h("div", { class: "prod locked" }, h("div", { class: "pic mystery" }, "?"), h("div", { class: "info" }, h("div", { class: "name" }, "???"), h("div", { class: "cost" }, `${fmt(p.baseCost)}`))));
        return;
      }
      const owned = h("div", { class: "owned" });
      const cost = h("div", { class: "cost" });
      const row = h("button", {
        class: "prod",
        onclick: () => {
          const r = buyProducer(s, p.id, this.amountFor(p.id));
          if (r.bought > 0) this.hooks.bought(p.id, r);
          this.refreshPond();
        },
        onmouseenter: (e: Event) => this.producerTip(p.id, e as MouseEvent),
        onmousemove: (e: Event) => this.producerTip(p.id, e as MouseEvent),
        onmouseleave: hideTip,
      }, h("img", { class: "pic", src: icon(p.id), alt: "" }), h("div", { class: "info" }, h("div", { class: "name" }, p.name), cost), owned);
      this.rows.set(p.id, { row, owned, cost });
      list.append(row);
    });

    clear(this.body);
    if (ups.length) this.body.append(h("h3", {}, "Upgrades"), grid);
    this.body.append(h("div", { class: "row-head" }, h("h3", {}, "Pond life"), amounts), list);
    this.refreshPond();
  }

  private refreshPond(): void {
    const s = this.state;
    for (const [id, r] of this.rows) {
      const n = this.amountFor(id);
      const price = costOf(id, s.producers[id], n);
      r.cost.textContent = `${fmt(price)}${n > 1 ? `  (×${n})` : ""}`;
      r.owned.textContent = s.producers[id] ? String(s.producers[id]) : "";
      r.row.classList.toggle("poor", price > s.ripples);
    }
    for (const [id, el] of this.upgradeEls) el.classList.toggle("poor", (upgrade(id)?.cost ?? 0) > s.ripples);
  }

  private upgradeTip(u: UpgradeDef, e: MouseEvent, owned = false): void {
    if (owned) {
      showTip(`<b>${u.name}</b><p>${u.desc}</p><div class="good">Owned</div>`, e.clientX, e.clientY);
      return;
    }
    const poor = u.cost > this.state.ripples;
    showTip(`<b>${u.name}</b><p>${u.desc}</p><div class="${poor ? "bad" : "good"}">${fmt(u.cost)} ripples</div>`, e.clientX, e.clientY);
  }

  private producerTip(id: ProducerId, e: MouseEvent): void {
    const s = this.state;
    const p = PRODUCERS.find((x) => x.id === id)!;
    const each = producerRate(s, id) * globalMult(s) * buffMult(s, "frenzy");
    const total = each * s.producers[id];
    const share = rps(s) > 0 ? (total / rps(s)) * 100 : 0;
    showTip(
      `<b>${p.name}</b><p>${p.desc}</p>` +
        `<div>Each makes <b>${fmt(each)}</b>/s</div>` +
        (s.producers[id] ? `<div>${s.producers[id]} make <b>${fmt(total)}</b>/s (${share.toFixed(1)}%)</div>` : ""),
      e.clientX,
      e.clientY,
    );
  }

  // ---- Other tabs ---------------------------------------------------------

  private renderKoi(): void {
    const s = this.state;
    const grid = h("div", { class: "cards" });
    for (const v of VARIETIES) {
      const found = s.discovered.includes(v.id);
      grid.append(h("div", { class: `card ${found ? "" : "unknown"} ${v.rare ? "rare" : ""}` },
        found ? h("img", { src: icon(`variety-${v.id}`), alt: "" }) : h("div", { class: "pic mystery" }, "?"),
        h("div", { class: "name" }, found ? v.name : "Undiscovered"),
        h("div", { class: "small" }, v.rare ? "Rare" : "Common")));
    }
    this.body.append(
      h("h3", {}, "Koi collection"),
      h("p", { class: "small" }, `${s.discovered.length} / ${VARIETIES.length} varieties found. Each one adds +2% to all production. Every koi you buy is a surprise.`),
      grid,
    );
  }

  private renderFeats(): void {
    const s = this.state;
    const grid = h("div", { class: "feats" });
    for (const a of ACHIEVEMENTS) {
      const got = s.achievements.includes(a.id);
      grid.append(h("div", {
        class: `feat ${got ? "got" : ""}`,
        onmouseenter: (e: Event) => showTip(`<b>${got ? a.name : "Locked"}</b><p>${a.desc}</p>`, (e as MouseEvent).clientX, (e as MouseEvent).clientY),
        onmouseleave: hideTip,
      }));
    }
    this.body.append(
      h("h3", {}, "Achievements"),
      h("p", { class: "small" }, `${s.achievements.length} / ${ACHIEVEMENTS.length} earned. Each adds +1% to all production.`),
      grid,
    );
    this.renderOwnedUpgrades();
  }

  // Every upgrade bought this run, grouped by kind.
  private renderOwnedUpgrades(): void {
    const s = this.state;
    const owned = UPGRADES.filter((u) => s.upgrades.includes(u.id));
    this.body.append(
      h("h3", {}, "Upgrades owned"),
      h("p", { class: "small" }, owned.length
        ? `${owned.length} / ${UPGRADES.length} bought this run.`
        : "None yet. Upgrades appear above the pond life in the Pond tab."),
    );
    for (const [kind, label] of KIND_NAMES) {
      const group = owned.filter((u) => u.kind === kind);
      if (!group.length) continue;
      const grid = h("div", { class: "upgrades" });
      for (const u of group) {
        grid.append(h("div", {
          class: `upg kind-${u.kind}`,
          onmouseenter: (e: Event) => this.upgradeTip(u, e as MouseEvent, true),
          onmousemove: (e: Event) => this.upgradeTip(u, e as MouseEvent, true),
          onmouseleave: hideTip,
        }, h("img", { src: icon(u.icon), alt: u.name })));
      }
      this.body.append(h("div", { class: "small group-label" }, `${label} · ${group.length}`), grid);
    }
  }

  private renderGate(): void {
    const s = this.state;
    const pending = pendingScales(s);
    const next = nextScaleAt(s);
    const progress = Math.min(1, s.lifetimeEarned / next);
    const bar = h("div", { class: "bar" }, h("div", { class: "fill" }));
    (bar.firstChild as HTMLElement).style.width = `${progress * 100}%`;
    const tree = h("div", { class: "celestial" });
    for (const c of CELESTIAL) {
      const owned = hasCelestial(s, c.id);
      const locked = !c.requires.every((r) => hasCelestial(s, r));
      const can = canBuyCelestial(s, c.id);
      tree.append(h("button", {
        class: `node ${owned ? "owned" : locked ? "locked" : can ? "" : "poor"}`,
        onclick: () => {
          if (buyCelestial(s, c.id)) this.render();
        },
      }, h("b", {}, c.name), h("span", {}, c.desc), h("em", {}, owned ? "Owned" : locked ? "Locked" : `${c.cost} scale${c.cost > 1 ? "s" : ""}`)));
    }
    this.body.append(
      h("h3", {}, "The Dragon Gate"),
      h("p", { class: "small" }, "A koi that climbs the waterfall becomes a dragon. Ascending starts the pond over, but every Dragon Scale you earn adds +1% to production forever, and can be spent in the Celestial Pond."),
      h("div", { class: "gate-stats" },
        h("div", {}, `Dragon Scales: ${s.scales} (${scalesAvailable(s)} to spend)`),
        h("div", {}, `Ascensions: ${s.ascensions}`),
        h("div", {}, `Next scale at ${fmt(next)} lifetime ripples`)),
      bar,
      h("button", {
        class: "ascend",
        disabled: !canAscend(s),
        onclick: () => dialog("Climb the Dragon Gate?", `Your pond will start over. You will gain <b>${pending}</b> Dragon Scale${pending === 1 ? "" : "s"}. Achievements, koi varieties found and the Celestial Pond are kept.`, [
          { label: "Not yet" },
          { label: "Ascend", tone: "gold", action: () => this.hooks.ascend() },
        ]),
      }, canAscend(s) ? `Ascend  (+${pending} scale${pending === 1 ? "" : "s"})` : "The gate is closed"),
      h("h3", {}, "Celestial Pond"),
      tree,
    );
  }

  private renderOptions(): void {
    const s = this.state;
    const themes = h("div", { class: "amounts" });
    for (const t of unlockedThemes(s)) {
      themes.append(h("button", { class: s.theme === t ? "on" : "", onclick: () => { this.hooks.setTheme(t); this.render(); } }, THEME_NAMES[t] ?? t));
    }
    const box = h("textarea", { rows: 4, spellcheck: "false", placeholder: "Paste a save here to import it" }) as HTMLTextAreaElement;
    this.body.append(
      h("h3", {}, "Pond theme"),
      themes,
      h("h3", {}, "Save"),
      h("div", { class: "amounts" },
        h("button", { onclick: () => this.hooks.save() }, "Save now"),
        h("button", { onclick: () => { box.value = this.hooks.exportSave(); box.select(); } }, "Export"),
        h("button", { onclick: () => { if (!this.hooks.importSave(box.value)) box.value = "That doesn't look like a save."; } }, "Import")),
      box,
      h("h3", {}, "Stats"),
      h("div", { class: "stats" },
        h("div", {}, `Ripples this run: ${fmt(s.runEarned)}`),
        h("div", {}, `Ripples all time: ${fmt(s.lifetimeEarned)}`),
        h("div", {}, `Clicks: ${fmt(s.clicks)} (${fmt(s.clickEarned)} ripples)`),
        h("div", {}, `Golden koi caught: ${s.goldenClicks}`),
        h("div", {}, `This run: ${formatTime(s.runTime)} · All time: ${formatTime(s.playTime)}`)),
      h("button", {
        class: "danger",
        onclick: () => dialog("Wipe everything?", "This deletes your pond, scales and collection for good.", [
          { label: "Keep it" },
          { label: "Wipe", tone: "danger", action: () => this.hooks.reset() },
        ]),
      }, "Hard reset"),
    );
  }

  render(): void {
    hideTip();
    clear(this.body);
    if (this.tab === "pond") this.renderPond();
    else if (this.tab === "koi") this.renderKoi();
    else if (this.tab === "feats") this.renderFeats();
    else if (this.tab === "gate") this.renderGate();
    else this.renderOptions();
  }
}
