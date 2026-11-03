# Infinite Koi

A pixel-art idle game about bringing a neglected pond back to life.

It starts murky and shabby: a tyre in the water, algae on the stones, a grey sky over
dead grass. Click the water to make ripples, spend them on tadpoles, frogs, lily pads
and koi, and restore the pond stage by stage until it's a garden pond under clear skies
with a waterfall, a red bridge and a shrine gate.

Everything you see is drawn by code at about 400×225 pixels and scaled up crisp, so
every koi you buy has its own pattern.

## How it plays

- **Ripples** are the currency. Click the water, or let your pond life make them.
- **Ten producers**, from tadpoles to shrine gates. Each one shows up in the pond.
- **Restoration upgrades** clean up the pond a step at a time and boost production.
- **Upgrades** double producers, power up clicks and link producers together.
- **The golden koi** swims through every few minutes. Catch it for a frenzy, a lucky
  windfall or a feeding frenzy.
- **The koi collection**: every koi bought rolls a variety, from kohaku to the rare
  platinum ogon. Each variety found adds +2% production.
- **Achievements** add +1% each.
- **The Dragon Gate**: past 5 trillion lifetime ripples, a koi can climb the waterfall
  and become a dragon. The pond starts over, and you keep Dragon Scales: +1%
  production each, spent in the Celestial Pond on permanent upgrades and new themes.
- A 12-minute day and night cycle, rain showers, fireflies and lantern light.
- Autosaves to your browser, earns while you're away (50%, up to 12 hours), and
  saves can be exported and imported from the Options tab.

## Running it

Needs Node 22.

```
npm install
npm run dev        # play at http://localhost:5173
npm test           # game rules
npm run build      # static site in dist/
npm run balance    # headless greedy player, prints time to each milestone
```

Pushing to `main` builds and publishes to GitHub Pages
(`.github/workflows/pages.yml`). In the repo settings, set **Pages → Source** to
**GitHub Actions** once.

### Debug views

Ready-made saves for checking the look, which don't touch your real save:
`?debug=shabby`, `early`, `mid`, `restored`, `late`. Add `&t=0.82` for a time of day
(0 to 1), `&rain=1`, `&theme=sakura` (or `autumn`, `moonlit`), or `&ascend=0.7` to
freeze the Dragon Gate scene.

## Layout

```
src/game/      rules: state and saving, economy, golden koi, prestige, offline, data
src/render/    the pond: scene, water, creatures, sprites, weather, day and night
src/ui/        the shop panel, icons, toasts and dialogs
tests/         Vitest tests for the rules
tools/         balance simulator
```
