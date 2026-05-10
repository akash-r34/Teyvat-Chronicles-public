# Teyvat Tales — Where? What? How? Why? Guide

A decision-oriented companion to `CODEBASE_GUIDE.md`. For each system or design pattern, this answers four questions: **Where** it lives in the code, **What** it actually is, **How** it works mechanically, and **Why** it was built that way.

---

## 1. The Express + Vite Dual-Server Setup

**Where?** `server.ts` (root), `vite.config.ts`

**What?** A single Node process runs both the Express REST API and the Vite frontend dev server simultaneously on port 3000. In production, Express serves the static `dist/` build instead.

**How?**
```
npm run dev → tsx server.ts
  Express mounts /api/* routes first
  Then: vite.createServer({ middlewareMode: true })
  app.use(vite.middlewares)   ← catches all non-API requests
```
In production (`NODE_ENV=production`):
```
Express serves dist/ as static files
app.get('*', ...) → sends dist/index.html for all unknown routes (SPA fallback)
```

**Why?** The game can't call Vertex AI or SQLite from the browser — both require server-side credentials and native bindings. But the UI is a React SPA. Embedding Vite as Express middleware means one port, one process, no CORS headers, no proxy configuration. It's the simplest way to run a full-stack TypeScript app in a single command.

---

## 2. The Status State Machine (`App.tsx`)

**Where?** `src/App.tsx:17`

**What?** The entire app flow is controlled by a single `status` string field in `App`'s state. It acts as a screen router without any routing library.

**How?**
```
'title'    → TitleScreen renders
'load'     → LoadGameScreen renders
'creation' → CharacterCreation renders
'reveal'   → AvatarReveal renders
'playing'  → GameChat renders
```
Transitions are plain function calls: `setState({ ...state, status: 'playing' })`. There's no `react-router`, no URL changes, no browser history.

**Why?** The game has a strict linear flow (create → reveal → play) with only one branch (load → play). A full router would add complexity with no benefit. The status machine is explicit, easy to follow, and requires no library. The trade-off is that the browser Back button doesn't navigate between screens — acceptable for a game.

---

## 3. The Canon Beat System

**Where?** `data/canon/*.json`, `src/server/canon.ts`, `src/server/aiRouter.ts:339` (buildTurnPrompt), `src/server/db.ts` (story_progress table)

**What?** A set of authored JSON "beat" objects that define what *must* happen in the story. Each beat has sequential `must_happen` events and a `main_goal` exit condition. The AI is told the current objective each turn and must set `mainGoalComplete=true` to advance.

**How?**
```
DB: story_progress.current_beat_id = "mond.01"
         ↓
buildTurnPrompt reads beat → finds first unfinished must_happen
         ↓
Injects as CURRENT OBJECTIVE into prompt
         ↓
AI generates → sets mainGoalComplete=true when achieved
         ↓
applyTurnDeltas: marks that must_happen complete
   → if more must_happen remain: next one becomes objective
   → if all done: main_goal becomes objective
   → if main_goal complete: getNextBeat() → advance
         ↓
New beat → new CURRENT OBJECTIVE next turn
```

**Why?** LLMs are statistically likely to meander, skip important characters, or invent plot. The canon system is a hard rails that ensures the game hits Genshin's actual story beats (Paimon on the beach, the Statue of the Seven, meeting Amber, etc.) while leaving 100% of the prose, tone, and player-reactive moments to the AI. It's the same design pattern as a tabletop game's adventure module: the module tells the DM what must happen; the DM improvises everything else.

---

## 4. Two Different Google AI Credentials

**Where?** `src/server/aiRouter.ts:13–29`, `src/server/nounHarvester.ts:37–56`, `.env.example`

**What?** The project uses Vertex AI (via Application Default Credentials / ADC) for story generation, Imagen, and embeddings — and the direct Gemini API (via `MY_GEMINI_API_KEY`) exclusively for the noun harvester's Google Search calls.

**How?**
```
getAi() → GoogleGenAI({ vertexai: true, project: GCP_PROJECT, location: 'global' })
  Used for: gemini-2.5-flash (story), gemini-3-flash-preview (summary/vision),
            imagen-3.0-generate-002 (images), text-embedding-004 (embeddings)

getGeminiAi() → GoogleGenAI({ apiKey: MY_GEMINI_API_KEY })
  Used for: noun harvester Search calls only
            config: { tools: [{ googleSearch: {} }] }
```

