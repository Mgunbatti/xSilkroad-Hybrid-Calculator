# SR_GameServer damage formula

## 1. Reference and reading conventions

This document describes the calculation paths recovered from the original Windows x86 GameServer. It includes function entry addresses, RVAs, short original IDA assembly excerpts, calculation constants, and the order in which damage modifiers are applied.

| Property | Value |
|---|---|
| Reference executable | `SR_GameServer.exe` |
| SHA-256 | `A621B7193F0A6AD0A44CEC151EE8A6E69797BE2751CD5FDF05168D0BB7DD59B6` |
| Architecture | Windows x86, 32-bit |
| Preferred image base | `0x00480000` |
| RVA calculation | `RVA = IDA EA - 0x00480000` |
| Scope | Ordinary physical/magical hits, protection walls, summon damage, special damage helpers, and final per-hit modifiers |

**CONFIRMED:** Function addresses, excerpted instructions, stored numeric constants, and image-base arithmetic are binary evidence. **STRONG:** Descriptive function roles and readable equations are interpretations of that evidence. Descriptive names in this document are reconstructed names, not claims that the executable contains those original symbols. Unresolved field meanings are explicitly identified.

`A` means attacker; `T` means target; `P(X,n)` means character parameter ID `n`; `F` means hit flags; `M` means the mastery **BYTE passed to the formula**; `L(X)` means the BYTE level returned by the level getter. `Q(X)` means its BYTE maximum-level getter. `clamp(x,a,b)` limits finite `x` to `[a,b]`; `trunc` means conversion toward zero. `NZ(x)` means use `x` when nonzero, otherwise use `1`.

The equations describe calculation order, not an interchangeable single expression. The original uses x87 arithmetic, float stores between stages, integer wraparound, and callback-driven parameter reads. Keep the float stores and operation order when reproducing exact results. The equations assume ordinary finite parameters; they do not add protection against zero denominators, NaNs, invalid random ranges, or descriptor replacement during callbacks.

## 2. Function address index

| Role (descriptive) | Original IDA function label | Entry EA | RVA |
|---|---|---|---|
| Maximum-HP percentage damage | `sub_492BA0` | `0x00492BA0` | `0x00012BA0` |
| Random level damage | `sub_492C00` | `0x00492C00` | `0x00012C00` |
| Random physical weapon power | `sub_492C40` | `0x00492C40` | `0x00012C40` |
| Random magical weapon power | `sub_492CA0` | `0x00492CA0` | `0x00012CA0` |
| Weapon/type coefficient damage | `sub_492D00` | `0x00492D00` | `0x00012D00` |
| Attack-descriptor-only random damage | `sub_4930E0` | `0x004930E0` | `0x000130E0` |
| Target damage-coefficient selection | `sub_493260` | `0x00493260` | `0x00013260` |
| Target hit-rating coefficient selection | `sub_493330` | `0x00493330` | `0x00013330` |
| Float clamp helper | `sub_493470` | `0x00493470` | `0x00013470` |
| Physical attack endpoint | `sub_4935D0` | `0x004935D0` | `0x000135D0` |
| Magical attack endpoint | `sub_493690` | `0x00493690` | `0x00013690` |
| Absolute skill damage | `sub_493750` | `0x00493750` | `0x00013750` |
| Level-difference bonus | `sub_4938F0` | `0x004938F0` | `0x000138F0` |
| Attack/parry interpolation ratio | `sub_493970` | `0x00493970` | `0x00013970` |
| Physical STR/max-level balance factor | `sub_494080` | `0x00494080` | `0x00014080` |
| Magical INT/max-level balance factor | `sub_494140` | `0x00494140` | `0x00014140` |
| Weapon-based life-steal/heal bonus | `sub_494490` | `0x00494490` | `0x00014490` |
| Summon physical damage | `sub_494530` | `0x00494530` | `0x00014530` |
| Summon magical damage | `sub_4946F0` | `0x004946F0` | `0x000146F0` |
| Life-steal hit value | `sub_4948B0` | `0x004948B0` | `0x000148B0` |
| Physical damage variation | `sub_494E40` | `0x00494E40` | `0x00014E40` |
| Magical damage variation | `sub_4951E0` | `0x004951E0` | `0x000151E0` |
| Ordinary physical damage with hit flags | `sub_495670` | `0x00495670` | `0x00015670` |
| Ordinary magical damage with hit flags | `sub_495B30` | `0x00495B30` | `0x00015B30` |
| Physical protection-wall damage | `sub_495EF0` | `0x00495EF0` | `0x00015EF0` |
| Magical protection-wall damage | `sub_4961D0` | `0x004961D0` | `0x000161D0` |
| Integer clamp used by absolute damage | `CLAMP_FOR_CEnchant_Bless_sub_54E680` | `0x0054E680` | `0x000CE680` |
| Monster attack-endpoint multiplier | `sub_58BA30` | `0x0058BA30` | `0x0010BA30` |
| Monster outer skill-hit multiplier | `sub_58C360` | `0x0058C360` | `0x0010C360` |
| Summon caller: WORD sum and minimum damage | `sub_6A26E0` | `0x006A26E0` | `0x002226E0` |
| Ordinary skill caller: final target-ratio scaling | `CSkillManager__ProcessSkillAction_6B7880` | `0x006B7880` | `0x00237880` |

