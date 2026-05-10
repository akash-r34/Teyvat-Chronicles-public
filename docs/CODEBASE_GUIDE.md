# Teyvat Tales: Isekai Chronicles — Complete Codebase Guide

**Teyvat Tales: Isekai Chronicles** is a manga-paneled, AI-driven text adventure where a player creates an original character who wakes up inside the world of Genshin Impact. Every turn the player takes produces a Gemini-generated narrative, an Imagen-3-generated manga panel, and a set of dialogue choices — all while a deterministic story spine (the "canon beat system") keeps the adventure on track. The game runs as a full-stack TypeScript application: React on the front end, Express on the back end, and SQLite for all persistence.

---

## Who this guide is for

Anyone comfortable reading JavaScript or TypeScript who wants to understand how this project works, extend it, or debug it. You do not need to know Genshin Impact lore to read this guide — all domain terms are defined in the glossary below. You do not need prior experience with Vertex AI, Google Cloud, or sqlite-vec.

---

## How to read this guide

Read top-to-bottom for a full mental model. Jump to a section heading if you know what you're looking for. Inline references follow the format `file.ts:LINE` so you can open the exact line in your editor. Code excerpts are real — copy-pasted from the actual source.

---

## Glossary

| Term | Meaning in this project |
|------|-------------------------|
| **Beat** | One story checkpoint in the canon system. Has a title, a required location, a set of `must_happen` events, and a `main_goal` exit condition. |
| **Canon** | The authored JSON story bible at `data/canon/`. It defines the deterministic spine of the adventure across all regions. |
| **Isekai** | Japanese storytelling concept: a character from one world is transported to another. The player's character is "isekai'd" into Teyvat. |
| **Paimon** | Genshin Impact's main companion character — a small floating girl who serves as guide. Optional companion in character creation. |
| **Vision** | In Genshin lore, a magical gem that grants elemental power. Each player character has one element (Anemo/Geo/Electro/Dendro/Hydro/Pyro/Cryo). |
| **Element** | One of seven elemental types matching a Vision. Affects the character's skill and ultimate flavour. |
| **Vertex AI** | Google Cloud's managed AI platform. Used here to call Gemini models and Imagen via Application Default Credentials (ADC). |
| **Gemini** | Google's large language model family. `gemini-2.5-flash` drives story generation; `gemini-3-flash-preview` handles summaries and avatar vision analysis. |
| **Imagen** | Google's image generation model family. `imagen-3.0-generate-002` draws manga panels and avatars. |
| **Embedding** | A list of 768 floating-point numbers that represent the semantic meaning of a text chunk. Used for vector search in the lore system. |
| **FTS5** | SQLite's built-in full-text search extension. Used for keyword-based lore retrieval. |
| **sqlite-vec** | A SQLite extension that adds a vector table type (`vec0`) and cosine-distance queries. Used alongside FTS5 for semantic lore retrieval. |
| **RAG** | Retrieval-Augmented Generation. The pattern of fetching relevant context from a database and injecting it into an LLM prompt. Used here for lore. |
| **HUD toast** | A transient UI notification that slides in from the right during gameplay — "X will remember that", "+15 HP!", "+Loot Plundered: Dull Blade", etc. |
| **Telltale-style** | Refers to Telltale Games' design pattern where player choices are remembered and surfaced as "X will remember that" notifications. This game implements the same mechanic. |
| **ADC** | Application Default Credentials — Google Cloud's mechanism for authenticating services without embedding an API key, using `GOOGLE_APPLICATION_CREDENTIALS`. |
| **Session** | One play-through identified by a UUID. All SQLite rows (character, history, inventory, relationships…) are scoped to a `session_id`. |

---

## §1 — What the project is

### The premise

