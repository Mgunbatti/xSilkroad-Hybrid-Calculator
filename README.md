# Silkroad Damage Simulator

Static, English-only ordinary player damage simulator for GitHub Pages. Open `index.html` locally or serve the repository root. No build, dependencies, API keys, or backend.

## Source and input conventions

The engine follows `docs/DAMAGE_FORMULA.md`, sections 3 and 6.3. The attached source is included unchanged. Physical and magical channels have independent four-call rolls: minimum of three discrete inclusive 15-bit samples, followed by an independent parity coin, then interpolation clamping.

The website defaults to **character-window AP**, following the user's supplied clarification:

```
lo = displayedMin + skillMin * (1 + mastery / 100)
hi = displayedMax + skillMax * (1 + mastery / 100)
```

Mastery must not be applied twice to displayed AP. Raw AP mode instead adds skill AP, clamps endpoints before mastery, and applies mastery to the complete endpoint, as in section 3.2. Do not infer internal AP precision from rounded character-window values.

The starting build is the supplied Lv3 / STR28 / INT22 / displayed physical AP24–29 / mastery3 / attack rate37 / Manyang test. Its physical attack descriptor is **130%**, as supplied by the user. This is an editable fixture value, not a universal basic-attack constant. Magical descriptor starts at 100%, and magical damage is disabled until selected.

Manyang: level1, physical defense7, magical defense10, parry27, both absorption values0. All target coefficients and attacker/target multipliers are neutral1; event0; target ratio100. Compatible named item bonuses add within each channel. Item names are UI mappings, not binary-proven ownership of parameter IDs.

The channel order is endpoints → mastery → roll/interpolation → absorption → defense floor → descriptor percent → attacker bonus → target coefficient → event → hit factor → second level bonus → attacker balance → final multipliers → clamp/truncate. The total sums integer cores before target-ratio scaling. Critical doubles the physical hit factor before truncation and leaves magical damage unchanged.

## Validation

Run `npm test` (or `node --test tests/engine.test.cjs tests/live-game.cjs`). Run `npm run test:live` for the supplied live fixture alone. Tests include explicit ordered-stage golden values, raw/displayed AP mapping, four-draw RNG, independent channels, critical/truncation, neutral defaults, caps, zero multipliers, level/balance clamps, final ratio and Parry266 versus520.

With the clarified live inputs, the full theoretical normal range is **18–24**, critical37–48. A seeded 100,000-hit run gives mean22.18648: 98.63% of hits fall in19–24; 45.922% fall in23–24; 1.37% are18. A seeded30-hit example yields19–24. These are simulated results, not a claim of replaying the game's RNG. The observed game sample19–24 is compatible with this distribution, but does not establish that18 is impossible. The tests preserve the rare18 rather than falsifying the theoretical minimum.

The screen separates theoretical ranges from the observed sample range. Average Damage is the normal-hit sample mean for the selected100/1,000/10,000 simulation. It is not a midpoint or a critical mixture.

## Numerical scope

JavaScript implements the documented ordinary finite arithmetic with float32 stage storage, exact stored constants and final truncation. It does not emulate x87 extended precision or the native C rand sequence; byte-for-byte identity at every floating-point edge requires comparison against the original executable. The input RNG distribution faithfully models uniform integer rand values0..32767.

The core API accepts direct target coefficient, event, attacker multiplier, target multiplier and target ratio. Zero direct coefficients/multipliers use1. The final ratio preserves the source's DWORD product behavior. Range reporting rejects non-neutral settings that cause DWORD overflow; the default ratio100 cannot overflow the sum of two capped channels. Special flags, party/class bonuses, walls, summons, life steal, and conditional caller promotion of zero to1 are outside the default ordinary calculator path. Core zero damage is retained.

## GitHub Pages

Keep `index.html`, `style.css`, `app.js`, `engine.js`, `.nojekyll`, and `docs/` together at the publishing root. Existing Pages branch publishing can serve these files directly. All asset paths are relative so project URLs work. Tests and this readme do not require deployment configuration changes.
