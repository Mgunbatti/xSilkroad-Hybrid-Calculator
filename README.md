# xSilkroad Hybrid Calculator

Static Chinese STR/INT build calculator with five separate results: normal attack, physical skill, nuke, normal + imbue, and physical skill + imbue. Critical ranges double only the physical component before core truncation.

Equipment and optional skill inputs start empty. Enter Weapon Values and learned mastery **levels** in Advanced Settings. Mastery levels must not exceed character level; zero explicitly means no learned mastery. Changing the normal-attack mastery preserves all manual equipment, skill and stat entries.

Normal descriptors are Bicheon sword/blade 60%, Heuksal spear/glaive 117%, Pacheon bow 84%. Physical skills and nukes use their own rates. The default historical imbue mapping uses the attacking normal/physical skill rate and applies elemental mastery to magical AP plus imbue AP. The alternative recovered secondary caller requires explicit descriptor secondary percentages; see [the adapter specification](docs/HYBRID_FORMULA.md).

Weapon-tooltip mode estimates AP from weapon values and reinforcement and compares Full STR / Your Build / Full INT. Character-displayed-AP mode accepts the selected build's AP directly; other builds cannot be predicted from that AP alone, so their comparisons are unavailable. Physical displayed AP is never mastered twice. Magical AP in this adapter is the base before the selected elemental mastery.

[Recovered binary formula](docs/DAMAGE_FORMULA.md) · [Validation and known differences](docs/VALIDATION.md)

## Verification

- `npm test` (or `node --test tests/*.cjs`): core, hybrid and live-game regressions.
- `npm run build`: script syntax checks; there is no generated bundle.
- `npm install` then `npm run test:ui`: Playwright end-to-end test with installed Chrome. Set `BROWSER_CHANNEL=msedge` to use Edge. Screenshots are written to the system temporary directory, or `UI_ARTIFACT_DIR` when specified.

The runtime has no package dependencies. Open `index.html` directly or serve this directory. Browser tests cover blank defaults, the five results, manual data preservation, mastery validation, reset and mobile overflow.

## Publication

Review the working branch/PR before merging. The existing main branch may publish GitHub Pages; this implementation does not merge or deploy automatically.