Your player character arrives in Teyvat — the anime fantasy world of Genshin Impact — with no memory of how they got there. The character has a name, appearance, gender, elemental power, a skill, and an ultimate ability, all chosen by the player in a creation wizard. Optionally, Paimon (the game's iconic companion) joins them.

The adventure is told as a **manga reader**: each turn generates a black-and-white manga panel image, a narrator description ("narrative"), one speaking character ("speaker" + "dialogue"), and 2–4 dialogue choices the player can pick. The player can also type free-form actions. The game tracks HP, inventory, quest state, NPC relationships, and a canonical story spine across multiple regions.

### The core loop

```
Player picks a choice (or types free text)
       ↓
Client POSTs to /api/generateStoryTurn
       ↓
Server assembles a rich prompt (canon beat + character state + lore)
       ↓
Gemini generates structured JSON (narrative, dialogue, choices, deltas)
       ↓
Imagen-3 generates the manga panel image
       ↓
SQLite transactions update all state (HP, inventory, relationships, flags…)
       ↓
JSON response sent to client
       ↓
Client re-fetches updated character state
       ↓
React renders new MangaPanel + HUD toasts + plays BGM/SFX + TTS
       ↓
Player reads, listens, and picks the next choice
```

### Visible features

- **Title screen** — New Game / Load Game / Settings
- **Character creation** — 5-step wizard (name → gender/companion → element → skill → ultimate)
- **Avatar reveal** — Imagen-3-generated full-body portrait with regenerate option
- **Manga reader** — Scrollable strip of panels, each with a 16:9 AI-generated image, narrative caption, and speech bubble
- **Choices overlay** — Telltale-style choice buttons colour-coded by tone (green = kind, blue = pragmatic, red = aggressive, purple = curious), plus a free-text input box, plus SKILL and ULTIMATE quick-action buttons
- **HUD sidebar** — Character card (avatar, name, element), main goal, side goals log, inventory satchel, bond affinities
- **HUD toasts** — Flying notifications for relationship shifts, flags, goal completions, item gains/losses, HP changes
- **Audio** — Looping BGM that cross-fades per scene mood; one-shot SFX on key events; browser TTS for dialogue
- **Save / load / rollback** — Manual saves, load from a list, rollback to undo the last turn

---

## §2 — Tech stack at a glance

| Layer | Technology | Version | Role |
|-------|-----------|---------|------|
| Frontend framework | React | 19.0 | UI components and state |
| Bundler / dev server | Vite | 6.2 | Build tooling, HMR (disabled), SPA serving |
| Styling | Tailwind CSS | 4.1 | Utility classes; v4 plugin for Vite |
| Animation | motion (Framer Motion v12) | 12.23 | AnimatePresence, slide-in toasts |
| Icons | lucide-react | 0.546 | UI icons (Save, Undo, Settings, etc.) |
| Server | Express | 4.21 | REST API endpoints |
| TypeScript runner | tsx | 4.21 | Runs `.ts` files directly; no compile step for dev |
| AI SDK | @google/genai | 1.29 | Unified SDK for Vertex AI and Gemini Direct API |
| Story/summary model | gemini-2.5-flash | — | Main story generation (env-overridable via `GEMINI_MODEL`) |
| Avatar/vision model | gemini-3-flash-preview | — | Vision analysis of generated avatars; rolling summaries |
| Image model | imagen-3.0-generate-002 | — | Manga panel and avatar generation (Imagen-3 fast as fallback) |
| Embedding model | text-embedding-004 | — | 768-dimensional embeddings for lore vector search |
| Database | better-sqlite3 | 12.9 | Synchronous SQLite bindings for Node |
| Vector search | sqlite-vec | 0.1.9 | `vec0` virtual table + `vec_distance_cosine` |
| Env management | dotenv | 17.2 | Loads `.env` into `process.env` |
| TTS | Web Speech API | browser | `SpeechSynthesisUtterance`, no server dependency |
| Audio assets | CC0 BGM/SFX | — | Vendored in `public/audio/` |

**Auth for AI**: Vertex AI calls use Google Cloud ADC (`GOOGLE_APPLICATION_CREDENTIALS` + `GOOGLE_CLOUD_PROJECT`). The noun harvester's Google-Search-grounded calls use a direct Gemini API key (`MY_GEMINI_API_KEY`) because Vertex does not expose `googleSearch` tools in the same way.

---

## §3 — Repository tour

```
teyvat-tales_-isekai-chronicles/
├── package.json          # NPM manifest + scripts
├── tsconfig.json         # TypeScript compiler config (no emit)
├── vite.config.ts        # Vite + React + Tailwind + alias setup
├── index.html            # SPA entry; mounts <div id="root">; preloads BGM
├── metadata.json         # AI Studio applet manifest (name, description)
├── .env.example          # Template for the five required env vars
├── README.md             # Minimal AI Studio placeholder
├── server.ts             # Express server entrypoint
├── src/
│   ├── main.tsx          # ReactDOM root
│   ├── App.tsx           # Top-level state machine
│   ├── index.css         # Tailwind v4 + custom fonts + manga utilities
│   ├── types.ts          # Shared TypeScript interfaces
│   ├── components/       # React UI components
│   └── services/         # Client-side fetch wrappers + audio/TTS
│       └── server/       # (Note: lives at src/server/, not inside services/)
├── src/server/           # Express routers + all AI/DB logic
│   ├── aiRouter.ts       # Core AI endpoint logic (663 lines)
│   ├── canon.ts          # Canon beat loader and navigator
│   ├── db.ts             # SQLite schema + bootstrap
│   ├── embeddings.ts     # Vertex text-embedding-004 wrapper
│   ├── nounHarvester.ts  # Proper-noun extractor + Google Search fetcher
│   ├── retrieval.ts      # Hybrid FTS5 + vector lore retrieval
│   ├── summarize.ts      # Rolling summarization every 5 turns
│   ├── saveMigrations.ts # Schema version stub
│   └── routes/
│       ├── session.ts    # /api/session endpoints
│       ├── save.ts       # /api/saves endpoints
│       └── images.ts     # /api/images/:id streaming
├── data/
│   ├── teyvat.db         # Runtime SQLite database (created on first run)
│   ├── genshin_seed.json # 8 bootstrap lore entities
│   └── canon/            # Authored story bible (JSON per region)
├── scripts/              # One-off build/migration/maintenance scripts
├── public/
│   └── audio/            # Vendored BGM + SFX assets
└── app/
    └── applet/
        └── add_keywords.js  # Orphaned draft (not built)
```

### Root config files

**`package.json`** — `"type": "module"` makes this an ESM project. Key scripts:
- `dev` → `tsx server.ts` (runs TypeScript directly in development)
- `start` → `node server.ts` (for production after `vite build`)
- `build` → `vite build` (compiles frontend to `dist/`)
- `lint` → `tsc --noEmit && npm run canon:audit`
- `canon:audit` → validates all `data/canon/*.json` files
- `canon:new-region` → scaffolds a new region JSON
- `audio:fetch` → downloads CC0 audio assets
- `recover` → wipes DB and re-runs audio fetch

**`tsconfig.json`** — `"noEmit": true` (TypeScript only validates; tsx/Vite handle actual compilation). `"moduleResolution": "bundler"` for Vite compatibility. Path alias `@/*` → project root.

**`vite.config.ts`** — React plugin + Tailwind v4 plugin. `hmr: false` is intentional — a comment says it prevents "flickering during agent edits" in the AI Studio environment. Path alias `@` → project root (`path.resolve(__dirname, '.')`).

**`index.html`** — Mounts `<div id="root">`, loads `/src/main.tsx`. Has a `<link rel="preload" as="audio" href="/audio/bgm/peaceful_town.mp3">` so BGM is already buffered when the title screen appears.

**`metadata.json`** — AI Studio applet manifest: name `"Teyvat Tales: Isekai Chronicles"`, a short description, no special permissions declared.

**`.env.example`** — The five environment variables you must configure:
```
GEMINI_API_KEY=            # Kept for compatibility, not actively used
MY_GEMINI_API_KEY=         # Direct Gemini API key for noun harvester Search
APP_URL=                   # Base URL of the deployed app
GOOGLE_CLOUD_PROJECT=      # GCP project ID for Vertex AI
GOOGLE_APPLICATION_CREDENTIALS=  # Path to service account JSON (ADC)
```

### Root test/diagnostic files

These are one-off scripts — not a test suite. Run them manually with `tsx filename.ts` or `node filename.mjs` to check connectivity.

| File | Purpose |
|------|---------|
| `test.ts` | POSTs a fake character to `/api/getInitialNode` via `node-fetch`. Basic smoke test. |
| `test_curl.ts` | GETs `/api/vertex-test` via `http.get`. Checks server is running + Vertex is reachable. |
| `test_global.ts` | Calls `gemini-3.0-flash` directly via Vertex with a hardcoded GCP project ID. |
| `test_initial_node.ts` | Same as `test.ts` but with a richer character payload. |
| `test_models.ts` | Probes `gemini-1.5-flash`, `gemini-1.5-flash-002`, `gemini-2.5-flash`, `gemini-2.0-flash` for availability. |
| `test_models2.ts` | Probes `gemini-3.0-pro` and `gemini-3.0-flash`. |
| `test_audio.mjs` | HEAD-requests each `/audio/*` path against the dev server to verify assets exist. |
| `test_sizes.mjs` | Lists byte sizes of all BGM files in `public/audio/bgm/`. |
| `verify_audio.ts` | Legacy — HEAD-requests external audio source URLs (OpenGameArt, Kenney) before assets were vendored. No longer relevant. |
| `check_vertex_migration.js` | Diagnostic helper: checks env vars, greps source for old `GEMINI_API_KEY` references, reports `@google/genai` version. Run when migrating auth methods. |

> **Caution**: Several test files (`test_global.ts`, `test_models2.ts`) contain a hardcoded partial GCP project ID (`project-df3b0f17-dc21-427c-8bb*`). These are dev scaffolding, not secrets, but they should be cleaned up before open-sourcing.

---

## §4 — Environment and first-run setup

### Required environment variables

Copy `.env.example` to `.env` and fill in:

```bash
MY_GEMINI_API_KEY=AIza...            # For noun harvester Google Search calls
GOOGLE_CLOUD_PROJECT=my-gcp-project  # For Vertex AI (story, images, embeddings)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json  # ADC service account
APP_URL=http://localhost:3000        # Base URL (used in some redirects)
```

**Why two different AI credentials?** Vertex AI (used for story generation, Imagen, embeddings) uses ADC — no API key, just the service account JSON and project ID. The noun harvester makes calls with `tools: [{ googleSearch: {} }]` which requires the **direct Gemini API key** path (`MY_GEMINI_API_KEY`), because that Search tool is not available through the same Vertex endpoint configuration.

### First run

```bash
npm install     # installs all dependencies including better-sqlite3 native bindings
npm run dev     # starts tsx server.ts on port 3000
```

On first run, `src/server/db.ts` executes its `CREATE TABLE IF NOT EXISTS` schema block — `data/teyvat.db` is created automatically. The WAL file (`teyvat.db-wal`) appears immediately. `sqlite-vec` is loaded as a SQLite extension to enable the `vec0` virtual table.

The `nounHarvester.ts` module calls `initSeed()` on import, which reads `data/genshin_seed.json` and populates `lore_entity_aliases` with 8 foundational Genshin terms (Mondstadt, Paimon, Fatui, Vision, Mora, Adventurers' Guild, Knights of Favonius, Abyss Order).

### Production

```bash
npm run build   # vite build → dist/
npm start       # node server.ts → serves static dist/ + API
```

In production, `server.ts` detects `NODE_ENV=production` and serves `dist/index.html` for all non-API routes (`app.get('*', ...)`). In development, the Vite dev middleware handles the SPA.

### Linting

```bash
npm run lint    # = tsc --noEmit && tsx scripts/canon_audit.ts
```

This validates TypeScript types (no emit) and then validates every `data/canon/*.json` has the required root fields (`region`, `beats`, etc.).

---

## §5 — Frontend architecture (`src/`)

### `src/main.tsx`

The React entry point. Calls `ReactDOM.createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)`. Nothing else.

### `src/App.tsx` — the status state machine

`App.tsx` is the top-level component and the only place the game's overall screen is decided. It uses a single `useState` call that holds:

```typescript
{
  character: Character | null,
  history: StoryNode[],
  status: 'title' | 'load' | 'creation' | 'reveal' | 'playing',
  loadedHistory?: StoryNode[]
}
```

The `status` field drives which screen is rendered (line 17–21). Transition functions:

| Function | Transition |
|----------|-----------|
| `handleNewGame` | `→ 'creation'` |
| `handleOpenLoad` | `→ 'load'` |
| `handleCharacterCreated(char)` | `→ 'reveal'` |
| `handleAvatarConfirmed(char)` | `→ 'playing'` |
| `handleLoadGame(saveId)` | POSTs to `/api/saves/:id/load`, then `→ 'playing'` with `loadedHistory` |
| `handleReturnToMenu` | `→ 'title'` |

**Audio and settings are always mounted** (`AudioManager` and `AudioSettingsModal` render regardless of status) so BGM can play on the title screen too.

**Save game detection** (line 41–47): On every status change, `App.tsx` fetches `/api/saves` to decide whether to enable the "Load Game" button on the title screen. The `hasSaveGame` boolean is passed to `TitleScreen`.

**Voice preferences** are persisted in `localStorage` under key `genshinVoicePrefs` (line 27–38). The `VoicePrefs` type has `{ enabled: boolean, volume: number, mode: 'dialogue-only' | 'narration-and-dialogue' }`.

**Session ID** is stored separately in `localStorage` under key `genshinMangaSession` as `{ sessionId: string }`.

### `src/types.ts` — shared data shapes

Every field documented:

```typescript
// The seven elemental types matching Genshin Impact's system
type ElementType = 'Anemo' | 'Geo' | 'Electro' | 'Dendro' | 'Hydro' | 'Pyro' | 'Cryo';

interface Character {
  name: string;
  gender: string;
  description?: string;        // Physical appearance, used in image prompts
  element: ElementType;
  skill: string;               // Short name of the elemental skill
  skillDesc?: string;          // User-written description of the skill
  ultimate: string;            // Short name of the ultimate ability
  ultimateDesc?: string;       // User-written description of the ultimate
  hasPaimon: boolean;          // Whether Paimon is the companion
  avatarUrl?: string;          // e.g. "/api/images/<uuid>" after generation
  chapter: number;             // Current story chapter
  hp: number;                  // Current HP
  maxHp: number;               // Maximum HP
  level: number;               // Character level (starts at 1)
  location: string;            // Current in-world location name
  inventory: string[];         // Item names (not quantities)
  relationships?: { npc: string, affinity: number }[];
  surfaceGoal: string;         // Conscious goal the player stated
  regionalGoal: string;        // Region-specific goal set by the server
  hiddenArcGoal: string;       // Long-term arc goal (set by server)
  endgameGoal?: string;        // Deprecated — kept for load migration
  currentQuest: string;        // Active quest line text
}

interface Choice {
  text: string;
  tone?: 'kind' | 'pragmatic' | 'aggressive' | 'curious' | 'neutral';
  timed?: number;   // Seconds for a QTE countdown (optional)
}

interface StoryNode {
  id: string;                  // "<sessionId>-<turnIdx>"
  narrative: string;           // Narrator's scene description
  speaker: string;             // NPC or character speaking (empty = no dialogue)
  dialogue: string;            // Their exact words
  choices: Choice[] | string[];
  imageUrl?: string;           // "/api/images/<uuid>" or picsum fallback URL
  userAction?: string;         // What the player typed/clicked
  itemGained?: string;
  itemsRemoved?: string[];
  questUpdated?: string;
  hpChange?: number;
  newChapter?: number;
  bgmMood?: string;            // 'peaceful' | 'market' | 'heroic' | 'mystery' | 'dungeon' | 'battle' | 'boss'
  sfxAction?: string;          // 'none' | 'sword_swing' | 'sword_unsheathe' | 'magic_cast' | ...
  relationshipDelta?: { npc: string, affinityChange: number, note: string }[];
  locationChange?: string;
  mainGoalComplete?: boolean;
  sideGoalsThisTurn?: { label: string; kind: 'completed' | 'ongoing' }[];
  sideGoalsLog?: { label: string; kind: 'completed' | 'ongoing'; created_at: number }[];
  mainGoal?: string;           // The current beat's active objective text
  flagsSet?: { key: string; value: string; note: string }[];
}
```

### `src/index.css`

Uses Tailwind v4 `@import "tailwindcss"` directive. Imports three Google Fonts: **Bangers** (used for manga-style dramatic text via `.font-manga-sfx`), **Kalam** (handwritten, dialogue captions via `.font-manga-dialogue`), **Playfair Display** (narrative text via `.font-manga-text`). Defines `.no-scrollbar` and `.telltale-choice` utilities.

### `src/components/TitleScreen.tsx`

Three buttons: **New Game**, **Load Game** (disabled if `!hasSaveGame`), and **Settings** (opens `AudioSettingsModal`). Pure presentation.

### `src/components/LoadGameScreen.tsx`

Fetches `/api/saves` on mount, displays a list of save cards (character name, chapter, turn count, preview text, timestamp). Each card has a Load button (`onLoad(saveId)`) and a Delete button (calls `DELETE /api/saves/:id`). Has a Back button.

### `src/components/CharacterCreation.tsx`

A 5-step wizard (`step: 1 | 2 | 3 | 4 | 5`) rendered inside a manga-styled card:

| Step | Fields collected |
|------|-----------------|
| 1 | `name`, `description` (physical appearance) |
| 2 | `gender`, `hasPaimon` (yes/no companion), `hasSibling` (cosmetic choice) |
| 3 | `element` — one of 7 ElementType values with icons |
| 4 | `skill` name + `skillDesc` |
| 5 | `ultimate` name + `ultimateDesc` |

On completion, the component calls `onComplete(char)` where `char` is a `Character` object with `inventory: ['Dull Blade', 'Mora x100']`, `hp: 100`, `maxHp: 100`, `level: 1`, `location: 'Starfell Valley, Mondstadt'`, and `surfaceGoal` derived from `hasPaimon`/`hasSibling` choices.

The component also contains **two debug buttons** ("Test Vertex" and "Test Gemini API") which call `testVertexConnection()` and `testGeminiConnection()` from `aiService.ts` and display results in a modal overlay. These are development tools, not game features.

### `src/components/AvatarReveal.tsx`

Calls `aiService.generateAvatar(character)` on mount → server generates Imagen-3 portrait → vision model describes it → returns `{ avatarUrl, enhancedDescription }`. Stores the `enhancedDescription` back on the `Character` object (updating `character.description`). Shows the avatar with a "Regenerate" option and a "Begin Journey" button which calls `onConfirm(character)` and transitions to `'playing'`.

### `src/components/GameChat.tsx` — the main playing screen

This is the largest component at ~640 lines. Key responsibilities:

**Startup** (lines 36–88): If `loadedHistory` is provided (loaded game), it uses that history and reads `sessionId` from `localStorage`. For a new game, it POSTs to `/api/session` to create a session, then calls `/api/getInitialNode`, then re-fetches `/api/session/:id/character` to get server-initialized state (location, goals, etc.).

**`handleAction(action: string)`** (line 111–144): The core action handler. Sets `isLoading`, POSTs `{ sessionId, userAction: action }` to `/api/generateStoryTurn`, receives the new `StoryNode`, re-fetches updated character state, appends the node to `history`. On error, appends a fallback "anomaly" node.

**Choice buttons** (lines 411–435): Each choice is a `<button>` with a coloured left border based on `tone`. Clicking triggers `handleAction(text)` and plays the `'choiceClick'` UI SFX.

**Skill/Ultimate buttons** (lines 460–474): Submit `"Use Skill: ${character.skill}"` or `"Unleash Ultimate: ${character.ultimate}"` as the action string.

**HUD toasts** (lines 333–379): A `fixed` div in the top-right renders animated `motion.div` elements for every field that has a value in `latestNode`. These are non-interactive (`pointer-events-none`). Relationship deltas render "X will remember that" (line 336). HP changes render red/green banners (lines 365–373).

**Sidebar** (lines 477–559): Visible only on `lg` (large) screens. Shows the character card (avatar thumbnail, name, element), narrative panel (main goal, side goals log, current quest), and satchel (inventory list with "VIEW MORE" expander + relationship bonds list).

**Mobile menu** (lines 241–325): Full-screen overlay triggered by the hamburger button. Contains save/rollback buttons, settings, main menu, status board, and inventory — all the sidebar content in a touch-friendly layout.

**Save / rollback** (lines 146–180): `handleSave` POSTs to `/api/saves/session/:id/save`. `handleRollback` POSTs to `/api/rollback`, which deletes the last turn from the DB, then slices `history` client-side.

**TTS** (lines 98–109): A `useEffect` on `[history, isLoading, voicePrefs]` calls `speak(text, voicePrefs, latest.speaker)` from `voice.ts`. In `'dialogue-only'` mode, speaks only `latest.dialogue`. In `'narration-and-dialogue'` mode, speaks narrative + dialogue concatenated.

### `src/components/MangaPanel.tsx`

Renders one `StoryNode` as a manga panel:
- Narrative text in a white caption box with Playfair font
- 16:9 image (`imageUrl`) — clicking opens a lightbox
- Speech bubble in the bottom-left corner (`speaker` name + `dialogue` text in Kalam font)
- A "show/hide dialogue" toggle

### `src/components/AudioManager.tsx`

Manages two `<audio>` elements via refs: one for looping BGM, one for one-shot SFX. Never renders visible UI.

**BGM mood map** (lines 5–18):
```typescript
const bgmUrls: Record<string, string> = {
  peaceful: '/audio/bgm/peaceful_town.mp3',
  market:   '/audio/bgm/market.mp3',
  heroic:   '/audio/bgm/heroic.mp3',
  mystery:  '/audio/bgm/mystery.mp3',
  dungeon:  '/audio/bgm/dungeon.mp3',
  battle:   '/audio/bgm/battle_jrpg_loop.mp3',
  boss:     '/audio/bgm/boss.mp3',
  // legacy aliases:
  normal:   '/audio/bgm/peaceful_town.mp3',
  serious:  '/audio/bgm/dungeon.mp3',
};
```

**Region default BGM** (lines 34–42): If `currentNode.bgmMood` is absent, falls back to the region name derived from `location` prop:
```typescript
const regionDefaultBgm: Record<string, string> = {
  Mondstadt: 'peaceful', Liyue: 'market', Inazuma: 'mystery',
  Sumeru: 'mystery', Fontaine: 'heroic', Natlan: 'battle', Snezhnaya: 'dungeon',
};
```

**Cross-fade logic** (lines 86–130): When the target BGM URL changes, a `requestAnimationFrame` loop fades the current track's volume from its current level to 0 over 500ms, then swaps the `src` and plays the new track at full `musicVolume`.

**User-interaction gate** (lines 62–72): Browser autoplay policies block audio until the user interacts. An `interacted` boolean is set on the first click, touch, or keydown via a `{ once: true }` listener.

**SFX** (lines 136–153): On `currentNode` change, plays the SFX 250ms after node arrival (`setTimeout(..., 250)`). Uses a separate SFX audio element.

### `src/components/AudioSettingsModal.tsx`

A modal with three range sliders (Music volume, SFX volume, Voice volume), a voice on/off toggle, and a dialogue-only vs narration+dialogue radio. Writes back via `setMusicVol`, `setSfxVol`, `setVoicePrefs` callbacks.

### `src/services/aiService.ts`

Thin client-side fetch wrappers. No AI logic here — all AI happens on the server.

| Function | Endpoint | Notes |
|----------|----------|-------|
| `testVertexConnection()` | `GET /api/vertex-test` | Debug only |
| `testGeminiConnection()` | `GET /api/gemini-test` | Debug only |
| `generateAvatar(character)` | `POST /api/generateAvatar` | Returns `{ avatarUrl, enhancedDescription }` |
| `generateMangaImage(prompt)` | *(client stub)* | Returns a picsum URL — **not actually called** during gameplay; the server generates images internally |
| `generateStoryTurn(history, character, userAction)` | `POST /api/generateStoryTurn` | Returns `StoryNode` |
| `getInitialNode(character)` | `POST /api/getInitialNode` | Returns `StoryNode` (prologue) |

Note: `generateMangaImage` on the client is a dead stub — it just returns a `picsum.photos` URL. Actual manga panel generation happens server-side in `generateMangaImageInternal()` inside `aiRouter.ts`.

### `src/services/voice.ts`

Browser-side TTS using the Web Speech API. Key design decisions:

**Voice loading** (lines 7–21): Voices are loaded from `window.speechSynthesis.getVoices()` synchronously, plus via the `onvoiceschanged` callback for browsers that load voices asynchronously.

**Speaker-to-voice mapping** (lines 34–54): A heuristic picks a voice based on the speaker name:
- `paimon`, `amber`, `lumine`, `jean`, `lisa` → finds a voice with "Female", "Zira", or "Google UK English Female" in its name
- `kaeya`, `venti`, `diluc`, `aether` → finds a voice with "Male", "David", or "Google UK English Male"
- Everyone else → `stringToHash(speaker) % voices.length` (deterministic based on name)

**Pitch overrides** (lines 84–86):
- Paimon → pitch 1.5 (high, childlike)
- Venti → pitch 1.2
- Diluc or Dvalin → pitch 0.7 (low, gravelly)

**Chunking** (lines 56–71): Long text is split into sentences (≤300 chars per chunk) to avoid browser TTS cutting off mid-sentence. Chunks are spoken sequentially via `u.onend = () => speakChunk(index + 1)`.

### `src/services/uiAudio.ts`

Manages a pool of UI sound effects. Fires on button hovers and clicks. Uses a pooled `<audio>` element approach to avoid the browser's "one audio at a time" limitation for rapid UI sounds. Exposes `playUiSfx(name)` and `setUiSfxVolume(vol)`. Named sounds: `click`, `hover`, `choiceClick`, `confirm`, `actionBtn`.

---

## §6 — Backend architecture (`src/server/`)

### `server.ts` (project root)

The Express server entry point. Runs on port 3000 (`0.0.0.0`).

**Middleware stack** (in order):
1. `express.json({ limit: '1mb' })` — parses JSON request bodies
2. `aiRouter` mounted at `/api` — handles `/api/generateAvatar`, `/api/getInitialNode`, `/api/generateStoryTurn`, `/api/rollback`
3. `sessionRouter` mounted at `/api/session` — handles `/api/session` POST and `/api/session/:id/character` GET
4. `imagesRouter` mounted at `/api/images` — handles `/api/images/:id`
5. `saveRouter` mounted at `/api/saves` — handles all save/load/delete
6. `/api/vertex-test` — inline debug route: tests Vertex AI connectivity using `gemini-3-flash-preview`
7. `/api/gemini-test` — inline debug route: tests direct Gemini API key using `MY_GEMINI_API_KEY`
8. Vite dev middleware (dev) OR static `dist/` serving (production)

### `src/server/aiRouter.ts` — the brain (~663 lines)

This is the most complex file. Everything AI-related for the game flows through here.

#### AI client factories (lines 13–29)

```typescript
function getAi() {
  // Returns GoogleGenAI with Vertex AI — for story, images, embeddings
  return new GoogleGenAI({ vertexai: true, project: gcpProject, location: 'global' });
}

function getGeminiAi() {
  // Returns GoogleGenAI with direct API key — for Search-grounded noun harvester
  return new GoogleGenAI({ apiKey: process.env.MY_GEMINI_API_KEY });
}
```

#### `SYSTEM_INSTRUCTION` (lines 31–39)

The permanent system prompt sent to Gemini on every story turn. Key directives:
1. Player agency is primary — roll with any reasonable action
2. Set `mainGoalComplete=true` only when the current MAIN GOAL is accomplished
3. Side goals are emergent — any non-main-goal action the player takes
4. Region travel lock — never `locationChange` to a locked region
5. Telltale-style relationship tracking every turn
6. Stay lore-accurate to Genshin Impact canon
7. Sound direction — `bgmMood` and `sfxAction` per scene

#### `responseSchema` (lines 41–108)

The JSON schema enforced on every Gemini response. Every field the game relies on is declared here. Key fields:

| Field | Type | Purpose |
|-------|------|---------|
| `narrative` | string | Narrator's scene description |
| `speaker` | string | NPC name (empty = no dialogue) |
| `dialogue` | string | NPC's exact words |
| `imagePrompt` | string | Visual description for Imagen-3 |
| `choices` | array of `{text, tone, timed?}` | 2–4 player options |
| `itemGained` | string | Single item to add to inventory |
| `itemsRemoved` | string[] | Items to delete (approximate match) |
| `questUpdated` | string | New current quest text |
| `hpChange` | integer | Positive (heal) or negative (damage) |
| `bgmMood` | string | One of: peaceful/market/heroic/mystery/dungeon/battle/boss |
| `sfxAction` | string | One of: none/sword_swing/sword_unsheathe/magic_cast/impact_hit/explosion/page_turn/dramatic_sting |
| `regionalGoal` | string | Prologue-only: sets the region goal |
| `newChapter` | integer | Increment chapter only on major resolution |
| `locationChange` | string | Named location if player moves |
| `mainGoalComplete` | boolean | True only if MAIN GOAL achieved |
| `sideGoalsThisTurn` | array of `{label, kind}` | Emergent side activities |
| `flagsSet` | array of `{key, value, note}` | Permanent narrative choices |
| `relationshipDelta` | array of `{npc, affinityChange, note}` | NPC opinion shifts (max 5) |

#### `generateMangaImageInternal(sessionId, imagePrompt)` (lines 111–149)

1. Prepends a style boilerplate: `"Black and white manga style, official Genshin Impact manga art style, highly detailed and accurate anime illustration, screentones, dramatic lighting. Strictly adhere to Genshin Impact character designs, environments. "`
2. Calls `imagen-3.0-generate-002` with `aspectRatio: "16:9"`
3. Falls back to `imagen-3.0-fast-generate-001` if first call throws
4. If both fail, returns a `https://picsum.photos/seed/.../1024/576?grayscale&blur=2` placeholder URL
5. On success, stores the JPEG bytes as a BLOB in the `images` table and returns `/api/images/<uuid>`

#### `/generateAvatar` endpoint (lines 151–211)

Similar to `generateMangaImageInternal` but uses `aspectRatio: "1:1"` and a different prompt style (`"full body portrait, character design sheet"`). After generating the image, calls `gemini-3-flash-preview` with the image bytes inline (vision call) to extract an `enhancedDescription` — a dense visual description that will be reused in every subsequent manga panel to maintain character visual consistency. Falls back to `dicebear.com/adventurer/svg` SVG if both Imagen tiers fail.

#### `aiCallWithTimeoutAndRetry(ai, params)` (lines 213–239)

Wraps every Gemini `generateContent` call with:
- 30-second timeout via `Promise.race()`
- One retry on failure
- If the failure is a JSON parse error (SyntaxError or contains "JSON"): lowers temperature by 0.2 and appends `"CRITICAL: RESPOND ONLY WITH VALID JSON MATCHING THE SCHEMA. NO PROSE OUTSIDE THE JSON OBJECT."` to the prompt

#### `applyTurnDeltas(sessionId, parsed, turnIdx)` (lines 240–337)

A SQLite transaction function that applies all state mutations from one AI response:

1. **HP**: `UPDATE character SET hp = MIN(max_hp, MAX(0, hp + ?))` — clamped to `[0, max_hp]`
2. **Item gained**: `INSERT INTO inventory`
3. **Items removed**: `DELETE FROM inventory WHERE item LIKE '%item%'` (approximate match)
4. **Quest updated**: `UPDATE character SET current_quest = ?`
5. **Regional goal**: `UPDATE character SET regional_goal = ?`
6. **New chapter**: `UPDATE character SET chapter = ?`
7. **Location change**: Checks `sessions.unlocked_regions`. If the new location's region is locked, logs a warning and silently ignores the location change.
8. **Relationship delta**: UPSERT into `relationships` table — updates `affinity` by adding the delta
9. **Main goal complete**: If there are pending `must_happen` events, marks the first one complete. If all `must_happen` events are done, advances to the next beat (`getNextBeat`). If the next beat is in a new region, adds that region to `sessions.unlocked_regions`.
10. **Side goals**: `INSERT INTO side_goals` for each entry in `sideGoalsThisTurn`
11. **Flags**: `INSERT OR REPLACE INTO choice_flags`

#### `buildTurnPrompt(sessionId, userAction, characterInfo)` (lines 339–414)

Assembles the user-turn prompt string in this order:

1. **`--- CURRENT BEAT ---` block** (if not `__END__`): beat title, region, suggested location, required NPCs, CURRENT OBJECTIVE (next unfinished `must_happen` event, or the `main_goal` if all are done), canonical dialogue hooks
2. **`CHARACTER STATE:`**: name, element, skill, appearance, companion, HP/location/chapter, quest, surface goal, regional goal
3. **`UNLOCKED REGIONS:`**: list of currently unlocked regions with a note that others are inaccessible
4. **Inventory** (if non-empty)
5. **Relationships** (npc, affinity, last note)
6. **`STORY SUMMARY SO FAR:`** (if summarization has run)
7. **`PAST PLAYER CHOICES (Flags):`** (if any flags set)
8. **`LAST 3 TURNS:`**: player action + narrator/character text pairs, most recent last

In `generateStoryTurn`, two more blocks are appended **after** `buildTurnPrompt`:

9. **`ENTITY LORE:`** — up to 5 harvested noun summaries
10. **`RETRIEVED LORE & VISUALS:`** — up to 5 hybrid-retrieved lore chunks

#### `/getInitialNode` endpoint (lines 416–510)

Generates the opening prologue for a new session. Same flow as `generateStoryTurn` but:
- `userAction` defaults to `"Awakened in Teyvat"`
- Appends extra text: `"\nPROLOGUE INSTRUCTION: Write a dramatic prologue waking up. Set the 'questUpdated' to a fitting objective. End the prologue with an immediate threat or intense mystery..."`
- No noun harvesting input from a previous turn (there is none)
- Inserts at `turn_idx = 0` (hardcoded)
- Background noun harvesting runs async on the generated text

#### `/generateStoryTurn` endpoint (lines 512–643)

The main per-turn handler. Full flow:

1. Load `characterInfo` from DB
2. `buildTurnPrompt(sessionId, userAction, characterInfo)`
3. `harvestNouns(userAction + lastNarrative + lastDialogue, sessionId)` — returns up to 5 entity summaries
4. `retrieveContext(sessionId, userAction + lastNarrative)` — hybrid FTS + vec retrieval
5. Append both lore blocks + reminder text to prompt
6. Log a warning if prompt exceeds 12,000 characters
7. Call `aiCallWithTimeoutAndRetry` with `gemini-2.5-flash` (or `GEMINI_MODEL` env override)
8. Call `generateMangaImageInternal` for the panel image
9. `INSERT INTO history` at `nextTurn` (= MAX(turn_idx) + 1)
10. `applyTurnDeltas` in a transaction
11. Schedule `summarizeSession` async if `nextTurn % 5 === 0`
12. Schedule post-turn noun harvesting async
13. Return response JSON

#### `/rollback` endpoint (lines 645–663)

Deletes the maximum `turn_idx` from `history` and any `choice_flags` set at that turn. **Does not revert HP or inventory changes** — noted as a known partial implementation. Client then slices the last entry off its local `history` array.

### `src/server/canon.ts`

Loads all `data/canon/*.json` files on startup (excludes files starting with `_`). Sorts files alphabetically to ensure region order. Exposes:

- **`getBeat(beatId)`** — linear search through all acts' beats. Returns `Beat | null`.
- **`getNextBeat(beatId)`** — finds the beat after the given one; crosses region boundaries (moves to the next act's first beat when reaching the end of an act).
- **`getFirstBeatId()`** — returns the first beat of the first act (`mond.01`).
- **`getFirstRegionSummary()`** — returns `summary_for_director` from the first region (used as initial `regional_goal`).
- **`regionOfLocation(loc)`** — looks up a location name in the `locationToRegion` map (populated from all beats' `location` fields). Case-insensitive. Returns `null` if unknown.

### `src/server/db.ts`

Opens (or creates) `data/teyvat.db`. Loads sqlite-vec. Sets `journal_mode = WAL` (Write-Ahead Logging — better concurrent read performance). Runs the full `CREATE TABLE IF NOT EXISTS` schema. Then runs a series of `ALTER TABLE ADD COLUMN` wrapped in try/catch — this is the migration mechanism (if the column already exists, the error is swallowed).

See §13 for the full table-by-table schema reference.

### `src/server/embeddings.ts`

Calls `text-embedding-004` via Vertex AI. For each text string: if empty, returns a zero vector. Otherwise calls `ai.models.embedContent` with `config: { outputDimensionality: 768 }`. Returns `number[][]`. Processes texts sequentially (no batching — but the SDK handles batching internally for `generateContent`).

### `src/server/nounHarvester.ts`

**Purpose**: Automatically discover and store lore for every proper noun that appears in the story text.

**Flow** (called on every turn, twice — pre-turn and post-turn):

1. **Extract nouns**: Regex `\b[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*\b` extracts capitalized word sequences. Deduplicated, lowercased. The player's own name is excluded.

2. **Resolve aliases**: Each extracted noun is looked up in `lore_entity_aliases`. Hits are collected in `hits[]`. Misses go to `misses[]`.

3. **Update timestamps**: For hits, `UPDATE lore_entities SET last_used_at = NOW()`.

4. **Handle misses (up to 3 per call)**: For each miss:
   - Check if the entity already exists by canonical name (just missing the alias)
   - If not found anywhere: call `fetchNounGoogle(noun, canonical)` — a Gemini `generateContent` call with `tools: [{ googleSearch: {} }]` and prompt `"Find the canonical lore for '${canonical}'. Summarize in ≤300 tokens."` using `MY_GEMINI_API_KEY`
   - Embed the canonical name + summary with `getEmbeddings`
   - Store in `lore_entities` and `lore_vec` transactionally
   - Add to `lore_entity_aliases`

5. **Return contexts**: For all resolved entities, returns `"${canonical}: ${summary}"` strings (up to 5 in the story turn handler — see aiRouter.ts line 528).

**Seed**: `initSeed()` at module load pre-populates `lore_entity_aliases` with 8 aliases from `data/genshin_seed.json`:

```json
[
  { "noun": "mondstadt", "canonical": "Mondstadt", "category": "region", "aliases": ["city of freedom", "mond"] },
  { "noun": "paimon",    "canonical": "Paimon",    "category": "character", "aliases": ["emergency food"] },
  ...
]
```

### `src/server/retrieval.ts`

Hybrid retrieval combining two independent searches, naively merged:

```
Query string (userAction + recent narrative)
         ↓
   ┌─────────────────────────────────────────┐
   │ FTS5 search on lore_fts                 │  keyword matching
   │ SELECT topic, text FROM lore_fts        │
   │ WHERE lore_fts MATCH ? LIMIT 10         │
   └─────────────┬───────────────────────────┘
                 │
   ┌─────────────────────────────────────────┐
   │ Vec search on lore_vec JOIN lore        │  semantic similarity
   │ ORDER BY vec_distance_cosine(emb, ?)    │
   │ WHERE session_id = ? LIMIT 10           │
   └─────────────┬───────────────────────────┘
                 │
   Naive merge: FTS hits first, then Vec hits
   Deduplicate by text, keep top 5
         ↓
   "- [topic]: text (≤300 chars)\n" per entry
```

**Limitation**: The merge is purely order-based (FTS results before Vec results), not a proper score fusion like Reciprocal Rank Fusion. This is noted as a known limitation in §15.

Note: the `lore_vec` table joins to the `lore` table (for session-scoped entries), not `lore_entities`. The entity system (nouns) uses a separate embedding stored in `lore_vec` with the entity's `embedding_id` as the row ID, but retrieval only queries `lore` + `lore_vec`. This means entity embeddings are stored but not retrieved via this path — they're returned directly by `harvestNouns`.

### `src/server/summarize.ts`

Called every 5 turns (when `nextTurn % 5 === 0`). Fetches all `history` rows for the session up to `turnIdx`, formats them as `"Player: X\nNarrator/Character: Y Z"` blocks, and sends to `gemini-3-flash-preview` with the instruction: `"Summarize the following events into <=400 tokens, preserving named entities, unresolved threads, and vows."` The summary is stored in the `summary` table (`INSERT OR REPLACE`) and injected into every subsequent prompt's `STORY SUMMARY SO FAR:` block.

### `src/server/saveMigrations.ts`

A minimal stub. Exports `migrateSnapshot(snapshot, targetVersion)` that currently just returns the snapshot unchanged. `SCHEMA_VERSION = 1`. The save route calls it for older saves but the migration logic is a placeholder.

### `src/server/routes/session.ts`

**`POST /api/session`**: Creates a full new session. Generates a UUID, inserts into `sessions` with `unlocked_regions: '["Mondstadt"]'`, inserts the character row, inserts starting inventory items, inserts `story_progress` pointing at `getFirstBeatId()`. Initial location comes from the first beat's `location` field (falls back to `'Starfell Valley Beach'`). Returns `{ sessionId }`.

**`GET /api/session/:id/character`**: Reads the `character` table row, joins with latest avatar from `images`, joins with `inventory` and `relationships`. Maps snake_case DB columns to camelCase TypeScript fields. Returns the full `Character`-shaped JSON.

### `src/server/routes/save.ts`

**`GET /api/saves`**: Joins `saves` + `session_snapshots`, returns a list of save cards with character name, chapter, turn index, preview text snippet, and preview image URL.

**`POST /api/saves/session/:id/save`**: Snapshots all game state into `saves` + `session_snapshots`. Captured: character, inventory, relationships, summary, story_progress, choice_flags, npc_state. The preview text is `lastTurn.narrative.substring(0, 50)`. `SCHEMA_VERSION = 1` is stored.

**`POST /api/saves/:saveId/load`**: The load flow is:
1. Look up the `saves` row and `session_snapshots` row
2. Parse all JSON columns back into objects
3. Generate a **new** `sessionId` (UUID)
4. Create new rows in all tables under the new session ID
5. Copy history rows up to `save_info.turn_idx` from the original session
6. Return `{ sessionId: newSessionId, history: tail5 }` where `tail5` is the last 5 history nodes mapped to `StoryNode` shape (choices are empty — `[]` — since those are transient and can't be reliably restored)

**`DELETE /api/saves/:saveId`**: Deletes from `saves` table. The `session_snapshots` row cascades.

### `src/server/routes/images.ts`

Six lines. Reads `mime` and `bytes` BLOB from the `images` table, sets `Content-Type`, sends the raw bytes. No authentication — any UUID guess could retrieve any image. Acceptable for a single-user local deployment.

---

## §7 — The canon system (`data/canon/`)

### Why it exists

LLMs are probabilistic and will drift without constraints. The canon system is the **deterministic spine** that keeps the adventure on track. Without it, Gemini would make up arbitrary plot events, skip important characters, and never reach a satisfying ending. The canon defines what *must* happen and *in what order*, while leaving the exact dialogue, player detours, and moment-to-moment narration entirely to the AI.

### File layout

```
data/canon/
├── README.md             # 8-step authoring workflow guide
├── _schema.json          # JSON schema for validating region files
├── _spoiler-tiers.json   # Maps lore keys to the region where they unlock
├── _character_unlocks.json  # Maps beat IDs to newly introduced characters
├── _changelog.md         # History of schema changes
├── 01_mondstadt.json     # Prologue + Acts I-III (~29 beats)
├── 02_liyue.json
├── 03_inazuma.json
├── 04_sumeru.json
├── 05_fontaine.json
├── 06_natlan.json
├── 07_snezhnaya.json     # Stub (3.6 KB)
├── 08_interludes.json    # Cross-region story moments (1.5 KB)
└── 09_endgame.json       # Post-credit content (1.2 KB)
```

Files starting with `_` are excluded by `canon.ts:loadCanon()` (line 34: `!f.startsWith('_')`).

### Region object shape

```json
{
  "region": "Mondstadt",
  "archon_quest_chapter": "Prologue",
  "version": "1.0",
  "last_reviewed": "2026-04-25",
  "summary_for_director": "Mondstadt is freedom, wine, and bardic mischief. Tone is coming-of-age mystery, not cosmic horror.",
  "emotional_register_default": "wonder, freedom, light melancholy",
  "named_npcs_introduced": ["Amber", "Lisa", "Kaeya", "Jean", "Diluc", "Venti", "Dvalin", "Barbara", "Klee", "La Signora"],
  "lore_unlocks_region_grants": {
    "named": ["archons", "visions", "fatui", "knights_of_favonius", "anemo_archon"],
    "hint_only": ["sky_that_watches", "fallen_gods", "sibling_glimpse"]
  },
  "branch_notes": "Major persistent branches: which cathedral confrontation route, Diluc-trust level.",
  "beats": [ ... ]
}
```

The `summary_for_director` becomes the initial `regional_goal` stored on the character when a session starts (via `getFirstRegionSummary()` in session.ts).

### Beat shape (full example)

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
  "emotional_register": "curiosity, confusion, hope",
  "location_flexible": false,
  "main_goal": "Player agrees to follow Paimon to the Statue of The Seven",
  "main_goal_keywords": ["agrees", "follow", "paimon", "statue"],
  "region": "Mondstadt"
}
```

### How beats drive the story

Each beat has two mechanisms for progression:

1. **`must_happen` events** (sequential): The first un-completed event in the array is injected as `CURRENT OBJECTIVE`. When Gemini sets `mainGoalComplete=true` and there's still a pending `must_happen` event, `applyTurnDeltas` marks that event complete and the next one becomes the objective (without advancing the beat).

2. **`main_goal` exit condition**: Once all `must_happen` events are done, the `main_goal` becomes the objective. When Gemini sets `mainGoalComplete=true` at that point, `applyTurnDeltas` calls `getNextBeat(currentBeatId)` and advances to it. If the next beat is in a different region, that region is added to `sessions.unlocked_regions`.

This creates a two-level FSM: **events within a beat** (micro) and **beats within a region** (macro).

### The 8-step authoring workflow

As described in `data/canon/README.md`:
1. **Source of truth** — study the actual Genshin game content
2. **Beat decomposition** — break each act into discrete story checkpoints
3. **Freedom** — define what players can legitimately do in each beat
4. **Forbidden** — explicitly list what must not happen (e.g. "Skip the beach scene", "Kill Paimon")
5. **Lore-gate** — identify what lore can be referenced vs. what's still spoiled
6. **Dialogue-hook** — add one or two canonical dialogue lines for authenticity
7. **Playtest** — run through the beat manually to verify the AI follows it
8. **Sign-off** — update `last_reviewed` and `version`

---

## §8 — Data flow walkthroughs

### 8.1 New game

1. Player clicks **New Game** → `App.tsx:handleNewGame` → `status = 'creation'`
2. Player completes 5-step `CharacterCreation` wizard → `handleCharacterCreated(char)` → `status = 'reveal'`
3. `AvatarReveal` mounts → calls `aiService.generateAvatar(char)` → `POST /api/generateAvatar`
4. Server: Imagen-3 generates 1:1 portrait → vision model generates `enhancedDescription` → image stored as BLOB → returns `{ avatarUrl, enhancedDescription }`
5. `AvatarReveal` shows portrait; player confirms → `handleAvatarConfirmed(char)` → `status = 'playing'`
6. `GameChat` mounts. In `useEffect`, detects no `loadedHistory`:
   - `POST /api/session { character }` → creates all DB rows → returns `{ sessionId }`
   - Stores `sessionId` in `localStorage`
   - `POST /api/getInitialNode { sessionId }` → assembles prologue prompt → Gemini generates → Imagen panel → DB writes → returns first `StoryNode`
   - `GET /api/session/:id/character` → refreshes character (picks up server-set `location`, `regionalGoal`, etc.)
7. `setHistory([initialNode])` → React renders first `MangaPanel`
8. `AudioManager` reacts to `currentNode.bgmMood` → starts `peaceful_town.mp3`
9. TTS `useEffect` fires → speaks the first dialogue

### 8.2 Subsequent turn

1. Player clicks a choice button → `handleAction(choiceText)` → `setIsLoading(true)`
2. `POST /api/generateStoryTurn { sessionId, userAction: choiceText }`
3. Server handler:
   - Loads character from DB
   - `buildTurnPrompt` → constructs prompt string
   - `harvestNouns(userAction + lastNarrative)` → may call Gemini Search for unknowns → returns lore strings
   - `retrieveContext(sessionId, query)` → FTS5 + vec search → returns lore chunks
   - Appends lore to prompt
   - `aiCallWithTimeoutAndRetry` → Gemini generates → JSON parsed
   - `generateMangaImageInternal` → Imagen → BLOB stored
   - `INSERT INTO history`
   - `applyTurnDeltas` (transaction)
   - Maybe schedules `summarizeSession` async
   - Returns response JSON
4. `setHistory(prev => [...prev, nextNode])`
5. `GET /api/session/:id/character` → updates `character` state (HP, inventory, location, relationships)
6. React re-renders:
   - New `MangaPanel` appears at the bottom of the scroll area
   - HUD toasts animate in for any deltas
   - `AudioManager` re-evaluates `bgmMood` and possibly cross-fades BGM
   - After 250ms, `AudioManager` fires `sfxAction` one-shot
   - TTS `useEffect` fires for the new `latest.dialogue`
7. New choices render; `isLoading = false`; player interacts again

### 8.3 Lore retrieval per turn (RAG)

Two parallel pipelines, both run every story turn:

**Pipeline 1 — Noun Harvester** (entity-centric):
- Input: `userAction + lastNarrative + lastDialogue`
- Extracts all `CapitalizedWords` → resolves against `lore_entity_aliases` → for misses, calls Gemini with Google Search → stores new entities + embeddings → returns `"EntityName: summary"` strings
- These go into the `ENTITY LORE` prompt block (up to 5)
- Purpose: visual and lore accuracy for named characters, locations, items

**Pipeline 2 — Hybrid Retrieval** (context-centric):
- Input: `userAction + lastNarrative`
- FTS5 keyword search on `lore_fts` (generic lore chunks, not entities)
- Vec cosine search on `lore_vec JOIN lore` (session-scoped lore)
- Merged and truncated to 5 entries at ≤300 chars each
- Goes into the `RETRIEVED LORE & VISUALS` prompt block
- Purpose: thematic and historical context

Both pipelines' output is injected between `buildTurnPrompt` and the final `CURRENT ACTION:` line.

### 8.4 Summarization

Triggers when `nextTurn % 5 === 0` (turns 5, 10, 15, …). Runs async (non-blocking). Reads all history rows up to that turn, formats as a dialogue script, calls `gemini-3-flash-preview` with a ≤400-token summary instruction. Stores in `summary` table (`INSERT OR REPLACE` — only one row per session). From the next turn onward, `buildTurnPrompt` includes the `STORY SUMMARY SO FAR:` block.

### 8.5 Save and load

**Save**: `POST /api/saves/session/:id/save` → snapshots character + inventory + relationships + summary + story_progress + choice_flags + npc_state into `session_snapshots` as JSON columns. Creates a `saves` row with preview text + image UUID.

**Load**: `POST /api/saves/:saveId/load` → reads the snapshot → creates a brand-new `sessionId` → rebuilds all rows under the new ID → copies history rows → returns `{ sessionId: newId, history: tail5 }`. The client stores the new `sessionId` in `localStorage` and jumps to `status = 'playing'`.

Why clone instead of reusing the original session? This ensures every loaded game is independent — saves are immutable snapshots. Multiple loads from the same save create multiple independent sessions.

### 8.6 Rollback

`POST /api/rollback { sessionId }` →  `DELETE FROM history WHERE session_id = ? AND turn_idx = MAX(turn_idx)` → `DELETE FROM choice_flags WHERE set_at_turn = MAX(turn_idx)`. Returns `{ success: true, rolledBackTurn: N }`.

Client-side: `setHistory(prev => prev.slice(0, -1))`.

**Known partial implementation**: HP and inventory changes from the rolled-back turn are **not** reverted. If turn 7 gave the player a sword and dealt 15 damage, rolling back removes turn 7 from history but the player keeps the sword and the HP stays reduced. A full implementation would need to store inverse deltas or re-apply all deltas from turn 0.

---

## §9 — Game systems (cross-cutting)

### Combat / HP

HP is managed purely by the AI. Each turn, `responseSchema.hpChange` is an integer the AI sets. `applyTurnDeltas` clamps the result: `hp = MIN(max_hp, MAX(0, hp + hpChange))`. There is no automatic death state — HP can reach 0 but the game does not end. Combat "attacks" only happen when the narrative calls for it (the AI decides).

### Skill and Ultimate

The player names and describes their skill and ultimate during character creation. They appear as quick-action buttons in `GameChat`. Clicking them submits `"Use Skill: ${character.skill}"` or `"Unleash Ultimate: ${character.ultimate}"` as the `userAction`. The AI receives this string and is expected to narrate the ability's effect in the story. The AI also picks an appropriate `sfxAction` (typically `magic_cast` or `sword_swing`).

### Inventory

The inventory is a simple list of strings. `itemGained` appends one item; `itemsRemoved` does an approximate `LIKE '%item%'` deletion. There is no quantity tracking per item (qty column exists but is always 1). Deduplication is not enforced — if the AI gives the same item twice, it appears twice. The HUD shows the first 5 items with a "VIEW MORE" modal for the rest.

### Quests and goals

Goals are hierarchical:

| Field | Where stored | Meaning |
|-------|-------------|---------|
| `surfaceGoal` | `character.surface_goal` | The conscious goal the player's character has (set at creation, e.g. "Find my sibling") |
| `regionalGoal` | `character.regional_goal` | The region-level narrative thread (set from canon's `summary_for_director`) |
| `hiddenArcGoal` | `character.hidden_arc_goal` | Long-term arc goal (set by server, not yet surfaced in UI) |
| `currentQuest` | `character.current_quest` | The active quest line text (updated each turn by `questUpdated`) |
| `mainGoal` | Derived from `story_progress` | The current beat's active objective (shown in sidebar) |
| `sideGoals` | `side_goals` table | Emergent side activities, up to last 20 shown in sidebar |

### Relationships (Telltale-style)

Every turn, the AI returns `relationshipDelta[]` — an array of NPC opinion shifts. `applyTurnDeltas` UPSERTs these into the `relationships` table, accumulating `affinity` as a running integer. The sidebar shows the 5 most-recently-seen NPCs with their affinity numbers (green = positive, red = negative). HUD toasts say "X will remember that" with a heart or broken heart icon.

### Choice flags

When the player makes a narratively significant choice (e.g. siding with the Mages, sparing a villain, revealing a secret), the AI sets `flagsSet[]`. These are stored in `choice_flags` with `key`, `value`, and `note`. On every subsequent turn, all flags are injected into the prompt under `PAST PLAYER CHOICES (Flags):` so the AI remembers the player's decisions.

### Region travel lock

The `sessions.unlocked_regions` JSON array starts as `["Mondstadt"]`. `applyTurnDeltas` checks `regionOfLocation(parsed.locationChange)`. If the location belongs to a locked region, the location update is silently dropped and a console warning is logged. The AI is also instructed in `SYSTEM_INSTRUCTION` not to set `locationChange` to locked regions — but the server-side check is the hard enforcement.

### HUD toasts

All toasts are rendered in `GameChat.tsx` lines 333–379 as `motion.div` elements inside a `fixed` `pointer-events-none` div. They slide in from the right with `initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }}`. Each field in `latestNode` generates a different toast type:

| Field | Toast |
|-------|-------|
| `relationshipDelta[]` | "X will remember that. 🤍/💔" (blue background) |
| `flagsSet[]` | `flag.note` or "Choice saved: value" (purple background) |
| `mainGoalComplete` | "✦ Canon Goal Completed ✦" (amber, rotated 2°) |
| `sideGoalsThisTurn[]` | "✓ or ○ Side Goal: label" (orange background) |
| `itemGained` | "+ Loot Plundered: item" (yellow background) |
| `itemsRemoved[]` | "- Lost: item" (gray background) |
| `hpChange` negative | "-N HP!" (red background) |
| `hpChange` positive | "+N HP!" (green background) |
| `questUpdated` | "⚑ Quest Line Updated!" (emerald background) |

---

## §10 — Scripts (`scripts/`)

**Region builder scripts** (`build_mond.ts`, `build_liyue.ts`, `build_inazuma.ts`, `build_sumeru.ts`, `build_fontaine.ts`, `build_natlan.ts`, `build_natlan2.ts`): Each file hardcodes the full beat array for its region and writes the corresponding `data/canon/NN_name.json` file. These are bootstrap scripts — run once to create the initial JSON, then the JSON is the source of truth and can be edited directly.

**`canon_audit.ts`**: Validates every `data/canon/*.json` (excluding `_`-prefixed files) has required root fields (`region`, `beats`, etc.). Run via `npm run canon:audit` (which is part of `npm run lint`).

**`canon_new_region.ts`**: Usage: `npx tsx scripts/canon_new_region.ts "Snezhnaya"`. Scans existing `data/canon/` files to find the next two-digit prefix, creates a new region JSON stub with the given name.

**`add_keywords.ts`**: A one-off migration script. Backfills `main_goal`, `main_goal_keywords`, and `region` fields on beats that previously used the old `exit_when` / `exit_keywords` schema. Run once after a schema change.

**`update_canon_schema.mjs`**: An even earlier migration that added `exit_keywords` and `location_flexible` fields. Predates `add_keywords.ts`.

**`fix_imports.ts`**: Rewrites `.js"` to `.ts"` in source file imports — useful after moving files around or after TypeScript migration.

**`fetch_audio.sh`**: Downloads CC0 BGM from OpenGameArt and SFX from Kenney.nl, unzips them, renames to consistent names, and transcodes OGG → MP3 using `ffmpeg`. Run via `npm run audio:fetch`.

**`recover.sh`**: Wipes `data/teyvat.db*` (all database files including WAL) and re-runs `fetch_audio.sh`. Use this to reset the local database to a clean state.

---

## §11 — Static assets (`public/`)

### BGM tracks (`public/audio/bgm/`)

All MP3 format, CC0 licensed (see `public/audio/LICENSES.md`).

| Filename | `bgmMood` key | Narrative context |
|----------|--------------|-------------------|
| `peaceful_town.mp3` | `peaceful` / `normal` | Default town ambience, title screen |
| `peaceful_alt.mp3` | *(not mapped)* | Alternate peaceful track |
| `town_day.mp3` | *(not mapped)* | Town daytime variant |
| `town_evening.mp3` | *(not mapped)* | Town evening variant |
| `market.mp3` | `market` | Marketplace, Liyue |
| `heroic.mp3` | `heroic` | Triumphs, Fontaine default |
| `mystery.mp3` | `mystery` | Unknowns, Inazuma/Sumeru default |
| `dungeon.mp3` | `dungeon` / `serious` | Caves, ruins, Snezhnaya default |
| `battle_jrpg_intro.mp3` | *(not mapped)* | Battle intro sting |
| `battle_jrpg_loop.mp3` | `battle` | Looping battle music, Natlan default |
| `battle_jrpg_full.mp3` | *(not mapped)* | Full battle track |
| `battle_epic.mp3` | *(not mapped)* | Epic combat variant |
| `boss.mp3` | `boss` | Archon-tier / boss fights |

> **Note**: Only 7 moods are mappable by the AI (`peaceful`, `market`, `heroic`, `mystery`, `dungeon`, `battle`, `boss`). The other BGM files exist as assets but are not currently wired to any `bgmMood` value.

### SFX tracks (`public/audio/sfx/`)

Each SFX is provided in both `.mp3` and `.ogg` format. The audio system uses `.mp3`.

| Filename | `sfxAction` key | Trigger context |
|----------|----------------|-----------------|
| `sword_swing` | `sword_swing` | Melee attack |
| `sword_unsheathe` | `sword_unsheathe` | Drawing a weapon |
| `magic_cast` | `magic_cast` / `magic` | Elemental skill or ultimate |
| `impact_hit` | `impact_hit` | Physical impact |
| `explosion` | `explosion` | Explosive effect |
| `page_turn` | `page_turn` | Scene transition |
| `dramatic_sting` | `dramatic_sting` | Revelation or dramatic moment |
| `ui_click` | *(via uiAudio.ts)* | Button click |
| `ui_hover` | *(via uiAudio.ts)* | Button hover |
| `ui_choice` | *(via uiAudio.ts)* | Choice selected |
| `ui_confirm` | *(via uiAudio.ts)* | Confirm action |
| `ui_action` | *(via uiAudio.ts)* | Action button |

UI sounds are managed separately by `src/services/uiAudio.ts` and are not sent via `sfxAction` — they fire on user interaction events client-side.

---

## §12 — Orphaned and legacy code

**`app/applet/add_keywords.js`**: An early CommonJS draft of `scripts/add_keywords.ts`. Not referenced by the build or any npm script. Has stream-of-consciousness comments suggesting it's a first attempt at the backfill migration. Safe to ignore or delete.

**`verify_audio.ts`**: Checks external audio source URLs (OpenGameArt, Kenney, etc.) for liveness via HEAD requests. Written before audio was vendored locally into `public/audio/`. No longer useful — the server serves assets locally now.

**`check_vertex_migration.js`**: A diagnostic tool for when the project migrated from Gemini direct API to Vertex AI. Greps `src/` for old `GEMINI_API_KEY` references and checks `@google/genai` version. Useful for troubleshooting auth, but not a runtime file.

**Hardcoded GCP project IDs in test files**: `test_global.ts`, `test_models2.ts`, and similar contain `project-df3b0f17-dc21-427c-8bb*`. These appear to be partial project IDs from a dev/staging GCP project. They're in test scripts only (not the server), but should be removed before any public distribution of the code.

---

## §13 — SQLite schema reference

All tables have `session_id TEXT` foreign-keying to `sessions.id` with `ON DELETE CASCADE` where applicable.

| Table | Key columns | Purpose |
|-------|------------|---------|
| `sessions` | `id`, `unlocked_regions` (JSON), `created_at`, `updated_at` | One row per play-through. `unlocked_regions` starts as `'["Mondstadt"]'`. |
| `character` | `session_id` (PK), `name`, `gender`, `element`, `skill`, `skill_desc`, `ultimate`, `ultimate_desc`, `has_paimon`, `chapter`, `hp`, `max_hp`, `level`, `location`, `surface_goal`, `regional_goal`, `hidden_arc_goal`, `endgame_goal`, `current_quest`, `appearance_desc` | Mutable character state. Most fields updated by `applyTurnDeltas`. |
| `inventory` | `session_id`, `item`, `qty`, `acquired_turn` | One row per item (qty always 1; duplicates not prevented). |
| `relationships` | `session_id`, `npc`, `affinity`, `last_seen_turn`, `notes` | Running NPC affinity. `notes` = last `delta.note` value. |
| `history` | `session_id`, `turn_idx` (composite PK), `speaker`, `narrative`, `dialogue`, `user_action`, `image_id`, `bgm_mood`, `sfx_action`, `created_at` | Full turn-by-turn history. `image_id` is either `/api/images/<uuid>` or a picsum URL. |
| `history_fts` | (virtual FTS5) | Full-text index over `history.narrative`, `.dialogue`, `.user_action`. Not currently used for retrieval — `lore_fts` is. |
| `lore` | `id`, `session_id`, `topic`, `text`, `source`, `chapter`, `created_at` | Arbitrary lore chunks (could be wiki excerpts, model-generated summaries, seeded content). Indexed by `lore_fts` and `lore_vec`. |
| `lore_fts` | (virtual FTS5) | Full-text index over `lore.topic` and `lore.text`. |
| `lore_vec` | `id` (TEXT PK), `embedding float[768]` | sqlite-vec virtual table. Stores 768-d embeddings. `id` matches either `lore.id` or `lore_entities.embedding_id`. |
| `images` | `id` (UUID PK), `session_id`, `kind` (`'avatar'`/`'panel'`), `mime`, `bytes` (BLOB), `created_at` | Raw image data. Served by `/api/images/:id`. |
| `search_cache` | `query_hash` (PK), `query`, `result_text`, `expires_at` | Cache for Gemini Search-grounded noun lookups. Currently not actively used for read (cache hit logic not implemented in `nounHarvester.ts`). |
| `summary` | `session_id` (PK), `up_to_turn`, `text` | One summary row per session; overwritten every 5 turns. |
| `lore_entities` | `noun` (PK), `canonical`, `category`, `summary`, `full_text`, `source_urls`, `embedding_id`, `fetched_at`, `last_used_at` | Proper-noun entity registry. One row per canonical entity name. |
| `lore_entity_aliases` | `alias` (PK), `canonical` | Maps lowercase noun variants to their canonical name. Seeded from `genshin_seed.json`. |
| `lore_entities_fts` | (virtual FTS5) | Full-text index over `lore_entities.canonical`, `.summary`, `.full_text`. Not used by `retrieval.ts` (entities are retrieved directly by `harvestNouns`). |
| `saves` | `id` (UUID PK), `session_id`, `slot`, `name`, `turn_idx`, `preview_text`, `preview_image_id`, `created_at`, `schema_version` | Save metadata. Shown in the Load Game screen. |
| `session_snapshots` | `save_id` (PK), `character_json`, `inventory_json`, `relationships_json`, `summary_text`, `turn_idx`, `schema_version`, `story_progress_json`, `choice_flags_json`, `npc_state_json`, `lore_unlocks_json` | Full serialized game state at save time. The last four columns were added via `ALTER TABLE` migrations. |
| `autosaves` | `session_id` (PK), `save_id` | Placeholder for automatic saves. The autosave logic in `generateStoryTurn` (line 601–604) is a stub — the insert is commented out. |
| `story_progress` | `session_id` (PK), `current_beat_id`, `beat_state` (JSON), `completed_beats` (JSON array) | Tracks which beat the session is on and which `must_happen` events are done. `beat_state` shape: `{ completedMustHappen: string[] }`. |
| `choice_flags` | `(session_id, flag)` composite PK, `value`, `set_at_turn`, `set_at_beat` | Permanent player decisions. Replaces on conflict (`INSERT OR REPLACE`). |
| `npc_state` | `(session_id, canonical_name)` composite PK, `status`, `last_seen_beat`, `sprite_image_id`, `portrait_desc` | Tracks per-NPC state (alive/dead, sprite). Currently populated on load from snapshot but not actively written during play. |
| `side_goals` | `id` (autoincrement PK), `session_id`, `beat_id`, `turn_idx`, `label`, `kind`, `created_at` | Log of emergent side activities. UI shows last 20. |

**Migration mechanism**: `db.ts` uses bare `try/catch` around `ALTER TABLE ADD COLUMN` statements. If a column already exists, SQLite throws and the error is swallowed silently. This is simple but non-idempotent — there's no version tracking for individual migrations (only a `schema_version` integer in the `saves` table).

---

## §14 — External dependencies and why each was chosen

**`@google/genai` (^1.29.0)**: Google's unified SDK covering both Vertex AI and the direct Gemini API in one package. Supports `vertexai: true` mode for ADC-based auth and `apiKey` mode for direct access. Used here because it covers all three AI needs: text generation (Gemini), image generation (Imagen), and embeddings (`text-embedding-004`).

**`better-sqlite3` (^12.9.0)**: Synchronous SQLite bindings for Node.js. Chosen over `sqlite3` (async/callback) or `@databases/sqlite` for simplicity. Synchronous access matches the Express request-response model without async/await complexity. Supports `db.transaction()` natively.

**`sqlite-vec` (^0.1.9)**: A loadable SQLite extension that adds a `vec0` virtual table type and `vec_distance_cosine()` function. Enables semantic (embedding) search directly inside SQLite without a separate vector database. Trade-off: less scalable than Pinecone/Qdrant/pgvector, but zero infrastructure — perfect for a local single-user app.

**`express` (^4.21.2)**: Minimal Node HTTP server framework. Provides the `/api/*` route handlers. Used because the project needed a real server for AI calls (can't make Vertex calls from the browser) while keeping things simple.

**`motion` (^12.23.24)**: The production successor to Framer Motion. Used for `AnimatePresence` (unmount animations) and `motion.div` (the HUD toast slide-ins). Chosen over CSS animations for the `AnimatePresence` unmount support, which plain CSS cannot easily do.

**`lucide-react` (^0.546.0)**: A tree-shakeable React icon library. Provides UI icons (Save, Undo, Settings, Home, MapPin, etc.) without the bundle weight of Font Awesome.

**`tailwindcss v4` + `@tailwindcss/vite`**: The v4 Vite plugin approach means Tailwind is a Vite plugin, not a PostCSS plugin — simpler config (no `tailwind.config.js` needed). v4 uses CSS-first configuration.

**`tsx` (^4.21.0)**: TypeScript Execute. Runs `.ts` files directly via the Node `--loader` or `--import` flag without a compile step. Used as the dev server runner (`tsx server.ts`) and for script execution (`tsx scripts/*.ts`).

**`vite` (^6.2.0)**: Fast frontend bundler with HMR (disabled here). Handles React JSX transformation, Tailwind processing, and SPA serving. In dev, its middleware is embedded inside the Express server so both API routes and the SPA run on the same port 3000.

**`dotenv` (^17.2.3)**: Loads `.env` (or `.env.local`) into `process.env`. Used in development — in production, env vars would be injected by the deployment platform.

---

## §15 — Known limitations and footguns

**HMR is disabled** (`vite.config.ts:17`): Hot Module Replacement is turned off with `hmr: false`. Editing frontend files requires a manual browser refresh. This was intentional for the AI Studio environment to prevent flickering during automated edits, but it significantly slows frontend development.

**Rollback is partial**: Rolling back a turn removes the history row and flags, but does not revert HP or inventory changes from that turn. A player who was damaged or had items stolen/removed will not have those changes undone. Implementing full rollback would require storing inverse deltas (e.g. `hpChange: +15` to undo `hpChange: -15`) or replaying all deltas from turn 0.

**Two Gemini credentials**: Vertex AI (for story, Imagen, embeddings) uses ADC (`GOOGLE_APPLICATION_CREDENTIALS`). The noun harvester's Google Search tool uses `MY_GEMINI_API_KEY` (direct API). Forgetting either will cause silent failures in specific subsystems:
  - Missing `GOOGLE_CLOUD_PROJECT`: story generation fails immediately (throws on `getAi()`)
  - Missing `MY_GEMINI_API_KEY`: noun harvesting silently skips Google Search lookups (returns empty strings), leading to less accurate lore context

**Imagen fallback to picsum**: If both Imagen tiers (`imagen-3.0-generate-002` and `imagen-3.0-fast-generate-001`) fail (quota exceeded, Vertex auth error, etc.), the game continues but every panel shows a generic gray picsum.photos placeholder image. There is no user-visible error — it silently degrades.

**Region lock fails silently**: If the AI sets `locationChange` to a locked region despite the system prompt instruction, the server logs a warning to console but **does not communicate this to the client**. The UI will not show any error, and the character's location will not update. This can cause confusing state where the player seems to travel but the location doesn't change.

**sqlite-vec extension**: If `sqliteVec.load(db)` fails (e.g., native binding incompatible with the platform), the `lore_vec` virtual table won't exist and `retrieval.ts` vector search will throw on every turn. The error propagates up and causes a 500 on `/api/generateStoryTurn`. The system would need a try/catch around `vecSearch.all(...)` to degrade gracefully to FTS-only retrieval.

**Naive retrieval merge**: `retrieval.ts` uses a simple "FTS results first, then Vec results, cap at 5" merge. A proper Reciprocal Rank Fusion would give more accurate ranking. As-is, FTS results always take priority over semantically similar but keyword-absent results.

**No autosave**: The autosave code in `generateStoryTurn` (lines 601–604) is a comment stub. Players who forget to save and close the tab lose progress.

**Hardcoded GCP project IDs in test files**: Several `test_*.ts` files have `project-df3b0f17-dc21-427c-8bb*` hardcoded. These should be removed before sharing the code publicly.

**Image BLOBs grow unbounded**: Generated images accumulate in the `images` table with no cleanup. A 10-hour session generating one panel per turn (averaging ~200 KB per JPEG) would produce ~150 MB of image data in the SQLite file. There is no garbage collection or expiry.

---

## §16 — Mental model recap

The system has three nested loops and two parallel pipelines feeding one prompt:

```
┌─────────────────────────────────────────────────────────┐
│  OUTER LOOP: Canon Beat Advancement                     │
│  data/canon/*.json drives story structure               │
│  Progresses when mainGoalComplete=true + all must_happen│
│  done → getNextBeat() → possibly unlock new region      │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  MIDDLE LOOP: Per-Turn AI Generation              │  │
│  │                                                   │  │
│  │  Player action                                    │  │
│  │      ↓                                            │  │
│  │  buildTurnPrompt (canon + character + history)   │  │
│  │      + ENTITY LORE (noun harvester)              │  │
│  │      + RETRIEVED LORE (FTS5 + vec)               │  │
│  │      ↓                                            │  │
│  │  Gemini (structured JSON)                        │  │
│  │      ↓                                            │  │
│  │  Imagen-3 (manga panel)                          │  │
│  │      ↓                                            │  │
│  │  SQLite transaction (all state mutations)        │  │
│  │      ↓                                            │  │
│  │  Response to client                              │  │
│  │                                                   │  │
│  │  ┌─────────────────────────────────────────────┐ │  │
│  │  │  INNER LOOP: Per-Frame UI                   │ │  │
│  │  │  AudioManager reacts to bgmMood (cross-fade)│ │  │
│  │  │  sfxAction fires after 250ms delay          │ │  │
│  │  │  TTS speaks latest.dialogue                 │ │  │
│  │  │  HUD toasts animate in from right           │ │  │
│  │  └─────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Frontend is thin**: React holds only the current `character` (cached from server) and the `history` array (accumulated `StoryNode` objects). All authoritative state lives in SQLite.

**One source of truth, one spine**:
- **SQLite** (`data/teyvat.db`): per-session mutable state (character, inventory, HP, relationships, flags, story progress)
- **Canon JSON** (`data/canon/*.json`): immutable story structure that everyone reads but nobody modifies at runtime

**Two RAG paths, one prompt**: Noun harvester gives precision (named entities with exact lore). Hybrid retrieval gives breadth (thematic context from the lore table). Both feed into the same prompt so Gemini has both specific and contextual information.

---

## §17 — Where to start hacking

### Add a new story region

1. Run `npx tsx scripts/canon_new_region.ts "RegionName"` → creates `data/canon/NN_regionname.json`
2. Open the new file and fill in the `beats` array following the `_schema.json` format
3. Add the region name to `regionDefaultBgm` in `AudioManager.tsx` if you want a default BGM
4. Test: play through until the last Mondstadt beat completes — the game should auto-unlock your new region

### Add a new HUD toast type

1. Add the new field to `responseSchema` in `aiRouter.ts` (e.g. `"discoveryMade": { type: Type.STRING }`)
2. Add it to the `StoryNode` interface in `src/types.ts`
3. Store it in the `history` table: add a column to `db.ts` and update the `INSERT INTO history` call
4. Handle it in `applyTurnDeltas` if it needs a DB state mutation
5. Add a `motion.div` block in `GameChat.tsx` lines 333–379 to render the toast

### Tune the AI prompt

- **System-level tone**: Edit `SYSTEM_INSTRUCTION` in `aiRouter.ts:31`
- **Per-turn context**: Edit `buildTurnPrompt` in `aiRouter.ts:339` — add/remove blocks, change formatting
- **Temperature / tokens**: Modify `configVars` in the `generateStoryTurn` handler (`aiRouter.ts:551–558`)

### Swap the image model

In `generateMangaImageInternal` (`aiRouter.ts:111`):
- Change `'imagen-3.0-generate-002'` to another model
- Change the fallback `'imagen-3.0-fast-generate-001'`
- Change `aspectRatio`, `outputMimeType`, or the style boilerplate string at the top of the function

### Add a new BGM mood

1. Add the MP3 to `public/audio/bgm/`
2. Add a mapping in `bgmUrls` in `AudioManager.tsx:5`
3. Add the new mood string to `responseSchema.bgmMood.description` in `aiRouter.ts:64`
4. Update `SYSTEM_INSTRUCTION` to tell the AI when to use the new mood

### Fix the partial rollback

In `applyTurnDeltas` (`aiRouter.ts:240`), when inserting items or changing HP, also store inverse deltas. One approach: add `inverse_hp_change` and `inverse_items` columns to the `history` table. In the rollback handler (`aiRouter.ts:645`), read these values and apply the inverse before deleting the row.

### Implement real autosave

In `generateStoryTurn` (`aiRouter.ts:601`), replace the stub comment with an actual `POST /api/saves/session/:id/save` call using a dedicated autosave slot. The `autosaves` table already exists in the schema for tracking the autosave save ID.

---

*This guide covers the codebase as of April 2026. File line numbers may shift as the project evolves — use them as a starting point, not a contract.*