**Why?** Google's `googleSearch` grounding tool is only available via the **direct Gemini API key** path in `@google/genai`. The Vertex AI path with ADC uses a different endpoint that doesn't expose the same Search tool configuration. Rather than try to unify them (which may not be possible with the current SDK), the project uses two separate clients: ADC for everything that needs Vertex's scale and Imagen access, and a direct key for the one feature that requires it.

---

## 5. Structured JSON Output (responseSchema)

**Where?** `src/server/aiRouter.ts:41–108`

**What?** Every Gemini call for story generation uses `responseMimeType: "application/json"` plus a full `responseSchema` object that enumerates every field the game needs. The model is constrained to output valid JSON matching the schema — no free-form prose.

**How?**
```typescript
config: {
  responseMimeType: "application/json",
  responseSchema: responseSchema,   // defines all fields + their types
  temperature: 0.7,
  maxOutputTokens: 4096
}
// Server then does: JSON.parse(response.text)
```
Required fields: `narrative`, `speaker`, `dialogue`, `imagePrompt`, `choices`, `mainGoalComplete`, `sideGoalsThisTurn`, `relationshipDelta`.

**Why?** Without a schema, Gemini might return Markdown prose, explanation text, or JSON wrapped in code fences — all of which would break `JSON.parse()`. Constrained generation eliminates an entire class of runtime errors. The trade-off is that structured output can sometimes feel slightly more formulaic than free-form responses, but the game compensates with a high-quality system prompt.

---

## 6. The JSON Parse Retry Strategy

**Where?** `src/server/aiRouter.ts:213–239` (`aiCallWithTimeoutAndRetry`)

**What?** Every AI call is wrapped in a 30-second timeout and one retry attempt. If the first attempt produces invalid JSON, the retry lowers the temperature and appends a "RESPOND ONLY WITH VALID JSON" warning to the prompt.

**How?**
```
Attempt 1: temperature=0.7, prompt as-is
  → 30s timeout race
  → if SyntaxError: lower temp by 0.2, append JSON warning
Attempt 2: temperature=0.5, reinforced prompt
  → 30s timeout race
  → if still fails: throw (caller returns fallback node)
```

**Why?** Even with a schema, high temperature can occasionally produce malformed output (truncated JSON, non-JSON preamble). Lowering temperature on retry exploits the fact that JSON formatting errors are often a "creativity overshoot" — reducing randomness makes the model more likely to stick to valid structure. The fallback "anomaly" node shown to the user is preferable to a crash.

---

## 7. The Noun Harvester (Automatic Lore Discovery)

**Where?** `src/server/nounHarvester.ts`, called from `src/server/aiRouter.ts:474–475` (post-initial) and `src/server/aiRouter.ts:526–531` (pre-turn) and `:607` (post-turn)

**What?** Every turn, any capitalized word sequence in the player's action or the AI's narrative is treated as a potential Genshin proper noun. Unknown nouns trigger a real-time Google Search query via Gemini to look up their lore, which is then embedded and stored for future retrieval.

**How?**
```
Text: "The Knights of Favonius guard the Cathedral..."
         ↓
extractNouns() → regex \b[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*\b
  → ["Knights", "Favonius", "Cathedral", "Knights of Favonius", ...]
         ↓
Each noun looked up in lore_entity_aliases table
  HIT → canonical name known, update last_used_at
  MISS → call fetchNounGoogle("knights of favonius", "Knights of Favonius")
           → Gemini + { googleSearch: {} } → summary ≤300 tokens
           → embed with text-embedding-004 → store in lore_entities + lore_vec
           → add alias to lore_entity_aliases
         ↓
Return ["Knights of Favonius: <summary>", ...] → injected into ENTITY LORE block
```
Budget: at most 3 misses processed per call (hot path limit).

**Why?** Genshin Impact has hundreds of named characters, factions, locations, and items. Hardcoding all of them upfront is impractical. The harvester discovers lore *on demand* as the story naturally introduces proper nouns. Google Search grounding means the summaries are based on real wiki content, not hallucinated. The embedding + storage ensures that once a noun is learned, it's never looked up again.

---

## 8. Hybrid FTS5 + Vector Retrieval

