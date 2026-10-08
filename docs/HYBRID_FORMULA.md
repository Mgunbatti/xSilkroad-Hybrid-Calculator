# Hybrid adapter formula

`engine.js` is unchanged. `hybrid-engine.js` maps user inputs to the existing core and returns independent `normal`, `physicalSkill`, `nuke`, `normalImbue`, and `physicalSkillImbue` ranges. Unconfigured results are null, never sample equipment values.

## AP and mastery mapping

The UI records separate learned weapon, imbue-element and nuke-element mastery levels, each an integer in [0, character level]. M = 1 + masteryLevel/100. They are not character level or tooltip SkillRate. Normal weapon choices affect only normal and normal+imbue outputs.

Physical displayed AP already includes physical mastery. Active physical skill endpoints are therefore `displayedPhysicalAP + PhysicalSkillAP * physicalM`. Normal attacks add no physical skill AP. Magical inputs are the base before the selected elemental mastery: imbue/nuke use core raw mode, `clamp(MagicalAP + SkillAP, 0, 999999) * elementalM`. This preserves the raw endpoint cap and float stages. If a server displays magical AP already including that element's mastery, those values must not be entered as the pre-element base.

Tooltip AP retains the existing estimate `round(weaponAP + stat * reinforcementPercent/100)`; exact hidden item rounding and mastery ownership of tooltip-derived AP remain unverified. Displayed AP mode makes recorded in-game AP usable without reverse-engineering weapon values. It cannot extrapolate AP to alternate stat distributions, so only the selected build is calculated in that mode.

## Default historical attack mapping

The user's historical equations motivate input mapping, not replacement of binary arithmetic:

```
Physical endpoint = displayedPhysicalAP + PhysicalSkillAP * physicalM
Magical endpoint  = (MagicalAP + ImbueAP) * imbueElementM
Physical SkillRate = normal descriptor OR active physical skill's own rate
Imbue SkillRate    = that same attacking rate
Nuke SkillRate     = nuke's own rate
```

The imbue's standalone 100% tooltip is not substituted for the attacking SkillRate and is not multiplied into it. In this mode its descriptor-rate field is hidden. Nuke has no imbue contribution. Physical skills and nukes never acquire the 60/117/84 normal descriptor.

For every channel, the unchanged core performs absorption as `V / (1 + absorption/100)`, then subtracts defense, clamps to zero, applies the descriptor rate and bonuses, physical-only critical flag, level bonus, balance, and final multipliers, preserving float32 stage stores. It truncates each channel before summation and promotes only a zero final landed total to one. Thus critical is conceptually `2*Phys+Mag`, but doubling the already-truncated physical result can differ by one.

The forum's 1.28 is its example level multiplier, not a universal constant. The recovered core uses `1 + clamp(float32(levelDifference * 0.029999999329447746), 0, 0.30000001192092896)` for a higher-level attacker. Lv52 vs Lv1 consequently uses approximately 1.30. The forum's 3.50 is that physical skill's actual rate; Heuksal normal is 1.17. No fitted level or damage constants are introduced.

## Explicit recovered secondary mode

[DAMAGE_FORMULA.md §6.2](DAMAGE_FORMULA.md#62-secondary-skill-contribution) is a different caller path. Do not infer `+0x10` from primary `+0x04`. This advanced mode requires the normal and, if enabled, physical skill **secondary descriptor percentages**. The imbue uses its own main descriptor rate (100% for the supplied Poison Fire Force example). Each secondary core truncates first, then the primary secondary percentage scales the integer sum:

```
secondaryMastery = primaryMastery
if primaryMastery > 90:
    secondaryMastery = secondaryMasteryLevel > 90 ? secondaryMasteryLevel : 90
secondary = magicalCore(imbue, secondaryMastery)
added = trunc(lowDWORD(secondary * primarySecondaryPercent) / 100)
total = physicalCore + added
```

The range adapter rejects DWORD-overflow configurations rather than reporting invalid monotone endpoints. A zero secondary percentage contributes nothing. Component metadata in the binary is unscaled while the final total is scaled; this adapter returns totals, not a misleading component sum. Non-neutral target coefficient selection, down attacks, walls, special flags, secondary physical damage and monster callers remain outside this ordinary player UI. Binary-caller selection is not claimed as independently confirmed for the user's live server; the user-requested historical mapping remains the default.
