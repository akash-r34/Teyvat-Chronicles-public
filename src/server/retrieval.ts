import { db } from './db.ts';
import { getEmbeddings } from './embeddings.ts';

export async function retrieveContext(sessionId: string, query: string) {
  // 1. FTS5 exact matches
  const ftsSearch = db.prepare(`
    SELECT rowid, text, topic FROM lore_fts 
    WHERE lore_fts MATCH ? 
    ORDER BY rank LIMIT 10
  `);
  
  const ftsHits = ftsSearch.all(`"${query.replace(/"/g, '""')}"`) as any[];
  
  // 2. Vector search
  const [queryEmb] = await getEmbeddings([query]);
  const vecHits = [];
  if (queryEmb.some(v => v !== 0)) {
    const queryEmbFloat32 = new Float32Array(queryEmb);
    const vecSearch = db.prepare(`
      SELECT l.topic, l.text, vec_distance_cosine(v.embedding, ?) as distance
      FROM lore_vec v
      JOIN lore l ON l.id = v.id
      WHERE l.session_id = ?
      ORDER BY distance ASC
      LIMIT 10
    `);
    vecHits.push(...(vecSearch.all(Buffer.from(queryEmbFloat32.buffer), sessionId) as any[]));
  }

  // Very naive score fusion: deduplicate and keep top 5
  const merged = new Map<string, string>();
  for (const hit of ftsHits) {
    if (merged.size >= 5) break;
    merged.set(hit.text, hit.topic);
  }
  for (const hit of vecHits) {
    if (merged.size >= 5) break;
    if (!merged.has(hit.text)) {
      merged.set(hit.text, hit.topic);
    }
  }

  let retrievedLore = "";
  merged.forEach((topic, text) => {
    retrievedLore += `- [${topic}]: ${text.substring(0, 300)}\n`;
  });

  return retrievedLore;
}