The small IDA excerpts for these functions are collected in [section 11](#11-small-original-ida-snippets). Every excerpt shows instruction EAs; the index gives the containing function's entry EA and RVA.

## 3. Ordinary physical and magical damage

Entry functions:

| Channel | Function entry | RVA | Variation helper |
|---|---|---|---|
| Physical | `0x00495670` | `0x00015670` | `0x00494E40` |
| Magical | `0x00495B30` | `0x00015B30` | `0x004951E0` |

Both return zero unless the skill has an attack descriptor, both actors return life-state `1`, and the attack descriptor enables the channel (`0x04` physical, `0x08` magical).

### 3.1 Attack descriptor

The pointer is read from `RefSkill + 0x234`. Its fields used here are:

| Offset in descriptor | Storage | Meaning in the calculation |
|---|---|---|
| `+0x00` | DWORD flags | Damage/channel and minimum/maximum modifier selection |
| `+0x04` | unsigned DWORD | Main damage percentage; source calls it `DamagePercentPlayers` |
| `+0x08` | unsigned DWORD | Additive minimum skill damage |
| `+0x0C` | unsigned DWORD | Additive maximum skill damage |
| `+0x10` | unsigned DWORD | Percentage used to add a secondary skill's damage to the total |

The `+0x04` percentage is applied by the ordinary core without a target-is-player condition. The name does not restrict its observed use. The `+0x10` field is used in the caller's secondary-skill path; it is not substituted for `+0x04` whenever the target is a monster.

### 3.2 Base endpoints

Physical helper `0x004935D0`:

```text
raw_min = P(A,13) + skill_min   if descriptor exists and bit 0x04 is set
raw_max = P(A,14) + skill_max   if descriptor exists and bit 0x04 is set

Otherwise: raw_min = P(A,13), raw_max = P(A,14)
```

Magical helper `0x00493690`:

```text
raw_min = P(A,15) + skill_min   if descriptor exists and bit 0x08 is set
raw_max = P(A,16) + skill_max   if descriptor exists and bit 0x08 is set

Otherwise: both returned endpoints are zero
```

Each helper multiplies its result by the monster base multiplier (`0x0058BA30`) when `A` is a monster, then clamps to `[0, 999999]`. The variation helper subsequently applies mastery:

```text
lo = base_min * (1 + M / 100)
hi = base_max * (1 + M / 100)
```

Thus `999999` is the endpoint clamp **before** mastery and later skill-variable multipliers. It is not the final damage cap.

### 3.3 Level bonus and attack/parry interpolation

Level helper `0x004938F0`:

```text
B = clamp((L(A) - L(T)) * 0.029999999329447746,
          0, 0.30000001192092896)
```

Ratio helper `0x00493970`:

```text
R = clamp(100 * (0.5 * P(A,11) / P(T,9) + B), 10, 90)
```

Parameter `11` supplies the attack/hit-rate value; parameter `9` supplies the target parry value. This ratio chooses a point inside the damage range. The helper does not itself decide whether the hit misses.

The normal variation path uses four calls to `rand()`:

```text
u1 = float(rand() / 32767.0); u1 = float(u1 * 100 + 0)
u2 = float(rand() / 32767.0); u2 = float(u2 * 100 + 0)
u3 = float(rand() / 32767.0); u3 = float(u3 * 100 + 0)
U  = min(100, u1, u2, u3)

r4 = abs(rand()) % 2
t  = R - U if r4 == 0, otherwise R + U
```

The three float-normalized samples and their minimum are intentional. Replacing this with a single uniform roll changes the distribution and the RNG sequence.

**`FIXED_ATTACK_DAMAGE` configuration:**

| Physical variation `0x00494E40` | Magical variation `0x004951E0` |
|---|---|
| Uses cached float at `0x00FEA488` | Reads the configuration each invocation |
| Cache starts at `-100`; first lookup changes it to `-1` if absent | Calculates `R` before configuration lookup |
| Present value is parsed with `atof`, clamped to `[0,100]`, then cached | Present value is parsed with `atof` and replaces `t` |
| Cache `-1` selects the four-random-call path | Absent value selects the four-random-call path |
| A configured value skips ratio calculation and RNG | A configured value skips RNG |

After configuration/random selection, skill-variable additions are applied, and `t` is clamped to `[0,100]` in both channels. Magical fixed values are therefore clamped after those additions; physical configured values have an additional earlier cache clamp.

### 3.4 Skill-variable additions and multipliers

A nonnull DWORD-key pointer in the `RefSkill` selects a variable in the attacker's skill manager. The retrieved value at variable `+4` is treated as an **unsigned DWORD**.

| Stage | Physical `0x00494E40` | Magical `0x004951E0` |
|---|---|---|
| Add to interpolation percentage | First nonnull pointer: `+0x528`, otherwise `+0x4E8` | Add both `+0x528` and `+0x4E8` when present and resolved |
| Clamp interpolation percentage | `[0,100]` | `[0,100]` |
| Interpolate | `V = lo + (hi-lo) * t / 100` | Same |
| Multiply interpolated damage | First nonnull pointer in order `+0x524`, `+0x518`, `+0x4DC`, `+0x4E0`, `+0x4E4` | Apply every resolved pointer in order `+0x4F4`, `+0x4F8`, `+0x4FC`, `+0x500`, `+0x530`, `+0x538`, `+0x548`, `+0x568` |
| Multiplier for a resolved value `v` | `1 + v/100` | `1 + v/100` per stage |

Physical pointer priority is decided by pointer presence. If the selected pointer's key is absent from the variable map, the formula does not fall through to a lower-priority pointer. Magical missing variables skip only their own stage.

The arithmetic and offset order are **CONFIRMED**. These offsets identify lookup keys; interpreting every key as a particular named buff would require additional ownership/parameter evidence. The document retains the offsets for that reason.

### 3.5 Defense and absorption

Physical damage can first add the variable selected by `RefSkill + 0x52C` when `F & 0x08` is set. Its exact gameplay meaning is unresolved; the observed operation is a flat addition to `V` before defense.

For either channel:

```text
if F & 0x20:
    d = V                         # bypass absorption and defense
else:
    d = V / (1 + absorption/100) - defense

d = max(d, 0)
```

| Channel | Defense parameter | Absorption parameter |
|---|---|---|
| Physical | `5` | `7` |
| Magical | `6` | `8` |

**Physical transformed-player exception:** If the target is a PC in a PVP zone and its skin-mutation selector is `7`, use the object reference reached through target `+0x24F4`: unsigned defense at reference `+0x234`, unsigned absorption at reference `+0x23C`. This branch uses `1 + raw_reference_absorption`, with **no division by 100**. A null reference returns zero. The normal branch continues to use the percentage-based parameters above.

### 3.6 Skill percentage, additive percentage bonuses, and target coefficient

Reload the descriptor after variation/defense callbacks. Apply its unsigned `+0x04` percentage:

```text
d0 = d * descriptor_percentage / 100
```

Select the attacker's avatar/modifier percentage `a`:

| Channel | Descriptor bit `0x01` | Otherwise bit `0x02` | Neither |
|---|---|---|---|
| Physical | `P(A,128)` | `P(A,129)` | `0` |
| Magical | `P(A,130)` | `P(A,131)` | `0` |

If the attacker is a PC and its DWORD at `+0x27D4` equals `1`, add the **signed DWORD** at `0x0103FFBC` to `a`. Both channels read that same global. Its precise gameplay condition is unresolved; this document does not rename it.

Two optional bonus amounts are computed from `d0`, before the avatar percentage:

```text
bonus = 0
if T is a monster and monster_class(T) == 3:
    bonus = d0 * P(A,259) / 100

if A is a PC and has a party at A+0x1F0C:
    n = 261 if party_byte_at_+0x10 & 0x01 else 262
    bonus += d0 * P(A,n) / 100

d1 = d0 * (1 + a/100)
d2 = d1 + bonus
d3 = d2 * NZ(target_coefficient)
```

The magical path uses the same parameter IDs `259`, `261`, and `262` as the physical path. They are separate additions; merging them with all later percentage factors changes their application point.

Coefficient helper `0x00493260` reads the target's embedded parameter keeper at `+0x1F8`. Ordinary damage calls it with the active descriptor's type, the duplicate descriptor's type, and selector `1`:

| Active descriptor | Duplicate descriptor | Target parameter for selector `1` | Alternate selector `0` |
|---|---|---|---|
| Bit `0x04` | Bit `0x01` | `174` | `132` |
| Bit `0x04` | Otherwise bit `0x02` | `175` | `133` |
| Otherwise bit `0x08` | Bit `0x01` | `176` | `134` |
| Otherwise bit `0x08` | Otherwise bit `0x02` | `177` | `135` |
| No recognized selection | Any | `0` | `0` |

Physical bit `0x04` has precedence over magical bit `0x08`; bit `0x01` has precedence over bit `0x02`. The returned coefficient multiplies damage directly when nonzero. There is no `/100` conversion at this stage.

### 3.7 Event, hit flags, level, balance, and final multipliers

Continue in this order:

```text
d4 = d3 * (1 + channel_event_global)

h = 1
if F & 0x04: h = P(A,189) + 2
if physical and F & 0x02: h = h + h
d5 = d4 * h

if L(A) > L(T):
    d6 = d5 * (1 + B)
else:
    d6 = d5

d7 = d6 * attacker_balance_factor
d8 = d7 * NZ(P(A,attacker_multiplier_id))
d9 = d8 * NZ(P(T,target_multiplier_id))

return trunc(clamp(d9, 0, 16777215))
```

| Channel | Event float EA / RVA | Balance helper | Attacker multiplier | Target multiplier |
|---|---|---|---|---|
| Physical | `0x0103FD8C` / `0x00BBFD8C` | `0x00494080` | `178` | `180` |
| Magical | `0x0103FD90` / `0x00BBFD90` | `0x00494140` | `179` | `181` |

The event globals are used as `1 + value`, not `1 + value/100`. Parameters `178`–`181` also multiply directly, and exactly zero skips the multiplication. Their source names suggesting “reduce” do not change this arithmetic.

The physical path doubles `h` for flag `0x02`; the magical path has no corresponding doubling. Flag `0x04` contributes a baseline `2` plus parameter `189`. If both physical flags are set, the hit factor is `2 * (P(A,189)+2)`.

The higher-level bonus appears twice in the ordinary path: once in the interpolation ratio and again as the final factor `1+B` when the attacker is higher level.

Both cores also call the target's balance helper, then discard its result. Only the attacker's returned balance factor is multiplied into this damage.

### 3.8 STR and INT balance factors

Physical helper `0x00494080` returns `1` for a non-PC. For a PC:

```text
q = Q(A) - 1
physical_balance = clamp(
    (P(A,1) + 16 + q + q) / ((q * 7 + 56) * 0.8571428656578064),
    0, 1.2000000476837158)
```

Magical helper `0x00494140` returns `1` for a non-PC. For a PC:

```text
magical_balance = clamp(
    P(A,2) / (((Q(A)-1) * 5 + 40) * 0.80000001192092896),
    0, 1.2000000476837158)
```

Parameter `1` is STR; parameter `2` is INT. These helpers use **maximum level**, whereas the damage-level bonus uses the current level getter. The physical coefficient is the stored approximation of `6/7`; the magical coefficient is the stored approximation of `0.8`. Keep their exact stored values for numerical reproduction.

## 4. Protection-wall damage

| Channel | Entry EA | RVA |
|---|---|---|
| Physical wall formula | `0x00495EF0` | `0x00015EF0` |
| Magical wall formula | `0x004961D0` | `0x000161D0` |

Both require the ordinary life-state and channel gates, plus the corresponding bit (`0x04` or `0x08`) in the wall descriptor's DWORD at `+0`.

Use the channel's variation helper with the supplied mastery and a zero final variation argument. The physical wall path also applies the `+0x52C` flat addition when hit flag `0x08` is set.

```text
if F & 0x20:
    d = V
else:
    d = V / (1 + unsigned_DWORD(wall+0x0C)/100)
          - unsigned_DWORD(wall+0x08)
d = max(d, 0)

d *= descriptor_percentage / 100
d *= 1 + avatar_percentage/100
d *= 1 + channel_event_global
d *= attacker_balance_factor
d *= (P(A,189)+2) if F & 0x04, otherwise 1
d *= NZ(P(A,178 or 179))
d *= NZ(P(T,180 or 181))
return trunc(clamp(d, 0, 16777215))
```

The avatar selection and conditional `0x0103FFBC` addition are the same as in the ordinary formulas. The wall path does not apply the ordinary class-3 bonus, party bonus, target coefficient helper, final level bonus, or physical flag-`0x02` doubling.

The arithmetic roles of wall `+0x08` and `+0x0C` are subtraction and absorption percentage respectively. The exact gameplay interpretation of those fields is unresolved; source labels such as `Unknown` or `MPAbsorbRate` are not proof of their role outside this formula.

## 5. Summon / periodic skill damage

| Channel | Entry EA | RVA | Unsigned base amount |
|---|---|---|---|
| Physical | `0x00494530` | `0x00014530` | Summon descriptor `+0x0C` |
| Magical | `0x004946F0` | `0x000146F0` | Summon descriptor `+0x10` |

Return zero if the channel amount is zero or either actor's life-state is not `1`.

```text
d = amount * (1 + M/100)
d = max(d / (1 + target_absorption/100) - target_defense, 0)
d *= NZ(target_coefficient)
d *= 1 + channel_event_global
d *= NZ(P(T,180 or 181))
return trunc(clamp(d, 0, 16777215))
```

Physical uses target parameters `5` and `7`, and coefficient helper arguments `(T,5,5,1)`, selecting parameter `174`. Magical uses `6` and `8`, and arguments `(T,9,9,1)`, selecting parameter `176`. The target balance helper is called and its result discarded. These functions do not multiply by the attacker's STR/INT factor or parameters `178`/`179`.

Caller `0x006A26E0` adds the components using a **16-bit retained result**, promotes a zero sum to `1`, and can replace it with a registered monster spawn-record value. It passes a WORD injury amount. The wire result can add death bit `0x8000` after injury; this bit is a result marker, not an arithmetic damage multiplier.

## 6. Caller modifiers after the core formula

The ordinary caller is `CSkillManager__ProcessSkillAction_6B7880`, entry `0x006B7880`, RVA `0x00237880`. Its hit-result-zero path applies additional operations after the channel cores return. Each hit in a multi-hit skill obtains its own calculation/rolls.

### 6.1 Channel and down-attack adjustments

1. A down-attack descriptor and target motion-state `8` scale each component by its extra-damage percentage. The operation is `trunc(unsigned_DWORD(component * percentage)/100.0)`: the integer product retains only the low DWORD **before** division.
2. Target-entry damage type `1` clears physical damage.
3. An active protection wall can suppress components using wall channel bits `0x04` and `0x08`.
4. The total is formed from the remaining physical and magical components.

### 6.2 Secondary skill contribution

If the primary descriptor's `+0x10` percentage is nonzero and a secondary attack skill is present, the caller calculates another physical/magical pair. It passes the primary skill as the duplicate descriptor used for target coefficient selection. The secondary components receive their own down-attack/channel/wall adjustments.

```text
secondary_sum = DWORD(secondary_physical + secondary_magical)
physical_component += secondary_physical
magical_component  += secondary_magical
total += trunc(unsigned_DWORD(secondary_sum * primary_percentage_at_+0x10)/100.0)
```

The component fields receive the unscaled secondary amounts; the total receives the percentage-scaled amount. Consequently, total damage need not equal the later sum of the component fields.

The secondary mastery selection is unusual: start with the primary mastery; only if it is greater than `90`, set it to `90`, then replace it with the secondary mastery if that secondary value is also greater than `90`. A secondary mastery below or equal to `90` does not replace a capped primary value.

### 6.3 Final total modifications

For normal hit result `0`, apply these branches in order:

```text
if life-steal descriptor exists:
    total = life_steal_formula(A,T,skill,target_ratio)
else:
    if absolute-damage descriptor exists:
        total += absolute_damage_formula(...)
    else if max-HP-percentage descriptor exists:
        total += max_HP_percentage_formula(...)

    if attack-category required mask intersects target abnormal-status mask:
        total = lowDWORD(trunc(unsigned(total) * (1 + category_percent/100)))

    total = lowDWORD(trunc(unsigned_DWORD(total * target_ratio_BYTE)/100.0))

if applicable alternate caller branch and registered monster target
   and attacker is NPC or monster:
    total = spawn_record_value_at_+0x1C

if A is a monster:
    total = lowDWORD(trunc(unsigned(total) * monster_skill_multiplier(A)))

if total == 0 and this is an ordinary attack-result path:
    total = 1
```

Life-steal replaces the total and bypasses the absolute/max-HP, attack-category, and caller target-ratio stages. The life-steal helper has its own ratio handling. Non-attack/status paths can retain zero; the minimum `1` rule is conditional in those paths.

**There is no final repeat of the core `[0,0xFFFFFF]` clamp in these shown caller modifiers.** The cap is a core return bound. Additions, total scaling, spawn overrides, and the outer monster multiplier happen later.

Useful original instruction locations:

| Operation | First branch | Parallel branch |
|---|---|---|
| Ordinary physical core call | `0x006B848A` | `0x006B8B10` |
| Ordinary magical core call | `0x006B84B5` | `0x006B8B3B` |
| Secondary physical core call | `0x006B863B` | `0x006B8CDF` |
| Secondary magical core call | `0x006B8660` | `0x006B8D02` |
| Life-steal replacement | `0x006B881B` | `0x006B8EB9` |
| Absolute damage helper | `0x006B8846` | `0x006B8EE4` |
| Maximum-HP helper | `0x006B8864` | `0x006B8F02` |
| Ratio multiplication/division | `0x006B88E0` / `0x006B88F6` | Same operation in later branch |
| Outer monster multiplier call | `0x006B8932` | `0x006B902D` |

These are callsites/instruction locations, not separate function entries.

## 7. Special damage helpers

### 7.1 Maximum-HP percentage — `0x00492BA0`, RVA `0x00012BA0`

```text
damage = lowDWORD(trunc(signed_target_max_HP * (unsigned_percent / 100.0)))
```

Uses the target getter at vtable `+0x110` and the first unsigned DWORD of the percentage descriptor. There is no defense, absorption, level, or 24-bit clamp inside this helper. The caller adds its return to the total when there is no absolute-damage descriptor.

### 7.2 Absolute skill damage — `0x00493750`, RVA `0x00013750`

```text
base = DWORD(descriptor_amount + optional_skill_variable)
delta = L(T) - L(A)
if delta <= 0: return base

reduced = trunc(signed32(base) * (1 - delta * 2.5 / 100))
minimum = signed32(DWORD(base * 10)) / 100    # signed integer division
return integer_clamp(reduced, minimum, signed32(base))
```

The loss is nominally `2.5%` per level by which the target is higher. The minimum is nominally `10%`, but multiplication wraps as a DWORD before signed division. The integer clamp helper is `0x0054E680`, distinct from float clamp `0x00493470`.

### 7.3 Life-steal hit value — `0x004948B0`, RVA `0x000148B0`

```text
base = signed32(DWORD(life_steal_amount
                      + optional_variable_selected_by_RefSkill_+0x53C
                      + optional_weapon_heal_bonus))
delta = L(T) - L(A)
reduced = base
if delta > 0:
    reduced = trunc(base * (1 - delta * 2.5/100))
minimum = trunc(base * 0.10000000149011612)

if reduced > current_HP(T) or minimum > current_HP(T):
    result = current_HP(T)
else:
    selected = max(reduced, minimum)
    result = trunc(signed32(DWORD(selected * target_ratio_BYTE))/100.0)

ApplyRegen(A, result, 0, 0x40)
return result
```

The base amount is reached through `RefSkill + 0x408`; an optional weapon-based amount uses the descriptor at `+0x40C` and helper `0x00494490`. The HP-cap branch does **not** apply the ratio afterward. The uncapped branch does not re-clamp after applying the ratio.

Weapon-heal bonus helper `0x00494490`, RVA `0x00014490`:

```text
weapon = inventory_slot_6
if weapon == null: return 0
average = float((weapon_magical_max_at_+0x1CC
                 + weapon_magical_min_at_+0x1C8) * 0.5)
bonus = lowDWORD(trunc(average * magical_balance(A) * (unsigned_percent/100)))
```

### 7.4 Random level damage — `0x00492C00`, RVA `0x00012C00`

```text
lo = 5 * BYTE(attacker_level_getter())
hi = 10 * BYTE(attacker_level_getter())
damage = lo + rand() % (hi-lo)
```

The getter is called twice. For a stable positive level `L`, the range is `[5L,10L-1]`; the upper endpoint is exclusive. The helper does not guard the zero-level modulo-zero case. The caller's special hit-result path can override this result using a spawn record.

### 7.5 Random weapon power — `0x00492C40` and `0x00492CA0`

| Channel | Entry / RVA | Integer minimum parameter | Integer maximum parameter |
|---|---|---|---|
| Physical | `0x00492C40` / `0x00012C40` | `191` | `190` |
| Magical | `0x00492CA0` / `0x00012CA0` | `193` | `192` |

```text
lo = trunc(P(A,min_id))
range = trunc(P(A,max_id)) - lo
return lo + rand() % (range+1) if range > 0, otherwise 0
```

The interval is inclusive when it is valid. Equal minimum and maximum return `0`, not that endpoint.

### 7.6 Weapon/type coefficient — `0x00492D00`, RVA `0x00012D00`

Obtain random physical or magical weapon power from the preceding helpers, then multiply in the listed order, storing intermediate products as float. The decimal factors below are convenient nominal labels; exact stored values are in section 10.

| Type value | Power channel | Ordered coefficients |
|---|---|---|
| `2` | Physical | `0.30` |
| `3` | Physical | `0.90`, `0.30` |
| `4` | Physical | `0.90`, `0.58` |
| `5` | Physical | `0.90`, `0.90`, `0.58` |
| `6` | Physical | `0.30`, `0.42` |
| `7` | Physical | `0.66`, `0.66` |
| `8` | Physical | `0.66` |
| `9` | Physical | `0.66`, `0.38` |
| `10`, `11`, `15` | Magical | `0.50`, `0.50`, `0.83` |
| `12` | Physical | `0.47`, `0.30` |
| `13` | Physical | `0.66`, `0.25` |
| `14` | Magical | `0.50`, `0.50` |
| `16` | Physical | No coefficient |
| Other values | None | Return `1` |

The random helper's returned DWORD is converted as unsigned before these products. The final float product is converted toward zero to a QWORD and its low DWORD returned. Do not collapse coefficient chains if exact rounding matters.

### 7.7 Attack-descriptor-only damage — `0x004930E0`, RVA `0x000130E0`

```text
if RefSkill.attack_descriptor == null: return 0
lo = descriptor_unsigned_min
divisor = DWORD(descriptor_unsigned_max + 1 - lo)
roll = DWORD(lo + unsigned(rand()) % divisor)
damage = lowDWORD(trunc(unsigned_percentage * unsigned(roll) / 100.0))
```

For a valid non-wrapping descriptor interval, this is an inclusive `[min,max]` roll. Here the percentage and roll are converted to floating point before multiplication; it is not the caller's wrapped integer-product percentage operation. No 24-bit clamp or ordinary stat/defense modifiers are applied inside this helper.

## 8. Monster multipliers

### 8.1 Base attack endpoint multiplier — `0x0058BA30`, RVA `0x0010BA30`

```text
type 0: factor = 1
type 1: factor = float(1.2000000476837158)
other type: diagnostic, factor remains 1
if low_nibble_of_byte_at_monster_+0x1F18 == 6:
    factor = float(factor * 1.5)
```

This factor is used in the attack endpoint helpers before their `[0,999999]` clamp.

### 8.2 Outer skill-hit multiplier — `0x0058C360`, RVA `0x0010C360`

```text
type 0: base = 1
type 1: base = float(1.2999999523162842)
other type: diagnostic, base = 1
base = clamp(base, 0.10000000149011612, 10)
```

Then choose by the BYTE monster-class getter:

| Class | Result |
|---|---|
| `0`, `1`, `3`, `8` | `base` |
| `4`, `5`, `6` | `float(base * 1.5)` |
| `7` | `float(base * 1.7999999523162842)` |
| `9` | `float(base * 1.8999999761581421)` |
| Other | `1` |

This is a separate factor applied to the caller's unsigned total after the ordinary core returns. Do not substitute the endpoint multiplier for this one.

## 9. Flags, parameter IDs, and integer constants

### 9.1 Flags and selectors

| Value | Location/context | Observed effect |
|---|---|---|
| `1` | Actor life-state getter | Required alive value for the core and summon gates |
| `0x01` | Attack descriptor | Selects minimum-channel modifier; precedes bit `0x02` |
| `0x02` | Attack descriptor | Selects maximum-channel modifier |
| `0x04` | Attack descriptor / wall mask | Physical channel |
| `0x08` | Attack descriptor / wall mask | Magical channel |
| `0x02` | Hit flags | Doubles ordinary physical hit factor |
| `0x04` | Hit flags | Uses `P(A,189)+2` instead of hit factor `1` |
| `0x08` | Hit flags | Allows the physical flat skill-variable addition |
| `0x20` | Hit flags | Skips defense and absorption |
| `1` | Party byte `+0x10`, low bit | Chooses attacker parameter `261`; clear chooses `262` |
| `3` | Target monster class | Enables the `P(A,259)/100` bonus |
| `7` | Skin-mutation selector in physical PVP branch | Uses reference defense and raw reference absorption |
| `8` | Target motion-state | Enables down-attack scaling when its descriptor exists |
| `1` | Target-entry damage type | Clears physical component |
| `90` / `0x5A` | Secondary mastery selection | Conditional primary cap described in section 6.2 |
| `0x40` | Life-steal regeneration call | Regeneration argument; not a multiplier |
| `0x8000` | Summon wire result | Death marker after injury |
| `0x0C00` | x87 control-word OR | Selects conversion toward zero before `FISTP` |
| `0x51EB851F` | Absolute-damage assembly | Compiler signed-division-by-100 reciprocal; not a gameplay percentage |

These flag bits belong to different inputs. In particular, hit flag `0x04` does not mean “physical channel”; attack-descriptor bit `0x04` does.

### 9.2 Character parameter constants

| IDs | Use |
|---|---|
| `1`, `2` | STR and INT in balance helpers |
| `5`, `6` | Target physical and magical defense |
| `7`, `8` | Target physical and magical absorption percentage |
| `9`, `11` | Parry denominator and attacker attack-rate numerator |
| `13`, `14` | Physical attack minimum and maximum |
| `15`, `16` | Magical attack minimum and maximum |
| `128`, `129` | Physical avatar/modifier percentage, minimum/maximum selection |
| `130`, `131` | Magical avatar/modifier percentage, minimum/maximum selection |
| `132`–`135` | Alternate selector-zero target coefficients in `0x00493260` |
| `136`–`139` | Target hit-rating coefficients selected by `0x00493330`; affect caller hit resolution, not range interpolation |
| `174`–`177` | Selector-one target coefficients used by ordinary/summon damage |
| `178`, `179` | Attacker final physical/magical direct multipliers; skip zero |
| `180`, `181` | Target final physical/magical direct multipliers; skip zero |
| `189` | Additional hit factor when hit flag `0x04` is set |
| `190`, `191` | Random physical weapon maximum/minimum |
| `192`, `193` | Random magical weapon maximum/minimum |
| `259` | Percentage bonus against target monster class `3`; exact broader meaning unresolved |
| `261`, `262` | Party-policy-selected percentage bonus; exact broader meaning of `262` unresolved |

Target hit-rating helper `0x00493330`, RVA `0x00013330`, uses physical-before-magical and minimum-before-maximum bit priority to select `136`, `137`, `138`, or `139`; otherwise it returns zero. Its caller uses it during hit resolution. It is separate from ratio helper `0x00493970`.

## 10. Stored numeric constants and mutable globals

### 10.1 Calculation constants from the reference PE

The values below are decoded directly from the original executable at the listed EAs. `float32` and `float64` describe **storage**, even when the nominal value originated as a float before being stored as a double. For example, the double coefficient near `0.66` is `0.6600000262260437`, not an exact mathematical `0.66`.

`2^32 = 4294967296` corrects a signed `FILD` result to an unsigned DWORD value. Hex-Rays sometimes prints it rounded as `4294967300.0`; the stored constant is exactly `4294967296`.

| Constant EA | RVA | Storage | Exact stored value | Calculation use |
|---|---|---|---|---|
| `0x00DAF9F8` | `0x0092F9F8` | float32 | `4294967296` | Unsigned DWORD correction after signed FILD |
| `0x00DB06B0` | `0x009306B0` | float32 | `10` | Ratio lower bound; monster base upper bound |
| `0x00DB0B60` | `0x00930B60` | float64 | `100` | Percentage denominator / normalization |
| `0x00DB0B68` | `0x00930B68` | float64 | `0.8299999833106995` | Weapon/type nominal 0.83 |
| `0x00DB0B70` | `0x00930B70` | float64 | `0.5` | Ratio half factor; weapon half factor; weapon average |
| `0x00DB0B78` | `0x00930B78` | float64 | `0.25` | Weapon/type nominal 0.25 |
| `0x00DB0B80` | `0x00930B80` | float64 | `0.4699999988079071` | Weapon/type nominal 0.47 |
| `0x00DB0B88` | `0x00930B88` | float64 | `0.3799999952316284` | Weapon/type nominal 0.38 |
| `0x00DB0B90` | `0x00930B90` | float64 | `0.6600000262260437` | Weapon/type nominal 0.66 |
| `0x00DB0B98` | `0x00930B98` | float64 | `0.41999998688697815` | Weapon/type nominal 0.42 |
| `0x00DB0BA0` | `0x00930BA0` | float64 | `0.5799999833106995` | Weapon/type nominal 0.58 |
| `0x00DB0BA8` | `0x00930BA8` | float64 | `0.8999999761581421` | Weapon/type nominal 0.90 |
| `0x00DB0BB0` | `0x00930BB0` | float64 | `0.30000001192092896` | Weapon/type nominal 0.30 |
| `0x00DB0BD0` | `0x00930BD0` | float64 | `1` | Unit baseline in sums / balance denominators |
| `0x00DB0C44` | `0x00930C44` | float32 | `999999` | Attack endpoint upper clamp |
| `0x00DB0C48` | `0x00930C48` | float64 | `0` | Zero offset / initial value |
| `0x00DB0C50` | `0x00930C50` | float64 | `2.5` | Absolute damage and life-steal loss: 2.5 percent per level |
| `0x00DB0C5C` | `0x00930C5C` | float32 | `0.30000001192092896` | Level-bonus upper bound (nominal 0.30) |
| `0x00DB0C60` | `0x00930C60` | float64 | `0.029999999329447746` | Level-bonus slope (nominal 0.03) |
| `0x00DB0C68` | `0x00930C68` | float32 | `90` | Ratio upper bound |
| `0x00DB0CAC` | `0x00930CAC` | float32 | `1.2000000476837158` | Balance upper bound; monster endpoint type-1 base (nominal 1.2) |
| `0x00DB0CB0` | `0x00930CB0` | float64 | `0.8571428656578064` | STR denominator coefficient (nominal 6/7) |
| `0x00DB0CB8` | `0x00930CB8` | float64 | `56` | STR denominator additive constant |
| `0x00DB0CC0` | `0x00930CC0` | float64 | `7` | STR denominator level coefficient |
| `0x00DB0CC8` | `0x00930CC8` | float64 | `16` | STR numerator additive constant |
| `0x00DB0CD0` | `0x00930CD0` | float64 | `0.800000011920929` | INT denominator coefficient (nominal 0.8) |
| `0x00DB0CD8` | `0x00930CD8` | float64 | `40` | INT denominator additive constant |
| `0x00DB0CE0` | `0x00930CE0` | float64 | `5` | INT denominator level coefficient |
| `0x00DB0CE8` | `0x00930CE8` | float32 | `16777215` | Core damage upper clamp: 0xFFFFFF |
| `0x00DB0CF0` | `0x00930CF0` | float64 | `0.10000000149011612` | Life-steal minimum fraction (nominal 0.10) |
| `0x00DB0D00` | `0x00930D00` | float64 | `32767` | rand normalization denominator |
| `0x00DB0D08` | `0x00930D08` | float64 | `-1` | Physical random-path sentinel comparison |
| `0x00DB0D10` | `0x00930D10` | float32 | `100` | Interpolation upper bound / sample initial minimum |
| `0x00DB0D28` | `0x00930D28` | float32 | `-1` | Physical random-path sentinel store |
| `0x00DB0D30` | `0x00930D30` | float64 | `-100` | Physical cache initial-state comparison |
| `0x00DB0D38` | `0x00930D38` | float64 | `2` | Hit factor baseline addition |
| `0x00DB33B0` | `0x009333B0` | float32 | `0.10000000149011612` | Monster multiplier lower clamp (nominal 0.1) |
| `0x00DC2708` | `0x00942708` | float32 | `1.2999999523162842` | Monster outer type-1 base (nominal 1.3) |
| `0x00DC9D60` | `0x00949D60` | float64 | `1.5` | Monster class factor 1.5 |
| `0x00DC9D90` | `0x00949D90` | float64 | `1.899999976158142` | Monster class-9 factor (nominal 1.9) |
| `0x00DC9D98` | `0x00949D98` | float64 | `1.7999999523162842` | Monster class-7 factor (nominal 1.8) |

Zero and one also appear as x87 `FLDZ` and `FLD1` instructions without a separate data address. Level multipliers `5` and `10`, range `+1`, masks, parameter IDs, and the percentage-floor multiplier `10` also occur as immediate operands or equivalent integer instructions; they are listed in the relevant formula sections.

### 10.2 Mutable runtime inputs

| EA | RVA | Storage | Use |
|---|---|---|---|
| `0x00FEA488` | `0x00B6A488` | float32, initialized to `-100` in PE | Physical fixed-damage interpolation cache; `-1` means random path |
| `0x0103FD8C` | `0x00BBFD8C` | float32 runtime global | Multiply physical damage by `1 + value` |
| `0x0103FD90` | `0x00BBFD90` | float32 runtime global | Multiply magical damage by `1 + value` |
| `0x0103FFBC` | `0x00BBFFBC` | signed DWORD runtime global | Add to avatar/modifier percentage when attacker PC `+0x27D4 == 1` |

The event globals' current runtime values were not sampled. They are inputs, not fixed formula constants. Skill percentages, keyed skill-variable values, mastery, stats, down-attack percentages, target ratio, summon amounts, and spawn-record damage are also data-driven inputs.

## 11. Small original IDA snippets

These excerpts come from the matching IDA export's assembly field. They are intentionally small: each proves a selected calculation step or branch, rather than reproducing a full decompilation. IDA's operand names and existing comments are retained. Stack-argument labels can alias reused storage in these optimized functions; use the instruction sequence and the readable formula together. Function entry addresses are shown independently of the first excerpted instruction.

### Maximum-HP percentage damage

Function entry **`0x00492BA0`**, RVA **`0x00012BA0`**, IDA label `sub_492BA0`.

```asm
00492BBF  fild    dword ptr [eax]
00492BC1  test    ecx, ecx
00492BC3  jge     short loc_492BCB
00492BC5  fadd    ds:flt_DAF9F8
00492BCB  fdiv    ds:dbl_DB0B60
00492BD1  fnstcw  word ptr [esp+8+arg_4]
00492BD5  fmulp   st(1), st
00492BD7  movzx   eax, word ptr [esp+8+arg_4]
```

### Random level damage

Function entry **`0x00492C00`**, RVA **`0x00012C00`**, IDA label `sub_492C00`.

```asm
00492C27  lea     esi, [eax+eax*4]
00492C2A  add     esi, esi
00492C2C  call    _rand
00492C31  cdq
00492C32  sub     esi, edi
00492C34  idiv    esi
00492C36  mov     eax, edx
00492C38  add     eax, edi
```

### Random physical weapon power

Function entry **`0x00492C40`**, RVA **`0x00012C40`**, IDA label `sub_492C40`.

```asm
00492C7D  xor     eax, eax
00492C7F  pop     esi
00492C80  retn    8
00492C83  call    _rand
00492C88  cdq
00492C89  add     esi, 1
00492C8C  idiv    esi
00492C8E  mov     eax, edx
```

### Random magical weapon power

Function entry **`0x00492CA0`**, RVA **`0x00012CA0`**, IDA label `sub_492CA0`.

```asm
00492CDD  xor     eax, eax
00492CDF  pop     esi
00492CE0  retn    8
00492CE3  call    _rand
00492CE8  cdq
00492CE9  add     esi, 1
00492CEC  idiv    esi
00492CEE  mov     eax, edx
```

### Weapon/type coefficient damage

Function entry **`0x00492D00`**, RVA **`0x00012D00`**, IDA label `sub_492D00`.

```asm
00492D39  jge     short loc_492D41
00492D3B  fadd    ds:flt_DAF9F8
00492D41  fmul    ds:dbl_DB0BB0
00492D47  jmp     loc_49306F
00492D4C  mov     eax, [esp+8+arg_8]; jumptable 00492D19 case 3
00492D50  mov     edx, [esp+8+arg_4]
00492D54  push    eax
00492D55  push    edx
```

### Attack-descriptor-only random damage

Function entry **`0x004930E0`**, RVA **`0x000130E0`**, IDA label `sub_4930E0`.

```asm
00493102  call    _rand
00493107  xor     edx, edx
00493109  sub     esi, edi
0049310B  div     esi
0049310D  mov     eax, [ebx+234h]
00493113  mov     ecx, [eax+4]
00493116  fild    dword ptr [eax+4]
00493119  add     edx, edi
```

### Target damage-coefficient selection

Function entry **`0x00493260`**, RVA **`0x00013260`**, IDA label `sub_493260`.

```asm
00493285  jz      short loc_4932A8
00493287  cmp     [esp+arg_C], 0
0049328C  jz      short loc_49329B
0049328E  push    0AEh ; '®'; a2
00493293  call    GetParamByParamID_sub_57EA90
00493298  retn    10h
0049329B  push    84h ; '„'; a2
004932A0  call    GetParamByParamID_sub_57EA90
```

### Target hit-rating coefficient selection

Function entry **`0x00493330`**, RVA **`0x00013330`**, IDA label `sub_493330`.

```asm
00493344  jz      short loc_493368
00493346  test    al, 1
00493348  jz      short loc_493357
0049334A  push    88h ; 'ˆ'; a2
0049334F  call    GetParamByParamID_sub_57EA90
00493354  retn    8
00493357  test    al, 2
00493359  jz      short loc_49338E
```

### Float clamp helper

Function entry **`0x00493470`**, RVA **`0x00013470`**, IDA label `sub_493470`.

```asm
0049347C  push    edi; Locale
0049347D  fld     dword ptr [ebx]
0049347F  mov     edi, [esp+0Ch+arg_0]
00493483  fcompp
00493485  fnstsw  ax
00493487  test    ah, 5
0049348A  jp      short loc_4934CC
0049348C  fld     dword ptr [ebx]
```

### Physical attack endpoint

Function entry **`0x004935D0`**, RVA **`0x000135D0`**, IDA label `sub_4935D0`.

```asm
0049363D  call    sub_58BA30
00493642  fmul    [esp+8+arg_0]
00493646  fstp    [esp+8+arg_0]
0049364A  fld     ds:flt_DB0C44
00493650  push    35h ; '5'
00493652  push    offset aFormulaeCpp; ".\\Formulae.cpp"
00493657  fstp    [esp+10h+arg_4]
0049365B  fldz
```

### Magical attack endpoint

Function entry **`0x00493690`**, RVA **`0x00013690`**, IDA label `sub_493690`.

```asm
004936C5  test    eax, eax
004936C7  jz      short loc_4936FA
004936C9  test    byte ptr [eax], 8
004936CC  jz      short loc_4936FA
004936CE  test    edi, edi
004936D0  jnz     short loc_4936D7
004936D2  mov     eax, [eax+8]
004936D5  jmp     short loc_4936DA
```

### Absolute skill damage

Function entry **`0x00493750`**, RVA **`0x00013750`**, IDA label `sub_493750`.

```asm
004937AB  fild    [esp+8+arg_C]
004937AF  fmul    ds:dbl_DB0C50
004937B5  fdiv    ds:dbl_DB0B60
004937BB  fld1
004937BD  fsubrp  st(1), st
004937BF  fimul   [esp+8+arg_8]
004937C3  call    __ftol2_sse
004937C8  mov     [esp+8+arg_C], eax
```

### Level-difference bonus

Function entry **`0x004938F0`**, RVA **`0x000138F0`**, IDA label `sub_4938F0`.

```asm
00493928  lea     ecx, [esp+10h+arg_4]
0049392C  push    ecx
0049392D  fmul    ds:dbl_DB0C60
00493933  lea     edx, [esp+14h+var_4]
00493937  push    edx
00493938  lea     eax, [esp+18h+arg_0]
0049393C  fstp    [esp+18h+arg_0]
00493940  push    eax
```

### Attack/parry interpolation ratio

Function entry **`0x00493970`**, RVA **`0x00013970`**, IDA label `sub_493970`.

```asm
004939A5  push    esi
004939A6  mov     ecx, ebx
004939A8  fmul    ds:dbl_DB0B70
004939AE  fstp    [esp+1Ch+arg_0]
004939B2  call    sub_4938F0; #STR: ".\\Formulae.cpp"
004939B7  fadd    [esp+14h+arg_0]
004939BB  push    57Eh
004939C0  push    offset aFormulaeCpp; ".\\Formulae.cpp"
```

### Physical STR/max-level balance factor

Function entry **`0x00494080`**, RVA **`0x00014080`**, IDA label `sub_494080`.

```asm
004940FE  fmul    ds:dbl_DB0CC0
00494104  fadd    ds:dbl_DB0CB8
0049410A  fmul    ds:dbl_DB0CB0
00494110  fdivp   st(1), st
00494112  fstp    [esp+24h+arg_0]
00494116  fld     ds:flt_DB0CAC
0049411C  fstp    [esp+24h+var_C]
00494120  fldz
```

### Magical INT/max-level balance factor

Function entry **`0x00494140`**, RVA **`0x00014140`**, IDA label `sub_494140`.

```asm
004941AF  fadd    ds:dbl_DB0CD8
004941B5  push    eax
004941B6  fmul    ds:dbl_DB0CD0
004941BC  fdivp   st(1), st
004941BE  fstp    [esp+20h+arg_0]
004941C2  fld     ds:flt_DB0CAC
004941C8  fstp    [esp+20h+var_8]
004941CC  fldz
```

### Weapon-based life-steal/heal bonus

Function entry **`0x00494490`**, RVA **`0x00014490`**, IDA label `sub_494490`.

```asm
004944CB  test    eax, eax
004944CD  fadd    dword ptr [esi+1C8h]
004944D3  fmul    ds:dbl_DB0B70
004944D9  fstp    [esp+10h+a1]
004944DD  fld     [esp+10h+a1]
004944E1  fmul    [esp+10h+var_4]
004944E5  fild    [esp+10h+a2]
004944E9  jge     short loc_4944F1
```

### Summon physical damage

Function entry **`0x00494530`**, RVA **`0x00014530`**, IDA label `sub_494530`.

```asm
00494586  test    ecx, ecx
00494588  fild    [esp+14h+arg_10]
0049458C  fdiv    ds:dbl_DB0B60
00494592  fadd    ds:dbl_DB0BD0
00494598  fild    dword ptr [ebx+0Ch]
0049459B  jge     short loc_4945A3
0049459D  fadd    ds:flt_DAF9F8
004945A3  mov     edx, [esi]
```

### Summon magical damage

Function entry **`0x004946F0`**, RVA **`0x000146F0`**, IDA label `sub_4946F0`.

```asm
00494746  test    ecx, ecx
00494748  fild    [esp+14h+arg_10]
0049474C  fdiv    ds:dbl_DB0B60
00494752  fadd    ds:dbl_DB0BD0
00494758  fild    dword ptr [ebx+10h]
0049475B  jge     short loc_494763
0049475D  fadd    ds:flt_DAF9F8
00494763  mov     edx, [esi]
```

### Life-steal hit value

Function entry **`0x004948B0`**, RVA **`0x000148B0`**, IDA label `sub_4948B0`.

```asm
0049498D  movzx   eax, byte ptr [esp+18h+arg_C]
00494992  imul    eax, edi
00494995  mov     [esp+18h+arg_C], eax
00494999  fild    [esp+18h+arg_C]
0049499D  fnstcw  word ptr [esp+18h+arg_C]
004949A1  fdiv    ds:dbl_DB0B60
004949A7  movzx   eax, word ptr [esp+18h+arg_C]
004949AC  or      eax, 0C00h
```

### Physical damage variation

Function entry **`0x00494E40`**, RVA **`0x00014E40`**, IDA label `sub_494E40`.

```asm
00494F4D  call    _rand
00494F52  mov     [esp+18h+arg_0], eax
00494F56  fild    [esp+18h+arg_0]
00494F5A  fdiv    ds:dbl_DB0D00
00494F60  fstp    [esp+18h+arg_0]
00494F64  fld     [esp+18h+arg_0]
00494F68  fld     ds:dbl_DB0B60
00494F6E  fmul    st(1), st
```

### Magical damage variation

Function entry **`0x004951E0`**, RVA **`0x000151E0`**, IDA label `sub_4951E0`.

```asm
0049528B  call    _rand
00495290  mov     [esp+18h+arg_0], eax
00495294  fild    [esp+18h+arg_0]
00495298  fdiv    ds:dbl_DB0D00
0049529E  fstp    [esp+18h+arg_0]
004952A2  fld     [esp+18h+arg_0]
004952A6  fld     ds:dbl_DB0B60
004952AC  fmul    st(1), st
```

### Ordinary physical damage with hit flags

Function entry **`0x00495670`**, RVA **`0x00015670`**, IDA label `sub_495670`.

```asm
004959EF  test    bl, 2
004959F2  jz      short loc_4959FE
004959F4  fld     [esp+10h+arg_1C]
004959F8  fadd    st, st
004959FA  fstp    [esp+10h+arg_1C]
004959FE  fld     [esp+10h+arg_1C]
00495A02  mov     edx, [edi]
00495A04  fmul    [esp+10h+arg_14]
```

### Ordinary magical damage with hit flags

Function entry **`0x00495B30`**, RVA **`0x00015B30`**, IDA label `sub_495B30`.

```asm
00495DA0  push    0BDh ; '½'
00495DA5  mov     ecx, esi
00495DA7  call    eax
00495DA9  fadd    ds:dbl_DB0D38
00495DAF  fstp    [esp+18h+arg_14]
00495DB3  fld     [esp+18h+arg_14]
00495DB7  mov     edx, [esi]
00495DB9  fmul    [esp+18h+pRefSkill]
```

### Physical protection-wall damage

Function entry **`0x00495EF0`**, RVA **`0x00015EF0`**, IDA label `sub_495EF0`.

```asm
00495FC9  mov     edx, [eax+0Ch]
00495FCC  fild    dword ptr [eax+0Ch]
00495FCF  test    edx, edx
00495FD1  jge     short loc_495FD9
00495FD3  fadd    ds:flt_DAF9F8
00495FD9  fdiv    st, st(3)
00495FDB  mov     eax, [eax+8]
00495FDE  test    eax, eax
```

### Magical protection-wall damage

Function entry **`0x004961D0`**, RVA **`0x000161D0`**, IDA label `sub_4961D0`.

```asm
00496270  mov     ecx, [eax+0Ch]
00496273  fild    dword ptr [eax+0Ch]
00496276  test    ecx, ecx
00496278  jge     short loc_496280
0049627A  fadd    ds:flt_DAF9F8
00496280  fdiv    st, st(3)
00496282  mov     edx, [eax+8]
00496285  test    edx, edx
```

### Integer clamp used by absolute damage

Function entry **`0x0054E680`**, RVA **`0x000CE680`**, IDA label `CLAMP_FOR_CEnchant_Bless_sub_54E680`.

```asm
0054E68D  mov     edi, [esp+0Ch+max]
0054E691  mov     ecx, [edi]
0054E693  cmp     eax, ecx
0054E695  jle     short loc_54E6C4
0054E697  push    ecx
0054E698  mov     ecx, dword ptr [esp+10h+arg_C]
0054E69C  push    eax
0054E69D  mov     eax, dword ptr [esp+14h+arg_C+4]
```

### Monster attack-endpoint multiplier

Function entry **`0x0058BA30`**, RVA **`0x0010BA30`**, IDA label `sub_58BA30`.

```asm
0058BA6C  pop     esi
0058BA6D  jnz     short loc_58BA7B
0058BA6F  fld     [esp+4+var_4]
0058BA72  fmul    ds:dbl_DC9D60
0058BA78  fstp    [esp+4+var_4]
0058BA7B  fld     [esp+4+var_4]
0058BA7E  pop     ecx
0058BA7F  retn
```

### Monster outer skill-hit multiplier

Function entry **`0x0058C360`**, RVA **`0x0010C360`**, IDA label `sub_58C360`.

```asm
0058C434  fld     [esp+0Ch+var_C]; jumptable 0058C3DF case 7
0058C437  fmul    ds:dbl_DC9D98
0058C43D  fstp    [esp+0Ch+var_4]
0058C441  fld     [esp+0Ch+var_4]
0058C445  add     esp, 0Ch
0058C448  retn
0058C449  fld     [esp+0Ch+var_C]; jumptable 0058C3DF case 9
0058C44C  fmul    ds:dbl_DC9D90
```

### Summon caller: WORD sum and minimum damage

Function entry **`0x006A26E0`**, RVA **`0x002226E0`**, IDA label `sub_6A26E0`.

```asm
006A28BB  call    sub_4946F0; #STR: ".\\Formulae.cpp"
006A28C0  add     eax, [esp+18h+var_4]
006A28C4  movzx   eax, ax
006A28C7  test    ax, ax
006A28CA  mov     [esp+18h+arg_4], eax
006A28CE  ja      short loc_6A28D8
006A28D0  mov     [esp+18h+arg_4], 1
006A28D8  mov     edx, [esi]
```

### Ordinary skill caller: final target-ratio scaling

Function entry **`0x006B7880`**, RVA **`0x00237880`**, IDA label `CSkillManager__ProcessSkillAction_6B7880`.

```asm
006B88DC  movzx   ecx, byte ptr [eax+5]
006B88E0  imul    ecx, [esi+20h]
006B88E4  test    ecx, ecx
006B88E6  mov     [esp+170h+var_160], ecx
006B88EA  fild    [esp+170h+var_160]
006B88EE  jge     short loc_6B88F6
006B88F0  fadd    ds:flt_DAF9F8
006B88F6  fdiv    ds:dbl_DB0B60
```