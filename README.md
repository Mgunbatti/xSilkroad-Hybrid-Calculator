# xSilkroad Damage Calculator

Existing English-only GitHub Pages calculator. The responsive interface, charts and formula link are preserved. Static HTML/CSS/JavaScript; no dependencies or bundler.

- [Live calculator](https://mgunbatti.github.io/xSilkroad-Hybrid-Calculator/)
- [Recovered server formula](docs/DAMAGE_FORMULA.md)
- [Benchmarks and assumptions](docs/VALIDATION.md)

Normal attacks select weapon-specific default descriptors: Chinese spear/glaive 117%, sword 60%, bow 84%, based on the user's DB confirmations. Other weapons require a manual provisional value. Active skills accept user AP, descriptor percentage and mastery without multiplying a basic-attack percentage. Displayed AP already includes mastery; only added skill AP receives mastery in that mode.

Manyang defaults to Lv1, PD7, MD10, PAR/MAR 1%. Parry 100 is explicitly an assumption, not a mapping of DB ER27. Edit it before relying on simulated distributions. Advanced unknown modifiers have visible neutral defaults.

## Verification

`npm test` or `node --test tests/engine.test.cjs tests/live-game.cjs` runs deterministic engine and benchmark regressions. `npm run build` syntax-checks the static scripts; there is no generated bundle. Open index.html or serve the repository root for browser testing.

The benchmarks produce theoretical maxima 2757, 2082, 1888, 1441 and 2782; observations are 2758, 2082, 1888, 1442 and 2783. A is calibration/reference, not independent prediction. One-damage discrepancies are documented and not corrected with fitted constants.

## Deployment

The existing GitHub Pages build publishes main. Keep index.html, style.css, app.js, engine.js, .nojekyll and docs together at the root. All links remain relative. No repository or deployment redesign is required.
