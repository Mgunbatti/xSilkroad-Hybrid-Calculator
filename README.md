# xSilkroad Hybrid Calculator

Static Chinese STR/INT build calculator with six separate results: normal attack, physical skill, nuke, normal + imbue, physical skill + imbue, and nuke + imbue. Critical ranges double only the physical component before core truncation.

The UI starts with the explicitly labeled historical Lv100 bow AP example and database-backed starter skills. Replace the example with your own C-screen ranges. Learned mastery **levels** are in Advanced Settings and must not exceed character level; zero means no learned mastery. Changing the normal-attack mastery preserves manual equipment, skill and stat entries.

Normal descriptors are Bicheon sword/blade 60%, Heuksal spear/glaive 117%, Pacheon bow 84%. Physical skills and nukes use their own rates. The default historical imbue mapping uses the attacking normal/physical skill rate and applies elemental mastery to magical AP plus imbue AP. The alternative recovered secondary caller requires explicit descriptor secondary percentages; see [the adapter specification](docs/HYBRID_FORMULA.md).

Weapon-tooltip mode estimates AP from weapon values and reinforcement and compares Full STR / Your Build / Full INT. Character-displayed-AP mode accepts the selected build's AP directly; other builds cannot be predicted from that AP alone, so their comparisons are unavailable. Physical displayed AP is never mastered twice. Magical AP in this adapter is the base before the selected elemental mastery.

[Recovered binary formula](docs/DAMAGE_FORMULA.md) · [Validation and known differences](docs/VALIDATION.md)

## Verification

- `npm test` (or `node --test tests/*.cjs`): core, hybrid and live-game regressions.
- `npm run build`: script syntax checks; there is no generated bundle.
- `npm install` then `npm run test:ui`: Playwright end-to-end test with installed Chrome. Set `BROWSER_CHANNEL=msedge` to use Edge. Screenshots are written to the system temporary directory, or `UI_ARTIFACT_DIR` when specified.

The runtime has no package dependencies. Serve this directory over HTTP: skill catalogues and non-English language packs use relative fetches. Browser tests cover all six results, manual data preservation, mastery validation, reset, localization and mobile overflow.

## Languages and skill names

Use the header language selector for English, Turkish, Arabic, Persian, Vietnamese, Thai, Indonesian, Russian, Brazilian Portuguese, Spanish, German, French, Polish, Romanian, Korean or Simplified Chinese. English is the default and fallback; your choice is saved locally. Arabic and Persian support RTL. Language changes preserve build inputs and calculation results.

UI translations are separate from sourced game names. Exact client text is available for English, Vietnamese and Korean; other languages use clearly marked English names. Unverified names retain their DB codes. [Community evidence, naming provenance, limitations and translation maintenance](docs/LOCALIZATION.md) documents why each language is included without claiming unsupported country popularity. Edit `locales/*.json`; run `npm run i18n:sync` after changing English messages.

## Publication

Review the working branch/PR before merging. The existing main branch may publish GitHub Pages; this implementation does not merge or deploy automatically.
