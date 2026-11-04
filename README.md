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
- **Twelve producers**, from tadpoles to spirit lights and koi that swim through the
  sky. Each one shows up in the pond.
- **22 restorations** clean up the pond and grow a Japanese garden around it, step by
  step: bamboo fence, flower beds, a green grove, maples, a black pine, hummingbirds,
  a moon-viewing deck and a moon festival. Each boosts production.
- **About 200 upgrades** double producers, power up clicks, link producers together
  and grow with your achievements. Bought ones are listed in the Feats tab.
- **The golden koi** swims through every few minutes. Catch it for a frenzy, a lucky
  windfall or a feeding frenzy.
- **The koi collection**: every koi bought rolls a variety, from kohaku to the rare
  platinum ogon. Each variety found adds +2% production.
- **Achievements** add +1% each.
- **The Dragon Gate**: past 3 quadrillion lifetime ripples (about 6 hours of play), a koi can climb the waterfall
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

Hosted on Netlify, which builds from `main` using `netlify.toml` (tests, then
`npm run build`, publishing `dist/`). GitHub Actions runs the same tests and
build on every push (`.github/workflows/ci.yml`).

### Debug views

Ready-made saves for checking the look, which don't touch your real save:
`?debug=shabby`, `early`, `mid`, `restored`, `late`. Add `&t=0.82` for a time of day
(0 to 1), `&rain=1`, `&theme=sakura` (or `autumn`, `moonlit`), `&stages=12` for that
many restorations, `&tab=feats` to open a tab, or `&ascend=0.7` to freeze the Dragon
Gate scene.

## Layout

```
src/game/      rules: state and saving, economy, golden koi, prestige, offline, data
src/render/    the pond: scene, water, creatures, sprites, weather, day and night
src/ui/        the shop panel, icons, toasts and dialogs
tests/         Vitest tests for the rules
tools/         balance simulator
```
