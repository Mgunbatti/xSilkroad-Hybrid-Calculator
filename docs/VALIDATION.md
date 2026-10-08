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
