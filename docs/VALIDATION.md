# Validation and assumptions

The authoritative source is the recovered original SR_GameServer.exe document [DAMAGE_FORMULA.md](DAMAGE_FORMULA.md), especially sections 3 and 6.3. It is preserved unchanged. The final TypeScript candidate was subsequently supplied and compared directly: all normal and critical A-E endpoints match the published engine. The server document remains authoritative for float storage, DWORD behavior and conditional minimum damage. Unverified weapon entries in that candidate are not promoted to verified DB values.

## Normal attack descriptors

Chinese spear/glaive 117%, Chinese sword 60%, and Chinese bow 84% are user-confirmed database values from weapon-specific default skill records. The raw database records were not attached to this checkout, so their provenance is the user's confirmation, not an independent database audit. No values are assumed for other weapons. The manual option is provisional until checked against the actual default skill record; its initial 100% is an editable placeholder.

Normal physical attacks ignore active physical skill AP and percentage. Active skills use only the entered descriptor percentage, never multiplied by the normal-attack descriptor. The magical channel uses its own entered descriptor. A full secondary imbue skill with caller scaling is outside this simplified two-channel mode.

## In-game comparisons

Assumptions: normal physical spear/glaive attack, 117% descriptor, displayed AP, maximum level reached equals current level, no extra bonuses, neutral direct multipliers, target ratio 100%. Weapon and neutral modifiers must be confirmed for reproducing any individual game hit. Attack rate is 199 for D/E; missing attack/parry values are not needed for endpoint calculations.

| Test | Attacker | Target | Observed maximum | Theoretical maximum | Difference (model - observed) |
|---|---|---|---:|---:|---:|
| A: calibration/reference | Lv51 STR297 AP1300-1550 | Manyang: Lv1 PD7 PAR1% | 2758 | 2757 | -1 |
| B | Lv51 STR227 AP1185-1410 | Manyang | 2082 | 2082 | 0 |
| C | Same as B | Yeoha: Lv10 PD22 PAR10% | 1888 | 1888 | 0 |
| D | Lv52 STR301 AP1315-1568 AR199 | Bunwang: Lv45 PD221 PAR45% | 1442 | 1441 | -1 |
| E | Same as D | Manyang | 2783 | 2782 | -1 |

A is the first calibration/reference observation, not an independently predicted hit. No benchmark is used to fit a multiplier. Tests assert exact model outputs, not forced equality with game observations. Observed maxima come from finite samples; theoretical endpoints describe the model's full support. An observation above a theoretical endpoint is a discrepancy, not something finite sampling explains. The one-damage differences remain unresolved: displayed AP rounding, native float/x87 operation details or unrecorded inputs may matter. The previous reported E prediction was approximately 2782.

## Target and modifier assumptions

Manyang DB values: Lv1, PD7, MD10, PAR1%, MAR1%, ER27. ER-to-server-parameter-9 (parry) mapping is unverified. The UI explicitly uses assumed parry 100, editable separately. Do not interpret the default distribution or mean as a verified Manyang prediction; parry changes the distribution, not the theoretical endpoints.

Displayed C-screen AP already includes mastery; only added skill AP receives mastery in that mode. Raw mode applies mastery after adding skill AP and clamping endpoints. Balance uses maximum level reached, not the server level cap.

Named bonus rows are convenience labels: enter values there only when their mapping to the same additive avatar/modifier stage is known. Applicable class-3 and party percentages are separate additions based on pre-avatar damage. Advanced fields expose target coefficient, event, attacker/target multipliers and final target ratio. Unavailable values are explicitly neutral (0 percent/event, direct factor 1, target ratio 100%). There are no fitted constants or global basic-attack factor.

The engine preserves documented constants, four-call rand15 distribution, channel-independent rolls, absorption before defense, descriptor and modifier order, physical-only critical hit factor, the second higher-level bonus, balance, channel truncation and final target-ratio DWORD behavior. Float32 stage storage is modeled; this is not a complete x87 emulator or a replay of the native RNG sequence. Unknown skill-variable mappings, special flags, walls, summons, transformed targets, secondary-skill caller rules remain outside this ordinary player calculator.

## Hybrid release v1.0.0

The same engine powers physical-only, magical-only and hybrid calculations. For an ordinary landed attack with at least one enabled channel, a zero final total becomes 1 after summing truncated channels and applying the target ratio (section 6.3). Individual channel values can still be zero; they are never separately promoted to 1. With both channels disabled, the calculator reports 0. This applies equally to normal and critical results, endpoint ranges and simulations.

For hybrid builds, enable both channels and enter their actual AP, mastery, skill percentages and bonuses. Critical affects only the physical channel before truncation. Non-default special hit factors remain unsupported; this release does not add unverified weapon rates or claim full secondary imbue caller emulation.

## Hybrid calculator implementation (2026-10-08)

This section supersedes the older UI/secondary-mode scope statements above. The original binary specification and `engine.js` are unchanged. [HYBRID_FORMULA.md](HYBRID_FORMULA.md) describes the historical input mapping and optional recovered secondary caller precisely. Sword **and blade** normal descriptors are 60% per user requirements. No AttackRate or Parry controls are needed for ranges; internal neutral values do not affect endpoints.

The UI starts without equipment or enabled demo skills. Learned mastery levels are explicit and independent of character level. Physical skills no longer replace normal attacks. All five outputs appear separately, with critical ranges for the four outputs containing physical damage. Character displayed AP can be entered for live validation; alternative-build AP is unavailable in that mode.

### Manyang Lv1, Lv52 character

Recorded STR301, INT148; physical AP1315–1568; magical AP1041–1207; Heuksal/Fire mastery52; Poison Fire Force Lv4 AP187–312, tooltip100%. Target PD7, MD10, both absorption1%. No extra damage buffs were supplied. The calculated balances are 118.36158% and 62.71186%; the recorded 118% / 62% UI values are not substituted for the unrounded stat-derived balances.

| Quantity | Model | Recorded | Model minus recorded |
|---|---:|---:|---:|
| Normal maximum without imbue | 2782 | 2783 | -1 (-0.036%) |
| Normal maximum with imbue | 4952 | 4954 | -2 (-0.040%) |
| Imbue maximum contribution | 2170 | approximately 2171 (difference of observed maxima) | approximately -1 |
| Critical with imbue | 6415–7734 | one hit of 7186 | inside range; not an endpoint validation |

Observed noncritical arrays:

- Off: `[2655,2783,2721,2667,2729,2709,2783,2500,2783]`
- On: `[4954,4666,4697,4658,4954,4717,4612,4954]`

Three values in each array exceed the corresponding theoretical maximum by 1 or 2. These discrepancies are explicitly asserted in tests, not hidden by tolerances or correction factors. The 7186 critical sample is below the model maximum; calling it the verified maximum would be unjustified. Difference-of-maxima is only an analytical contribution estimate, not a paired-roll measurement.

For Set 1/A the user notes the pre-integer result is approximately **2757.64**. Rounding that final value would give 2758, but the documented core conversion truncates to 2757. Rounded displayed AP hiding a fractional underlying AP is another plausible explanation. Neither explanation has been independently established; no global change from truncation to rounding is made. Native float/x87 details and unrecorded inputs remain possible causes.

Validation includes 32 deterministic unit/regression tests and a real Chrome browser test covering the five results, empty defaults, mastery bounds, weapon-switch data preservation, reset, and a 390px mobile viewport. Physical skill/nuke and secondary mode are formula regressions, not additional live-game validations.