**Where?** `src/server/retrieval.ts`, `src/server/db.ts` (`lore_fts`, `lore_vec` tables)

**What?** A two-path search over the `lore` table: keyword matching (FTS5) and semantic similarity (cosine distance on 768-d embeddings). Results are naively merged (FTS first, then Vec) and capped at 5 entries.

**How?**
```
Query = userAction + recent narrative

Path A — FTS5:
  SELECT topic, text FROM lore_fts WHERE lore_fts MATCH ? ORDER BY rank LIMIT 10

Path B — Vector:
  embed(query) → 768-d Float32Array
  SELECT l.topic, l.text, vec_distance_cosine(v.embedding, ?) as distance
  FROM lore_vec v JOIN lore l ON l.id = v.id
  WHERE l.session_id = ?
  ORDER BY distance ASC LIMIT 10

Merge: add FTS hits to Map<text, topic> until 5, then fill from Vec hits
Return as "- [topic]: text\n" lines
```

**Why two paths?** FTS5 catches exact keyword matches ("Vision", "Mondstadt") that embeddings might not rank highly if the query phrasing differs. Vector search catches *thematically* related content even when the exact words differ (e.g. "elemental power" retrieves lore about "Visions"). Together they cover both precision (FTS) and recall (Vec). SQLite handles both natively — no external search infrastructure needed.

**Why the naive merge?** Simplicity. Proper Reciprocal Rank Fusion would be more accurate but requires score normalization and more code. At 5 results, the quality difference is often imperceptible.

---

## 9. SQLite for Everything (Including Images and Vectors)

**Where?** `src/server/db.ts`, `data/teyvat.db`

**What?** All persistence — game state, history, images (as BLOBs), embeddings (via sqlite-vec extension), saves — goes into a single SQLite file. No Redis, no S3, no Postgres, no Pinecone.

**How?**
- Images: `INSERT INTO images (bytes BLOB)` → served via `GET /api/images/:id` which reads the BLOB and sets `Content-Type`
- Vectors: `sqlite-vec` extension loaded at startup adds `CREATE VIRTUAL TABLE lore_vec USING vec0(embedding float[768])` — vectors stored and searched natively in SQLite
- WAL mode: `PRAGMA journal_mode = WAL` — allows one writer and multiple readers concurrently without lock contention

**Why?** The game is designed to run locally on a single machine. SQLite's zero-configuration, single-file design perfectly matches this. For image storage: storing BLOBs in SQLite avoids a filesystem dependency (no `public/uploads/` directory to manage, no path mismatches). For vectors: sqlite-vec means no Pinecone account, no Docker container, no network call — semantic search is just another SQL query. The trade-off is that the `.db` file grows large over time (images accumulate), and the solution wouldn't scale to multi-user.

---

## 10. The `applyTurnDeltas` Transaction

**Where?** `src/server/aiRouter.ts:240–337`

**What?** A single SQLite transaction that atomically applies all state mutations from one AI response turn: HP change, inventory add/remove, quest update, location change, relationship upserts, beat advancement, side goals, and flags.

**How?**
```typescript
db.transaction(() => {
  // 1. HP (clamped to [0, max_hp])
  // 2. itemGained → INSERT INTO inventory
  // 3. itemsRemoved → DELETE WHERE item LIKE '%x%'
  // 4. questUpdated → UPDATE character
  // 5. locationChange → check region lock → UPDATE character
  // 6. relationshipDelta → UPSERT relationships
  // 7. mainGoalComplete → advance must_happen or beat
  // 8. sideGoalsThisTurn → INSERT INTO side_goals
  // 9. flagsSet → INSERT OR REPLACE INTO choice_flags
})();
```
All of this runs atomically — if any step throws, the entire turn's state changes are rolled back.

**Why one transaction?** Any partial application would leave the game in an inconsistent state. If HP updated but the beat didn't advance, or if an item was added but the relationship wasn't recorded, the game's state would diverge from what the AI narrated. The transaction guarantees "all or nothing" — either the whole turn's consequences land, or none of them do.

---

## 11. Rolling Summarization Every 5 Turns

**Where?** `src/server/summarize.ts`, called from `src/server/aiRouter.ts:596–598`

**What?** Every 5 turns, a Gemini call summarizes the entire session history into ≤400 tokens. This summary is injected into every subsequent prompt under `STORY SUMMARY SO FAR:`.

