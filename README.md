# Teyvat Chronicles

**Wake up in Teyvat. Every choice is yours. Every panel is drawn just for you. And the canon never breaks.**

An AI-driven, manga-paneled text adventure where you create an OC who wakes up inside the world of Genshin Impact. Every turn, Gemini writes a new narrative beat, Imagen 3 draws a black-and-white manga panel, and your choices ripple through bonds, flags, and a living story spine — all anchored to the actual Genshin canon.

Built with **Claude Code** + **Google AI Studio** (Gemini, Imagen, Vertex AI) as a proof that probabilistic LLMs can be trusted with beloved IP — if you give them the right architecture.

<p align="center">
  <img src="screenshots/01-landing.png" width="420" alt="Title screen" />
</p>

---

## What it feels like to play

- You're an OC traveller with a custom name, element/Vision, and appearance
- Each scene: an Imagen-3-generated manga panel, Gemini's narration, 3 timed Telltale-style choices
- Characters remember what you did. "Paimon will remember that."
- BGM cross-fades to match the mood. SFX fires on key actions.
- You can save, branch timelines, and export any scene to a manga PDF
- The story advances through authored canon beats — hitting the same emotional checkpoints as the game, but shaped entirely by your choices

### Create your character (5 steps)

<table>
  <tr>
    <td align="center"><img src="screenshots/02-creation-step0.png" /><br/><sub>Name + appearance</sub></td>
    <td align="center"><img src="screenshots/03-creation-step1.png" /><br/><sub>Form, Paimon, backstory</sub></td>
    <td align="center"><img src="screenshots/04-creation-step2.png" /><br/><sub>Vision / Element</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="screenshots/05-creation-step3.png" /><br/><sub>Elemental Skill</sub></td>
    <td align="center"><img src="screenshots/06-creation-step4.png" /><br/><sub>Elemental Burst → descend</sub></td>
    <td align="center"><img src="screenshots/07-avatar-reveal.png" /><br/><sub>Vessel manifested</sub></td>
  </tr>
</table>

### Imagen 3 generates your avatar

After creation, Imagen 3 renders a full character sheet — then Gemini-vision extracts an `enhancedDescription` that keeps every subsequent manga panel visually consistent.

<p align="center">
  <img src="screenshots/08-avatar-lightbox.png" width="360" alt="Imagen-3 generated character art" />
</p>

---

## The lore-drift problem (and how this solves it)

Most AI fanfic chatbots break canon within 3 exchanges. The LLM hallucinates lore, teleports characters, or lets you skip pivotal moments entirely. For a fandom like Genshin — where players are deeply invested in the world's internal logic — this kills immersion immediately.

**Teyvat Chronicles solves this with a two-layer architecture:**

1. **An authored "canon beat" spine** — deterministic JSON checkpoints that anchor the story to real Genshin story beats
2. **AI fills the space between** — everything inside a beat (tone, pacing, player banter, side observations) is generative and responsive to your choices

The result: the story is always heading somewhere real, but the journey is entirely yours.

---

## Features

- Imagen-3-generated black-and-white manga panels, one per turn
- Character-consistent avatar portraits (Gemini vision extracts an `enhancedDescription` on creation, reused on every panel)
- Mood-aware BGM cross-fade (7 moods, 500ms transition via `requestAnimationFrame`)
- AI-driven SFX cues per turn
- Telltale-style choice flags ("X will remember that" toasts)
- Bonds & relationship tracking with per-turn deltas
- Rolling summarization every 5 turns to prevent context drift
- Dual-pipeline RAG for lore accuracy (details below)
- Region travel locks enforced server-side — the AI cannot break story progression
- Saveable sessions cloned as immutable snapshots (branchable timeline)
- Manga PDF export via `html-to-image` + `jspdf`
- DB backup/restore (zip-split for large saves)
- Browser TTS with per-character voice/pitch heuristics

### Gameplay — manga panels, narration, choices, HUD

