import { db } from './db.ts';
import { getEmbeddings } from './embeddings.ts';
import crypto from 'crypto';
import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';

// Load seed data on init
function initSeed() {
  const seedPath = path.join(process.cwd(), 'data', 'genshin_seed.json');
  if (fs.existsSync(seedPath)) {
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    const stmtEntity = db.prepare('INSERT OR IGNORE INTO lore_entities (noun, canonical, category, summary, full_text, source_urls, embedding_id, fetched_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const stmtAlias = db.prepare('INSERT OR IGNORE INTO lore_entity_aliases (alias, canonical) VALUES (?, ?)');
    
    db.transaction(() => {
      for (const item of seedData) {
        stmtEntity.run(item.noun, item.canonical, item.category, '', '', '', '', Date.now(), Date.now());
        stmtAlias.run(item.noun, item.canonical);
        if (item.aliases) {
          for (const alias of item.aliases) {
            stmtAlias.run(alias, item.canonical);
          }
        }
      }
    })();
  }
}
initSeed();

export function extractNouns(text: string): string[] {
  const matches = text.match(/\\b[A-Z][a-zA-Z]*(?:\\s+[A-Z][a-zA-Z]*)*\\b/g) || [];
  return Array.from(new Set(matches.map(m => m.toLowerCase())));
}

async function fetchNounGoogle(noun: string, canonical: string) {
  const apiKey = (process.env.MY_GEMINI_API_KEY || "").trim();
  if (!apiKey) throw new Error("Missing MY_GEMINI_API_KEY for Google Search");
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are a Genshin Impact Lore researcher. Find the canonical lore for "${canonical}". Summarize it in <=300 tokens. Focus on visual description, history, and relations.`;
  
  try {
    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const result = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    
    let summary = result.text || "";
    return summary;
  } catch (err) {
    console.warn(`Noun harvest for ${canonical} failed:`, err);
    return "";
  }
}

export async function harvestNouns(text: string, sessionId: string) {
  let extracted = extractNouns(text);
  
  // Exclude player name if known
  const charRow = db.prepare('SELECT name FROM character WHERE session_id = ?').get(sessionId) as {name: string};
  if (charRow?.name) {
    extracted = extracted.filter(n => n !== charRow.name.toLowerCase());
  }

  // Resolve aliases
  const getAlias = db.prepare('SELECT canonical FROM lore_entity_aliases WHERE alias = ?');
  
  const hits: string[] = [];
  const misses: string[] = [];
  const resolved = new Set<string>();

  for (const noun of extracted) {
    if (noun.length < 3) continue; // skip very short
    const aliasRec = getAlias.get(noun) as {canonical: string};
    if (aliasRec) {
      hits.push(aliasRec.canonical);
      resolved.add(aliasRec.canonical);
    } else {
      misses.push(noun);
    }
  }

  // Update last_used for hits
  if (hits.length > 0) {
    const updateTime = db.prepare(`UPDATE lore_entities SET last_used_at = ? WHERE canonical = ?`);
    db.transaction(() => {
      for (const hit of hits) {
        updateTime.run(Date.now(), hit);
      }
    })();
  }

  // Handle misses (up to 3 hot path)
  const hotMisses = misses.slice(0, 3);
  // ignoring remaining for now, or could queue...

  for (const noun of hotMisses) {
    // capital case it for fetch
    const canonical = noun.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    // Check if already in entities (maybe just wasn't in alias?)
    const exist = db.prepare('SELECT canonical FROM lore_entities WHERE canonical = ?').get(canonical) as any;
    if (exist) {
      db.prepare('INSERT OR IGNORE INTO lore_entity_aliases (alias, canonical) VALUES (?,?)').run(noun, exist.canonical);
      db.prepare(`UPDATE lore_entities SET last_used_at = ? WHERE canonical = ?`).run(Date.now(), exist.canonical);
      resolved.add(exist.canonical);
      continue;
    }

    const summary = await fetchNounGoogle(noun, canonical);
    if (!summary) continue;

    const embeddingId = crypto.randomUUID();
    const [emb] = await getEmbeddings([canonical + " " + summary]);

    db.transaction(() => {
      db.prepare('INSERT INTO lore_entities (noun, canonical, summary, full_text, embedding_id, fetched_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(noun, canonical, summary, summary, embeddingId, Date.now(), Date.now());
      db.prepare('INSERT INTO lore_entity_aliases (alias, canonical) VALUES (?, ?)')
        .run(noun, canonical);
      
      const embFloat32 = new Float32Array(emb);
      db.prepare('INSERT INTO lore_vec (id, embedding) VALUES (?, ?)').run(embeddingId, Buffer.from(embFloat32.buffer));
    })();
    resolved.add(canonical);
  }

  // Return full contexts for resolved entities
  const getEntity = db.prepare('SELECT canonical, summary FROM lore_entities WHERE canonical = ?');
  const results = [];
  for (const can of resolved) {
    const r = getEntity.get(can) as {canonical: string, summary: string};
    if (r && r.summary) {
      results.push(`${r.canonical}: ${r.summary}`);
    }
  }

  return results;
}