**How?**
```
Turn 5, 10, 15, ...:
  Fetch ALL history rows for session (in order)
  Format: "Player: X\nNarrator/Character: Y Z" blocks
  Call gemini-3-flash-preview:
    "Summarize into ≤400 tokens, preserving named entities, unresolved threads, and vows."
  INSERT OR REPLACE INTO summary (session_id, up_to_turn, text)
```
Runs async (non-blocking — the story turn response is sent before summarization completes).

**Why?** LLMs have finite context windows. Without summarization, a long game session would either hit the token limit or require sending thousands of history tokens per turn (slow, expensive). The summary compresses old history into a compact representation that keeps the AI aware of past events. The trade-off: the summary is lossy — fine details from early turns may be dropped. The "preserving named entities, unresolved threads, and vows" instruction mitigates this for the most plot-relevant information.

**Why every 5 turns specifically?** Arbitrary but reasonable. Frequent enough that summaries stay current, infrequent enough to not add significant latency or cost. The first summary at turn 5 includes the prologue + 4 player turns — enough context to be meaningful.

---

## 12. Session Cloning on Load

**Where?** `src/server/routes/save.ts:76–180`

**What?** Loading a save doesn't restore the original session — it creates a **brand new session ID** and copies all saved rows into it. The original session (and its history) remains intact.

**How?**
```
POST /api/saves/:saveId/load
  Read session_snapshots (character_json, inventory_json, ...)
  newSessionId = crypto.randomUUID()
  INSERT INTO sessions (id = newSessionId)
  INSERT INTO character (session_id = newSessionId, ...)
  INSERT INTO inventory (session_id = newSessionId, ...)
  ... (relationships, summary, story_progress, choice_flags, npc_state)
  Copy history rows WHERE session_id = original_id AND turn_idx <= save_turn_idx
  Return { sessionId: newSessionId, history: tail5 }
```

**Why clone instead of restore?** Multiple loads from the same save create independent play-throughs — the player can explore different choices without destroying their save. The original save file remains valid for another load attempt. It also sidesteps a complex "undo all mutations" problem: instead of reverting the current session's state, you get a fresh, clean session with the saved data.

---

## 13. The Avatar `enhancedDescription` for Visual Consistency

**Where?** `src/server/aiRouter.ts:183–198` (vision call in `/generateAvatar`)

**What?** After generating the avatar portrait, a second Gemini call analyzes the generated image and returns a dense textual description of the character's exact appearance — colors, clothing, pose, distinctive features. This description is stored on the `Character` object and reused in every manga panel's `imagePrompt`.

**How?**
```
Imagen-3 generates portrait → bytes[]
  ↓
gemini-3-flash-preview vision call:
  "Analyze this avatar. Describe clothing, style, colors, pose, aesthetic
   to maintain consistent representations in future image generations."
  Returns: "Short dark hair with silver streaks, wearing a teal and black
            kimono-style coat, red Vision gem on left shoulder..."
  ↓
Stored as character.description (enhancedDescription)
  ↓
Every subsequent manga panel prompt includes this description
```

**Why?** Imagen-3 is non-deterministic. Without a reference description, the character would look different in every panel — different hair color, different outfit, different face. By having the vision model "lock in" the visual spec from the avatar, all future panels use the exact same description as a style anchor. It's a textual approximation of ControlNet-style consistency — imperfect but significantly better than no reference.

---

## 14. HMR Disabled in Vite

**Where?** `vite.config.ts:16` — `server: { hmr: false }`

**What?** Hot Module Replacement (the feature that updates the browser without a full page reload when you edit a frontend file) is completely disabled.

**How?** One config line: `hmr: false`. Any frontend file change requires a manual browser refresh to see the effect.

**Why?** The comment says "AI Studio agent edit flicker prevention". The AI Studio environment uses an automated agent that edits files. If HMR is enabled, every file save triggers a browser reload mid-edit, causing visual flickering and state resets while the agent is still writing. Disabling HMR keeps the browser stable during automated edits. The cost is slower developer iteration — but in the AI Studio workflow, agent edits are fast enough that manual refreshes are acceptable.

---

## 15. Browser TTS (Not a Cloud Voice API)

**Where?** `src/services/voice.ts`, called from `src/components/GameChat.tsx:98–109`

