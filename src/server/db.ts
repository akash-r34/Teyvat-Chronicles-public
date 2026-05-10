import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'teyvat.db');
const db = new Database(dbPath);

sqliteVec.load(db);

// Enable WAL for concurrency and performance
db.pragma('journal_mode = WAL');

// Migrations
const schema = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS character (
  session_id TEXT PRIMARY KEY,
  name TEXT,
  gender TEXT,
  element TEXT,
  skill TEXT,
  skill_desc TEXT,
  ultimate TEXT,
  ultimate_desc TEXT,
  has_paimon INTEGER,
  chapter INTEGER,
  hp INTEGER,
  max_hp INTEGER,
  level INTEGER,
  location TEXT,
  endgame_goal TEXT,
  current_quest TEXT,
  appearance_desc TEXT,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory (
  session_id TEXT,
  item TEXT,
  qty INTEGER,
  acquired_turn INTEGER,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS relationships (
  session_id TEXT,
  npc TEXT,
  affinity INTEGER,
  last_seen_turn INTEGER,
  notes TEXT,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS history (
  session_id TEXT,
  turn_idx INTEGER,
  speaker TEXT,
  narrative TEXT,
  dialogue TEXT,
  user_action TEXT,
  image_id TEXT,
  bgm_mood TEXT,
  sfx_action TEXT,
  created_at INTEGER,
  PRIMARY KEY (session_id, turn_idx),
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE IF NOT EXISTS history_fts USING fts5(
  narrative, dialogue, user_action, content='history', content_rowid='rowid'
);

CREATE TABLE IF NOT EXISTS lore (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  topic TEXT,
  text TEXT,
  source TEXT, -- 'search' | 'model' | 'seed'
  chapter INTEGER,
  created_at INTEGER,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE IF NOT EXISTS lore_fts USING fts5(
  topic, text, content='lore', content_rowid='rowid'
);

CREATE VIRTUAL TABLE IF NOT EXISTS lore_vec USING vec0(
  id TEXT PRIMARY KEY, /* ID matching lore.id or lore_entities.noun */
  embedding float[768]
);

CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  kind TEXT,
  mime TEXT,
  bytes BLOB,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS search_cache (
  query_hash TEXT PRIMARY KEY,
  query TEXT,
  result_text TEXT,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS summary (
  session_id TEXT PRIMARY KEY,
  up_to_turn INTEGER,
  text TEXT,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lore_entities (
  noun TEXT PRIMARY KEY,
  canonical TEXT,
  category TEXT,
  summary TEXT,
  full_text TEXT,
  source_urls TEXT,
  embedding_id TEXT,
  fetched_at INTEGER,
  last_used_at INTEGER
);

CREATE TABLE IF NOT EXISTS lore_entity_aliases (
  alias TEXT PRIMARY KEY,
  canonical TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS lore_entities_fts USING fts5(
  canonical, summary, full_text, content='lore_entities', content_rowid='rowid'
);

CREATE TABLE IF NOT EXISTS saves (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  slot INTEGER,
  name TEXT,
  turn_idx INTEGER,
  preview_text TEXT,
  preview_image_id TEXT,
  created_at INTEGER,
  schema_version INTEGER
);

CREATE TABLE IF NOT EXISTS session_snapshots (
  save_id TEXT PRIMARY KEY,
  character_json TEXT,
  inventory_json TEXT,
  relationships_json TEXT,
  summary_text TEXT,
  turn_idx INTEGER,
  schema_version INTEGER,
  FOREIGN KEY(save_id) REFERENCES saves(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS autosaves (
  session_id TEXT PRIMARY KEY,
  save_id TEXT,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY(save_id) REFERENCES saves(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS story_progress (
  session_id TEXT PRIMARY KEY,
  current_beat_id TEXT,
  beat_state TEXT,
  completed_beats TEXT,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS choice_flags (
  session_id TEXT,
  flag TEXT,
  value TEXT,
  set_at_turn INTEGER,
  set_at_beat TEXT,
  PRIMARY KEY (session_id, flag),
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS npc_state (
  session_id TEXT,
  canonical_name TEXT,
  status TEXT,
  last_seen_beat TEXT,
  sprite_image_id TEXT,
  portrait_desc TEXT,
  PRIMARY KEY (session_id, canonical_name),
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS side_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  beat_id TEXT,
  turn_idx INTEGER,
  label TEXT,
  kind TEXT,                -- 'completed' or 'ongoing'
  created_at INTEGER,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
`;

db.exec(schema);

try {
  db.exec("ALTER TABLE sessions ADD COLUMN unlocked_regions TEXT");
} catch(e) {}

try {
  db.exec("ALTER TABLE character ADD COLUMN appearance_desc TEXT");
} catch(e) {}

try {
  db.exec("ALTER TABLE character ADD COLUMN surface_goal TEXT");
} catch(e) {}

try {
  db.exec("ALTER TABLE character ADD COLUMN regional_goal TEXT");
} catch(e) {}

try {
  db.exec("ALTER TABLE character ADD COLUMN hidden_arc_goal TEXT");
} catch(e) {}

try {
  db.exec("ALTER TABLE session_snapshots ADD COLUMN story_progress_json TEXT");
} catch(e) {}

try {
  db.exec("ALTER TABLE session_snapshots ADD COLUMN choice_flags_json TEXT");
} catch(e) {}

try {
  db.exec("ALTER TABLE session_snapshots ADD COLUMN npc_state_json TEXT");
} catch(e) {}

try {
  db.exec("ALTER TABLE session_snapshots ADD COLUMN lore_unlocks_json TEXT");
} catch(e) {}

export { db };