Every turn produces a new Imagen-3 manga panel, Gemini narration, and 3 timed choices — all in one view. The HUD tracks HP, chapter, saves, and rollback.

<p align="center">
  <img src="screenshots/11-gameplay-turn1-prompt.png" width="780" alt="Full gameplay view — turn 1" />
</p>

### The story unfolds turn by turn

<table>
  <tr>
    <td align="center"><img src="screenshots/12-gameplay-turn2-result.png" /><br/><sub>Paimon grounds you in the lore</sub></td>
    <td align="center"><img src="screenshots/12-gameplay-turn3-result.png" /><br/><sub>Mondstadt comes into view</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="screenshots/12-gameplay-turn4-result-dialogue-visible.png" /><br/><sub>Testing your Electro powers — Paimon reacts</sub></td>
    <td align="center"><img src="screenshots/13-gameplay-saved.png" /><br/><sub>"Progress enshrined in the Ley Lines!"</sub></td>
  </tr>
</table>

### Save, load, and export

<table>
  <tr>
    <td align="center"><img src="screenshots/15-load-screen.png" /><br/><sub>Load screen — saves with panel thumbnails</sub></td>
    <td align="center"><img src="screenshots/17-manga-export-modal.png" /><br/><sub>Export your adventure as a manga PDF</sub></td>
  </tr>
</table>