**What?** Text-to-speech uses the browser's built-in `window.speechSynthesis` API — no ElevenLabs, no Google Cloud TTS, no server call. It reads dialogue (and optionally narration) aloud using whatever voices the operating system has installed.

**How?**
```
speak(text, voicePrefs, speakerName)
  → pickVoiceForSpeaker(speakerName, installedVoices)
     → heuristic: Paimon/Amber → female voice
     → heuristic: Diluc/Kaeya → male voice
     → fallback: hash(speakerName) % voices.length (deterministic)
  → adjust pitch (Paimon=1.5, Venti=1.2, Diluc=0.7)
  → chunkText(text, 300) → speak chunks sequentially via u.onend callbacks
```
TTS is opt-in (default: disabled). Preferences saved to `localStorage('genshinVoicePrefs')`.

**Why the browser API?** Zero cost, zero latency, zero API key. Cloud TTS APIs (ElevenLabs, Google Cloud TTS) are high quality but add per-character cost and a server round-trip. For a local game where voice is a nice-to-have, the browser API is a pragmatic choice. The trade-off: voice quality varies wildly between operating systems (Windows has better built-in voices than macOS), and the heuristic voice picking is rough approximation, not character-accurate casting.

---

## 16. Region Travel Lock (Silent Enforcement)

**Where?** `src/server/aiRouter.ts:267–277` (in `applyTurnDeltas`), `src/server/aiRouter.ts:36` (in `SYSTEM_INSTRUCTION`)

**What?** Players can only travel to unlocked regions. Mondstadt is unlocked from the start. Other regions unlock when the corresponding canon beat is completed. If the AI tries to set `locationChange` to a locked region, the server silently drops the update.

**How?**
```
Two layers of enforcement:

Layer 1 — Prompt instruction (SYSTEM_INSTRUCTION):
  "Never set locationChange to a location in a locked region.
   If the player asks to go there, narrate an in-world reason."

Layer 2 — Server enforcement (applyTurnDeltas):
  region = regionOfLocation(parsed.locationChange)
  if (region && !unlocked.includes(region)):
    console.warn("Refusing locationChange — region locked")
    // DO NOT update character.location
```

**Why silent?** The AI is told to handle it in-narrative ("the road is closed", "no ship available"), so ideally the player never sees a jarring rejection — the story absorbs the constraint. The server enforcement is a safety net for cases where the AI ignores the instruction. Surfacing a hard error to the UI would break immersion.

**Why not just tell the AI and trust it?** LLMs don't follow every instruction every time. A belt-and-suspenders approach (prompt guidance + server enforcement) is more reliable than either alone.

---

## 17. The `lore_entities` vs `lore` Split

**Where?** `src/server/db.ts` (both tables), `src/server/nounHarvester.ts` (writes `lore_entities`), `src/server/retrieval.ts` (reads `lore`)

**What?** There are two separate lore storage systems that look similar but serve different purposes:
- `lore_entities` — proper-noun registry (global, not session-scoped)
- `lore` — arbitrary lore chunks (session-scoped, not currently written by any active code path)

**How?**
```
lore_entities: noun (PK), canonical, summary, embedding_id
  Written by: nounHarvester (Google Search results)
  Read by: nounHarvester (returns summaries for ENTITY LORE block)
  Indexed by: lore_entities_fts (FTS), lore_vec (via embedding_id)

lore: id (UUID PK), session_id, topic, text, source
  Written by: nothing currently (table exists but no code path inserts into it)
  Read by: retrieval.ts (FTS + vec search)
  Indexed by: lore_fts (FTS), lore_vec (via lore.id)
```

**Why two tables?** `lore_entities` is a global dictionary of named things (Mondstadt, Paimon, the Fatui). It's shared across all sessions — once Mondstadt is learned, every future session benefits. `lore` was intended for longer-form context chunks (e.g., wiki article excerpts, lore book entries) that could be seeded per-region. The `lore` table is a future extension point — currently empty, but `retrieval.ts` is ready to query it as soon as content is loaded there.

---

## 18. `choices: Choice[] | string[]` — The Dual Type

**Where?** `src/types.ts:44`, `src/components/GameChat.tsx:412–435`

**What?** `StoryNode.choices` can be either an array of `Choice` objects `{ text, tone, timed? }` or a plain array of strings. The component handles both.

