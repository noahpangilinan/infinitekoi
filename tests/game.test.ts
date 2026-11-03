import { describe, expect, it } from "vitest";
import { VARIETIES, rollVariety } from "../src/game/data/varieties";
import { UPGRADES } from "../src/game/data/upgrades";
import {
  availableUpgrades,
  buyProducer,
  buyUpgrade,
  checkAchievements,
  click,
  clickValue,
  costOf,
  maxAffordable,
  restorationLevel,
  rps,
  tick,
} from "../src/game/economy";
import { catchGolden, tickGolden } from "../src/game/events";
import { formatNumber, formatTime } from "../src/game/format";
import { applyOffline } from "../src/game/offline";
import { ascend, buyCelestial, canAscend, GATE_THRESHOLD as G, pendingScales, scalesFor } from "../src/game/prestige";
import { deserialize, newGame, serialize } from "../src/game/state";

// A repeatable random sequence.
function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("costs", () => {
  it("grows 15% per owned", () => {
    expect(costOf("tadpole", 0)).toBe(15);
    expect(costOf("tadpole", 1)).toBe(Math.ceil(15 * 1.15));
    expect(costOf("frog", 10)).toBe(Math.ceil(100 * Math.pow(1.15, 10)));
  });

  it("sums a batch", () => {
    const one = [0, 1, 2].map((n) => 15 * Math.pow(1.15, n)).reduce((a, b) => a + b, 0);
    expect(costOf("tadpole", 0, 3)).toBe(Math.ceil(one));
  });

  it("finds the most you can afford", () => {
    for (const budget of [0, 14, 15, 100, 12345, 1e9]) {
      const n = maxAffordable("frog", 3, budget);
      expect(n === 0 || costOf("frog", 3, n) <= budget).toBe(true);
      expect(costOf("frog", 3, n + 1)).toBeGreaterThan(budget);
    }
  });
});

describe("production", () => {
  it("adds up producers", () => {
    const s = newGame();
    s.producers.tadpole = 10;
    s.producers.frog = 2;
    expect(rps(s)).toBeCloseTo(10 * 0.1 + 2 * 1);
  });

  it("applies tier upgrades, restorations, achievements and scales", () => {
    const s = newGame();
    s.producers.frog = 5;
    s.ripples = 1e9;
    expect(buyUpgrade(s, "frog-1")).toBe(true);
    expect(buyUpgrade(s, "frog-2")).toBe(true);
    expect(rps(s)).toBeCloseTo(5 * 4);
    expect(buyUpgrade(s, "restore-trash")).toBe(true);
    expect(rps(s)).toBeCloseTo(5 * 4 * 1.05);
    s.achievements = ["a", "b"];
    s.scales = 10;
    expect(rps(s)).toBeCloseTo(5 * 4 * 1.05 * 1.02 * 1.1);
  });

  it("applies synergies per source owned", () => {
    const s = newGame();
    s.producers.frog = 20;
    s.producers.lily = 15;
    s.upgrades.push("syn-frog-lily");
    expect(rps(s)).toBeCloseTo(20 * 1 + 15 * 8 * 1.2);
  });

  it("earns over time and from clicks", () => {
    const s = newGame();
    s.producers.frog = 3;
    tick(s, 2);
    expect(s.ripples).toBeCloseTo(6);
    expect(click(s)).toBe(1);
    expect(s.clicks).toBe(1);
    s.upgrades.push("click-1", "click-rps-1");
    expect(clickValue(s)).toBeCloseTo(2 + 0.01 * 3);
  });

  it("does not allow buying what you cannot afford or locked upgrades", () => {
    const s = newGame();
    expect(buyProducer(s, "tadpole", 1).bought).toBe(0);
    s.ripples = 1e12;
    expect(buyUpgrade(s, "frog-1")).toBe(false); // no frogs yet
    expect(buyUpgrade(s, "restore-algae")).toBe(false); // trash first
    expect(availableUpgrades(s)[0].id).toBe("restore-trash");
  });

  it("orders restoration stages", () => {
    const s = newGame();
    s.ripples = 1e12;
    for (const u of UPGRADES.filter((u) => u.restoreStage).sort((a, b) => a.restoreStage! - b.restoreStage!)) {
      expect(buyUpgrade(s, u.id)).toBe(true);
    }
    expect(restorationLevel(s)).toBe(12);
  });
});

describe("koi varieties", () => {
  it("rolls by weight and records discoveries", () => {
    expect(rollVariety(() => 0).id).toBe("kohaku");
    expect(rollVariety(() => 0.9999).id).toBe("platinum");
    const s = newGame();
    s.ripples = 1e9;
    const r = buyProducer(s, "koi", 2, seq(0, 0.5, 0, 0.5));
    expect(r.bought).toBe(2);
    expect(s.koi).toHaveLength(2);
    expect(s.discovered).toEqual(["kohaku"]);
    expect(rps(s)).toBeCloseTo(2 * 47 * 1.02);
  });

  it("makes rare koi likelier with a boost", () => {
    const rng = seq(...Array.from({ length: 1000 }, (_, i) => (i + 0.5) / 1000));
    const count = (boost: number) => Array.from({ length: 1000 }, () => rollVariety(rng, boost)).filter((v) => v.rare).length;
    expect(count(3)).toBeGreaterThan(count(1) * 2);
    expect(VARIETIES.some((v) => v.rare)).toBe(true);
  });
});

