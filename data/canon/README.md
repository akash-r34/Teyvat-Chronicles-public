# Teyvat Tales Story Bible Authoring Guide

The bible is **living documentation of canon as Genshin keeps shipping**. Treat it like a versioned content repo.

## Repo layout

```
data/canon/
  README.md                           ← this file
  _schema.json                        ← JSON Schema for beat files (validated in CI)
  _spoiler-tiers.json                 ← master list of lore_keys + their canonical region of unlock
  _changelog.md                       ← every patch / new region noted with date & version

  00_prologue.json                    ← awakening, character creation aftermath
  01_mondstadt.json                   ← Prologue: The Outlander Who Caught the Wind
  ...
```

## Beat file schema

See `_schema.json`.

## Authoring workflow per region

1. **Source of truth pass.** Watch a playthrough (HoYo-Wiki + YouTube). Note event order.
2. **Beat decomposition.** Group events into 25–40 beats. "one scene + one decision".
3. **Player-freedom pass.** For each beat, ask: *what can the player change without breaking canon?*
4. **Forbidden pass.** Write down what the AI must *never* do here (e.g. killing off a required NPC).
5. **Lore-gate pass.** Decide which `lore_keys` this region's beats unlock cross-referencing `_spoiler-tiers.json`.
6. **Dialogue-hook pass.** Add 1–3 iconic lines paraphrased per beat.
7. **Playtest pass.** Run playthroughs, watch for lore leaks.
8. **Sign-off.** Update `last_reviewed`, `version`, add changelog entry.

## Keeping current

- Use `_changelog.md` to note patch updates.
- Keep `version` bumped.
- Only pull from official sources (HoYoWiki `Archon Quests`, in-game `Travail`).
- If an Archon Quest hasn't completed, mark `region_unfinished: true`.

## Tooling

- Use `npm run canon:audit` to validate schemas.
- Use `npm run canon:new-region` to scaffold.