**How?**
```typescript
// In GameChat.tsx:
const isObj = typeof choiceRaw === "object";
const text = isObj ? choiceRaw.text : choiceRaw;
const tone = isObj ? choiceRaw.tone : 'neutral';
```
If the AI returns objects, the choices get colored borders based on tone. If it returns strings (old format or fallback nodes), they render as neutral white-bordered choices.

**Why not enforce objects?** Defensive programming. Fallback `StoryNode` objects created client-side on errors (`GameChat.tsx:131–140`) use plain string arrays. Some early API responses may have predated the tone field. Accepting both formats means the UI never crashes regardless of what's in the choices array.

---

## 19. `client-side` fetch wrappers in `aiService.ts`

**Where?** `src/services/aiService.ts`

**What?** A set of thin async functions that wrap `fetch()` calls to the server. They add no business logic — just set headers, handle `!response.ok`, and return parsed JSON.

**How?**
```typescript
export async function generateStoryTurn(...): Promise<StoryNode> {
  const response = await fetch("/api/generateStoryTurn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history, character, userAction })
  });
  if (!response.ok) throw new Error(...);
  return await response.json();
}
```

**Why?** Separating fetch calls from component logic (GameChat.tsx) makes them independently testable and easy to swap (e.g., if an endpoint URL changes, you update one file). It also makes the component easier to read — `handleAction` reads as business logic, not HTTP plumbing. Note: `generateMangaImage` in this file is a dead stub (returns picsum URL) — real image generation happens server-side as an internal implementation detail of `/api/generateStoryTurn`.

---

## 20. `hasSaveGame` Check on Every Status Change

**Where?** `src/App.tsx:40–47`

**What?** Every time `state.status` changes, `App.tsx` re-fetches `/api/saves` and updates the `hasSaveGame` boolean that controls whether the "Load Game" button is enabled on the title screen.

**How?**
```typescript
useEffect(() => {
  fetch('/api/saves')
    .then(r => r.json())
    .then(d => setHasSaveGame(d && d.length > 0))
    .catch(() => setHasSaveGame(false));
}, [state.status]);
```

**Why on status change?** The user might save during gameplay, then return to the title screen. If the check only ran on mount, the Load button would still be disabled even though a save now exists. By tying it to `state.status`, the check automatically re-runs whenever the player returns to the title screen from any other state.

---

## 21. The `__END__` Sentinel for Completed Storylines

**Where?** `src/server/aiRouter.ts:304–305` (set in `applyTurnDeltas`) and `aiRouter.ts:344–346` (checked in `buildTurnPrompt`)

**What?** When the player completes the last beat in the entire canon, `story_progress.current_beat_id` is set to the literal string `'__END__'`. The prompt builder detects this and switches to a free-roam mode.

**How?**
```typescript
// applyTurnDeltas — when advancing past the last beat:
const nextBeat = getNextBeat(beatId);
db.prepare('UPDATE story_progress SET current_beat_id = ?')
  .run(nextBeat ? nextBeat.id : '__END__');

// buildTurnPrompt — detected:
if (currentBeatIdRow?.current_beat_id === '__END__') {
  prompt += `--- CANON COMPLETE ---
The player has finished the main storyline! Let them freely explore.
Do not set mainGoalComplete to true anymore.`;
}
```