**[Download the example manga PDF (Lumina's story, real gameplay export)](https://github.com/akash-r34/Teyvat-Chronicles-public/releases/download/v1.0.0/Save_.Lumina.pdf)** — cover page, table of contents, character roster, every Imagen-3 panel from the session, epilogue stats. Generated straight from the game, no manual editing.

---

## The Beat System

The headline mechanic. The game has a spine of authored **canon beats** — JSON checkpoints that mirror key story moments from Genshin Impact, region by region.

Each beat looks like this:

```json
{
  "id": "mond.01",
  "title": "Awakening on the Beach",
  "required_npcs": ["Paimon"],
  "location": "Starfell Valley Beach",
  "must_happen": [
    "Player wakes up on the beach",
    "Paimon introduces herself and explains they've been travelling together for two months",
    "Paimon suggests heading to a Statue of The Seven"
  ],
  "canon_dialogue_hooks": [
    "Paimon: \"We've been travelling together for two months now! Paimon will do her best as a good guide!\""
  ],
  "player_freedom": [
    "Player can be grateful, confused, or annoyed by Paimon."
  ],
  "forbidden": ["Skip the beach scene", "Kill Paimon"],
  "emotional_register": "curiosity, confusion, hope",
  "exit_when": ["Player agrees to follow Paimon to the Statue of The Seven"],
  "location_flexible": false
}
```

**How the two-level FSM works** (`src/server/canon.ts`, `src/server/aiRouter.ts`):

- **Micro level**: each `must_happen` event is completed sequentially. The first un-completed event is injected as `CURRENT OBJECTIVE` in the Gemini prompt every turn.
- **Macro level**: once all `must_happen` events fire, `exit_when` becomes the objective. When the AI signals `mainGoalComplete: true`, the server calls `getNextBeat()` and may unlock the next region.
- **Region locks**: `regionOfLocation()` checks every AI-proposed location against `sessions.unlocked_regions`. Locked moves are silently dropped — the AI cannot break the story arc even if it tries.
- **`canon_dialogue_hooks`**: canonical lines the AI can use verbatim. Grounds generative text in real Genshin dialogue.
- **`player_freedom`**: explicitly enumerates legal player reactions per beat. The AI stays on rails while still feeling responsive.

Region files live in `data/canon/` (`01_mondstadt.json` through `09_endgame.json`). Beat schema: `data/canon/_schema.json`. 8-step authoring workflow: `data/canon/README.md`.

---

## Other clever mechanics

### Dual-pipeline RAG (the lore accuracy engine)

Two separate pipelines inject lore context into every prompt:

**1. Noun Harvester** (`src/server/nounHarvester.ts`)
- Extracts capitalized proper nouns from the current narrative via regex
- Resolves against `lore_entity_aliases` (e.g. "Mondstadt" → canonical entry)
- If an entity is missing from the DB: auto-fetches it via **Gemini with Google Search grounding**, embeds it with `text-embedding-004`, and stores it in SQLite
- Seeds 8 foundational Genshin terms at boot from `data/genshin_seed.json`
- Output → `ENTITY LORE:` block in the prompt (named-entity precision)

**2. Hybrid Retrieval** (`src/server/retrieval.ts`)
- FTS5 full-text keyword search + `sqlite-vec` cosine similarity over 768-dimension embeddings
- Naive merge + deduplicate
- Output → `RETRIEVED LORE & VISUALS:` block (thematic breadth)

Together: named entities are always exactly right; thematic context is rich and relevant.

### Rolling summarization

Every 5 turns, `src/server/summarize.ts` compresses session history into ≤400 tokens, preserving vows, unresolved threads, and relationship states. Keeps the context window focused — not a 40-turn transcript.

### Telltale-style emergent gameplay

- Per-turn `relationshipDelta[]` UPSERTs into a `relationships` table → "X will remember that" HUD toasts
- Side goals are emergent: any non-main-goal player action the AI notices becomes a tracked `side_goal`
- Hierarchical goal stack: `surfaceGoal` / `regionalGoal` / `hiddenArcGoal` / `currentQuest` / `mainGoal`
- `choice_flags` replayed into every prompt as `PAST PLAYER CHOICES (Flags):` — the AI remembers commitments across sessions

### Schema-enforced JSON with auto-correcting retry

Every AI response is a structured JSON object covering ~20 fields (`narrative`, `dialogue`, `imagePrompt`, `choices`, `relationshipDelta`, `bgmMood`, `sfxAction`, `locationChange`, `mainGoalComplete`, etc.). On a parse failure, the router lowers temperature by 0.2 and appends a strict JSON-only reminder before retrying once.

### Visual character consistency

On avatar creation, a Gemini-vision pass extracts an `enhancedDescription` from the generated portrait. This description is injected into every subsequent image prompt — the character looks the same panel after panel.

### Mood-aware audio

The AI sets a `bgmMood` field every turn (one of 7 values). `AudioManager.tsx` maps this to a BGM track and cross-fades over 500ms via `requestAnimationFrame`. `sfxAction` fires 250ms after the panel appears. Both are gated behind a first-interaction promise to handle browser autoplay policy.

### Saves as immutable session clones

Loading a save clones it to a new session ID. Every load is a branchable snapshot, not a destructive overwrite — you can explore different choices from the same save point.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 6, TypeScript, Tailwind CSS v4 |
| Animation | Framer Motion v12 |
| Backend | Express 4 on Node (Vite middleware in dev — single port 3000) |
| Database | better-sqlite3 (WAL mode) + sqlite-vec extension |
| Story AI | Vertex AI → `gemini-2.5-flash` (structured JSON output) |
| Vision AI | Vertex AI → `gemini-3-flash-preview` (avatar enhancement, lore vision) |
| Image AI | Vertex AI → `imagen-3.0-generate-002` (manga panels, 16:9) |
| Embeddings | Vertex AI → `text-embedding-004` (768d, stored in sqlite-vec) |
| Lore search | Direct Gemini API → Search grounding (`tools: [{ googleSearch: {} }]`) |
| TTS | Web Speech API (per-character pitch/voice heuristics) |
| PDF export | html-to-image + jspdf |

**Why two separate Google credential paths?** Vertex AI handles story/image/embeddings. The direct Gemini API is used only for Search-grounded noun harvesting — because Search grounding isn't available via the same Vertex path.

---

## How this was built (the agentic coding story)

Built almost entirely using **Claude Code** as a pair-programmer and **Google AI Studio** for iterating on Gemini prompts and Imagen art styles.

The workflow:
1. Rough feature spec → Claude Code plans the implementation (`/plan` mode)
2. Multi-agent research: one agent explores existing patterns, another drafts the approach
3. Claude Code implements; I review diffs and steer
4. Prompt engineering iterations in AI Studio (structured-output schema tuning, temperature anneal strategy, two-pipeline RAG design)
5. Ship

**Key engineering decisions worth studying:**

- **Structured-output JSON schema** with 20+ fields keeps every AI response machine-parseable — no regex scraping, no hallucinated field names
- **Temperature anneal on parse failure** (lower by 0.2, append JSON reminder) handles the ~2% of responses that wander outside schema
- **Two-key strategy** (Vertex for most calls + direct Gemini API for Search grounding) because the two APIs have different capability surfaces
- **`canon_dialogue_hooks` in every beat** — giving the LLM actual canonical lines dramatically reduces generic-sounding output without over-constraining the player's experience
- **Server-side region locks** — enforced in the Express router, not just in the prompt, so the AI literally cannot move the player to a locked region even if it tries

---

## Run it locally

### Prerequisites

- Node 20+
- A Google Cloud project with the **Vertex AI API** enabled
- `gcloud` CLI installed → run `gcloud auth application-default login`
- A **Gemini API key** (for Search-grounded lore fetching) from https://aistudio.google.com/app/apikey

### Setup

```bash
git clone https://github.com/akash-r34/Teyvat-Chronicles-public
cd Teyvat-Chronicles
npm install
cp .env.example .env.local
# Fill in MY_GEMINI_API_KEY, GOOGLE_CLOUD_PROJECT, GOOGLE_APPLICATION_CREDENTIALS
npm run dev
# Open http://localhost:3000
```

**First boot**: the server creates `data/teyvat.db`, bootstraps the `sqlite-vec` extension, and seeds 8 foundational Genshin lore entities. Expect a 20–30 second warm-up on first run.

---

## Fork it for your fandom

The beat system, RAG pipelines, and lore-fidelity guarantees are **completely IP-agnostic**. You can reskin this for Naruto, One Piece, Lord of the Rings, Stormlight Archive, Re:Zero, Attack on Titan, Demon Slayer — anything with a structured world and a story you love.

Here's exactly what to change:

### 1. Re-author the canon beats (`data/canon/*.json`)

Regions → arcs or sagas. Beats → key story checkpoints. Use the schema at `data/canon/_schema.json` and the 8-step authoring workflow in `data/canon/README.md`. Roughly 3–5 beats per arc feels structured without feeling on rails.

### 2. Replace the seed entities (`data/genshin_seed.json`)

Swap the 8 bootstrap lore entries for the foundational concepts of your world (factions, power systems, named locations, key characters). The noun harvester auto-fills the rest via Search grounding as the game runs — you don't need to curate a wiki manually.

### 3. Update the system instruction (`src/server/aiRouter.ts`, `SYSTEM_INSTRUCTION` near line 31)

Swap the "Genshin Impact" flavour text. Keep the structural rules: player agency, region locks, Telltale tracking, sound direction. Those are the architecture — only the world description is IP-specific.

### 4. Change the manga style boilerplate (same file, `generateMangaImageInternal`)

Change `"official Genshin Impact manga art style, screentones, dramatic lighting"` to whatever fits your world:
- `"official One Piece manga art style, bold linework, dynamic action panels"`
- `"shoujo light novel illustration, soft screentones, expressive eyes"`
- `"dark fantasy graphic novel, heavy shadows, european ligne claire"`

### 5. Reskin Character Creation (`src/components/CharacterCreation.tsx`)

Replace the Vision/Element step with your fandom's power system:
Stands (JoJo) / nen type (HxH) / jutsu affinity (Naruto) / devil fruit (One Piece) / Allomantic metal (Mistborn) / surge (Stormlight) / bending element (ATLA) / etc.

### 6. Update the BGM region mapping (`src/components/AudioManager.tsx`, `regionDefaultBgm`)

Map your arcs/regions to BGM tracks. Drop your audio files into `public/audio/bgm/`.

### 7. Tweak voice heuristics (`src/services/voice.ts`)

Character name → pitch/voice overrides. Deterministic hashing assigns voices to unknown characters automatically.

**The lore-fidelity guarantees carry over for free.** The beat FSM enforces your authored checkpoints. The noun harvester auto-builds a lore index for any IP using Search grounding. The hybrid RAG retrieves it accurately. The region locks prevent the AI from skipping ahead.

> Fork on Friday. Play on Sunday.

---

## Project structure

```
Teyvat-Chronicles/
├── server.ts                    # Express entry + debug test endpoints (/api/vertex-test, /api/gemini-test)
├── src/
│   ├── App.tsx                  # Top-level FSM: title | load | creation | reveal | playing
│   ├── types.ts                 # Shared TypeScript interfaces
│   ├── components/
│   │   ├── GameChat.tsx         # Main play screen: HUD, choices, toasts, save/rollback
│   │   ├── MangaPanel.tsx       # Panel renderer
│   │   ├── AudioManager.tsx     # BGM cross-fade + SFX
│   │   ├── CharacterCreation.tsx
│   │   ├── TitleScreen.tsx
│   │   └── manga-export/        # PDF export pipeline
│   ├── services/
│   │   ├── aiService.ts         # Fetch wrappers for all API calls
│   │   └── voice.ts             # Web Speech TTS heuristics
│   └── server/
│       ├── aiRouter.ts          # The brain: prompt building, AI calls, state mutations
│       ├── canon.ts             # Beat loader, getNextBeat, regionOfLocation
│       ├── db.ts                # SQLite schema + sqlite-vec bootstrap
│       ├── embeddings.ts        # text-embedding-004 wrapper
│       ├── nounHarvester.ts     # Entity extractor + Search-grounded auto-fetcher
│       ├── retrieval.ts         # Hybrid FTS5 + vec retrieval
│       ├── summarize.ts         # Rolling 5-turn summarization
│       └── routes/              # session, save, images, dbAdmin
├── data/
│   ├── genshin_seed.json        # 8 bootstrap lore entities (swap for your IP)
│   └── canon/
│       ├── _schema.json         # Beat JSON schema
│       ├── README.md            # 8-step beat authoring workflow
│       ├── 01_mondstadt.json
│       └── ...                  # 02_liyue through 09_endgame
├── scripts/
│   ├── canon_audit.ts           # Validate all beats against schema
│   ├── canon_new_region.ts      # Scaffold a new region file
│   ├── build_mond.ts            # Example: script used to author the Mondstadt beats
│   ├── update_canon_schema.mjs  # Propagate schema changes across all region files
│   ├── fetch_audio.sh           # Download CC0 audio assets
│   └── recover.sh               # Wipe DB + re-fetch audio for a clean slate
└── public/audio/{bgm,sfx}/      # CC0 music + OGG/MP3 sound effects
```

---

## Status

**Authored regions**: Mondstadt, Liyue, Inazuma, Sumeru, Fontaine, Natlan. Snezhnaya and endgame stubs present.

**Known limits**:
- Imagen 3 occasionally drifts on character consistency in complex scenes
- TTS quality varies by OS and browser (it's the native Web Speech API)
- Search-grounded entity fetching adds ~2s on first encounter of a new lore entity; subsequent turns are served from SQLite cache

---

## Credits

- **Genshin Impact** © HoYoverse — non-commercial fan project; all canon characters, locations, and dialogue hooks belong to HoYoverse
- Background music: CC0 tracks (see `scripts/fetch_audio.sh`)
- Sound effects: CC0, OGG + MP3 dual-format
- Built with [Claude Code](https://claude.ai/code) + [Google AI Studio](https://aistudio.google.com)

---

## License

Code: **MIT**. Fork it, build with it, ship your own fandom game.

The `data/canon/*.json` files are fan-authored derivative works based on Genshin Impact story content. If you fork this for a different IP, make sure your canon files respect that IP holder's fan content policies — most major franchises publish explicit fan-creation guidelines.