describe("golden koi", () => {
  it("appears on schedule and pays out", () => {
    const s = newGame();
    s.golden.nextIn = 1;
    expect(tickGolden(s, 0.5)).toBe(false);
    expect(tickGolden(s, 0.6)).toBe(true);
    s.ripples = 1000;
    s.producers.frog = 10;
    const out = catchGolden(s, seq(0.1, 0.1));
    expect(out?.kind).toBe("lucky");
    expect(s.ripples).toBeCloseTo(1000 + 150 + 13);
    expect(catchGolden(s)).toBeNull(); // gone once caught
  });

  it("frenzy multiplies production for a while", () => {
    const s = newGame();
    s.producers.frog = 10;
    s.golden.timeLeft = 5;
    catchGolden(s, seq(0.1, 0.6));
    expect(rps(s)).toBeCloseTo(70);
    tick(s, 78);
    expect(rps(s)).toBeCloseTo(10);
  });
});

describe("prestige", () => {
  it("gives scales by cube root of lifetime ripples", () => {
    expect(scalesFor(0)).toBe(0);
    expect(scalesFor(G - 1)).toBe(0);
    expect(scalesFor(G)).toBe(1);
    expect(scalesFor(8 * G)).toBe(2);
    expect(scalesFor(1000 * G)).toBe(10);
  });

  it("resets the run but keeps the long-term progress", () => {
    const s = newGame();
    s.lifetimeEarned = 27 * G;
    s.runEarned = 27 * G;
    s.ripples = 5e12;
    s.producers.koi = 40;
    s.upgrades = ["restore-trash", "koi-1"];
    s.achievements = ["click-100"];
    s.discovered = ["kohaku"];
    expect(canAscend(s)).toBe(true);
    expect(ascend(s)).toBe(3);
    expect(s.scales).toBe(3);
    expect(s.ripples).toBe(0);
    expect(s.producers.koi).toBe(0);
    expect(s.upgrades).toEqual([]);
    expect(s.achievements).toEqual(["click-100"]);
    expect(s.discovered).toEqual(["kohaku"]);
    expect(pendingScales(s)).toBe(0);
    expect(ascend(s)).toBe(0);
  });

  it("buys celestial upgrades in order and applies them on reset", () => {
    const s = newGame();
    s.scales = 10;
    expect(buyCelestial(s, "remembered-pond")).toBe(false); // needs moon pearl
    expect(buyCelestial(s, "moon-pearl")).toBe(true);
    expect(buyCelestial(s, "remembered-pond")).toBe(true);
    expect(s.scalesSpent).toBe(4);
    s.lifetimeEarned = 1331 * G; // 11 scales, one more than already held
    ascend(s);
    expect(restorationLevel(s)).toBe(6);
  });
});

describe("offline", () => {
  it("earns half rate, capped at 12 hours", () => {
    const s = newGame(0);
    s.producers.frog = 10;
    expect(applyOffline(s, 100_000).earned).toBeCloseTo(10 * 100 * 0.5);
    s.lastSeen = 0;
    const r = applyOffline(s, 48 * 3600 * 1000);
    expect(r.counted).toBe(12 * 3600);
    expect(r.earned).toBeCloseTo(10 * 12 * 3600 * 0.5);
  });

  it("is improved by celestial upgrades", () => {
    const s = newGame(0);
    s.producers.frog = 1;
    s.celestial = ["moon-pearl", "long-memory"];
    const r = applyOffline(s, 48 * 3600 * 1000);
    expect(r.earned).toBeCloseTo(24 * 3600);
  });
});

describe("saving", () => {
  it("round-trips", () => {
    const s = newGame(1);
    s.ripples = 123.5;
    s.producers.koi = 7;
    s.koi.push({ variety: "sanke", seed: 42 });
    expect(deserialize(serialize(s), 1)).toEqual(s);
  });

  it("fills in fields missing from older saves", () => {
    const old = btoa(JSON.stringify({ ripples: 50, producers: { frog: 2 } }));
    const s = deserialize(old, 5);
    expect(s.ripples).toBe(50);
    expect(s.producers.frog).toBe(2);
    expect(s.producers.koi).toBe(0);
    expect(s.golden.nextIn).toBeGreaterThan(0);
    expect(s.celestial).toEqual([]);
  });

  it("rejects garbage", () => {
    expect(() => deserialize("not a save")).toThrow();
  });
});

describe("achievements", () => {
  it("records each once", () => {
    const s = newGame();
    s.runEarned = 150;
    s.producers.frog = 1;
    const first = checkAchievements(s);
    expect(first).toContain("earn-100");
    expect(first).toContain("own-frog-1");
    expect(checkAchievements(s)).toEqual([]);
  });
});

describe("formatting", () => {
  it("shortens big numbers", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(1.5)).toBe("1.5");
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(1234)).toBe("1.234 K");
    expect(formatNumber(56_700_000)).toBe("56.70 M");
    expect(formatNumber(1e15)).toBe("1.000 Qa");
    expect(formatNumber(1e80)).toMatch(/e80$/);
  });

  it("formats durations", () => {
    expect(formatTime(5)).toBe("5s");
    expect(formatTime(125)).toBe("2m 5s");
    expect(formatTime(3 * 3600 + 120)).toBe("3h 2m");
  });
});
