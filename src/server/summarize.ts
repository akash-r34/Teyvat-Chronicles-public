import { db } from './db.ts';
import { GoogleGenAI } from "@google/genai";

export async function summarizeSession(sessionId: string, turnIdx: number) {
  // Get history up to turnIdx
  const history = db.prepare('SELECT narrative, dialogue, user_action FROM history WHERE session_id = ? AND turn_idx <= ? ORDER BY turn_idx ASC').all(sessionId, turnIdx) as any[];
  
  if (history.length === 0) return;

  const textToSummarize = history.map(h => `Player: ${h.user_action}\nNarrator/Character: ${h.narrative} ${h.dialogue}`).join('\n\n');

  const gcpProject = process.env.GOOGLE_CLOUD_PROJECT || process.env.VITE_GOOGLE_CLOUD_PROJECT;
  if (!gcpProject) {
    throw new Error("Missing GOOGLE_CLOUD_PROJECT environment variable");
  }
  const ai = new GoogleGenAI({ vertexai: true, project: gcpProject, location: 'global' });

  try {
      const resp = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Summarize the following events into <=400 tokens, preserving named entities, unresolved threads, and vows.\n\n${textToSummarize}`
      });

      const summary = resp.text || "";
      db.prepare('INSERT OR REPLACE INTO summary (session_id, up_to_turn, text) VALUES (?, ?, ?)')
        .run(sessionId, turnIdx, summary);
  } catch(e) {
      console.warn("Summary failed:", e);
  }
}