**Why a sentinel string instead of `null`?** `null` could mean "not initialized yet" — an ambiguous state. `'__END__'` is an explicit signal with a clear, distinct meaning. The check `=== '__END__'` is unambiguous. The foreign key constraint on `story_progress.current_beat_id` is intentionally not enforced (there's no `REFERENCES` clause), so inserting `'__END__'` doesn't violate any constraint.

---

## 22. The `data/canon/_spoiler-tiers.json` File

**Where?** `data/canon/_spoiler-tiers.json`

**What?** A mapping from lore concept keys (e.g. `"false_sky"`, `"celestia"`, `"abyss_twin"`) to the region where that spoiler becomes speakable. This controls what deep lore the AI is allowed to reveal.

**How?** Currently **not enforced at runtime** — `canon.ts` doesn't read it, and the AI isn't injected with spoiler-tier rules. It exists as authoring reference: beat authors consult it when writing `canon_dialogue_hooks` to know which lore is safe to reveal at which point in the story.

**Why does it exist?** Genshin Impact's story has major late-game revelations (the False Sky, Celestia's true nature, the player's twin). If the AI reveals these in the Mondstadt prologue, it destroys the narrative. The spoiler-tier system is the design for preventing this — the values exist but the enforcement code is a future implementation task.

---

## 23. Prompt Size Warning Threshold

**Where?** `src/server/aiRouter.ts:540–542`

**What?** If the assembled prompt exceeds 12,000 characters, the server logs a warning: `"WARNING: Prompt length is X chars (approx Y tokens). Bloat risk."`

**How?**
```typescript
if (prompt.length > 12000) {
  console.warn(`[Prompt Size] WARNING: Prompt length is ${prompt.length} chars ...`);
}
```
No truncation happens — it's a passive warning only.

**Why 12,000 characters?** Roughly 4,000 tokens at ~3 chars/token. `gemini-2.5-flash` has a large context window (1M tokens), so this won't cause errors — but very large prompts slow down response time and cost more. The warning is a developer signal to investigate if the lore pipeline is returning too much content or if the history block is growing unusually large. The real bloat risk is the `LAST 3 TURNS` block + `ENTITY LORE` + `RETRIEVED LORE` all being verbose at the same time.

---

## 24. `location_flexible` on Beats

**Where?** `data/canon/01_mondstadt.json` (beat objects), `src/server/canon.ts` (`Beat` interface)

**What?** A boolean field on each beat (`location_flexible: true/false`) indicating whether the player must be in the beat's specified `location` or can be anywhere.

**How?** Defined in the `Beat` TypeScript interface (`canon.ts:13`). Stored in the JSON. **Not currently enforced at runtime** — `buildTurnPrompt` injects the beat's `location` as "Suggested Location", not a hard requirement. The AI is free to deviate.

**Why?** Some story beats must happen in a specific place (the Statue of the Seven scene *must* be at the Statue — `location_flexible: false`). Others can happen anywhere the player has wandered. The field is intended for a future enforcement layer that would refuse to advance a beat if the player isn't in the right location. Currently it's authoring guidance read by beat writers, not an engine constraint.

---

## 25. Why `better-sqlite3` Instead of an Async Driver

**Where?** `src/server/db.ts:1–3`, used throughout all server files

**What?** `better-sqlite3` is a synchronous SQLite driver. Every `db.prepare(...).run(...)` or `.get()` call blocks the thread until the query completes. There is no `await`.

**How?**
```typescript
// Synchronous — no await needed:
const char = db.prepare('SELECT * FROM character WHERE session_id = ?').get(sessionId);
db.prepare('UPDATE character SET hp = ?').run(newHp, sessionId);
```

**Why synchronous?** SQLite queries on a local file are fast (sub-millisecond for most operations). The async overhead of callbacks or Promises would add complexity with no meaningful performance gain. The AI calls (`await ai.models.generateContent(...)`) are the actual bottleneck — each takes 2–10 seconds. SQLite is so fast by comparison that synchronous access is imperceptible. The code is also significantly simpler: `db.transaction(() => { ... })()` instead of a chain of awaited queries.

---

## 26. The `genshin_seed.json` Bootstrap

**Where?** `data/genshin_seed.json`, loaded in `src/server/nounHarvester.ts:9–28` (`initSeed`)

**What?** 8 foundational Genshin entities pre-loaded into `lore_entity_aliases` on every server start: Mondstadt, Paimon, Fatui, Vision, Mora, Adventurers' Guild, Knights of Favonius, Abyss Order.

**How?**
```json
[
  { "noun": "mondstadt", "canonical": "Mondstadt", "category": "region",
    "aliases": ["city of freedom", "mond"] },
  { "noun": "paimon", "canonical": "Paimon", "category": "character",
    "aliases": ["emergency food"] },
  ...
]
```
`initSeed()` is called when `nounHarvester.ts` is imported. Uses `INSERT OR IGNORE` so it's safe to run on every startup.

**Why?** These are the most universally referenced terms in any Genshin story. Without them, the noun harvester would trigger a Google Search call the first time "Paimon" appears in the prologue — adding latency to the very first game moment. Pre-seeding ensures these 8 critical terms are always immediately resolvable as alias hits.

**Why only 8?** Enough to cover the guaranteed first-turn terms without making the seed unwieldy to maintain. As the harvester encounters and learns new nouns, the DB self-extends. The seed is the minimal viable bootstrap, not a comprehensive dictionary.
