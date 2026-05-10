import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import crypto from 'crypto';
import { db } from './db.ts';
import { retrieveContext } from './retrieval.ts';
import { harvestNouns } from './nounHarvester.ts';
import { summarizeSession } from './summarize.ts';

import { getBeat, getNextBeat, getFirstBeatId, regionOfLocation } from './canon.ts';

export const aiRouter = express.Router();

function getAi() {
  const gcpProject = process.env.GOOGLE_CLOUD_PROJECT || process.env.VITE_GOOGLE_CLOUD_PROJECT;
  if (!gcpProject) {
    throw new Error("Missing GOOGLE_CLOUD_PROJECT environment variable");
  }
  return new GoogleGenAI({ 
    vertexai: true, project: gcpProject, location: 'global'
  });
}

function getGeminiAi() {
  const apiKey = (process.env.MY_GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("Missing MY_GEMINI_API_KEY environment variable");
  }
  return new GoogleGenAI({ apiKey });
}

const SYSTEM_INSTRUCTION = `You are the storyteller for an isekai Genshin Impact narrative game.

1. PLAYER AGENCY IS PRIMARY. The player can do anything reasonable in-world: chat with NPCs, shop, eavesdrop, refuse the plot, take detours. Roll with it. Reflect their choices in narrative; never push back with "the world resists" or block mundane actions.
2. NARRATIVE PROGRESSION: You'll receive a CURRENT BEAT block with the CURRENT OBJECTIVE (MAIN GOAL). You set mainGoalComplete=true ONLY when the player has accomplished this exact objective in your narrative turn.
3. SIDE GOALS are emergent. Anything the player does that isn't the main goal — record in sideGoalsThisTurn (kind=completed or ongoing). Be generous; this is the player's personal log.
4. REGION TRAVEL LOCK. The player may only travel within UNLOCKED REGIONS (you'll receive the list each turn). Never set locationChange to a location that belongs to a locked region. If the player asks to go there, narrate an in-world reason it's not possible right now (no boat, the road is closed, etc.).
5. RELATIONSHIP TRACKING (Telltale-style). Every turn, output relationshipDelta as an array. Empty [] if no NPC opinion shifted. Otherwise one entry per NPC: { npc, affinityChange (-3..+3), note (≤8 words) }. The UI renders "X will remember that" toasts.
6. Stay lore-accurate to Genshin Impact canon.
9. SOUND DIRECTION: Pick bgmMood per the scene's mood (peaceful/market for towns, heroic for triumphs, mystery for unknowns, dungeon for caves/ruins, battle for combat, boss for archon-tier fights). Pick sfxAction only when an *event* happens this turn (a sword draws, a spell casts, a hit lands). Silence (sfxAction='none') is fine — don't spam.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    narrative: { type: Type.STRING, description: "The narrator's description of the scene, action, or character movements." },
    speaker: { type: Type.STRING, description: "Name of the character speaking. Empty string if no dialogue." },
    dialogue: { type: Type.STRING, description: "The exact words spoken by the character (empty if no dialogue)." },
    imagePrompt: { type: Type.STRING, description: "A detailed visual description for the manga panel. Must recreate character looks." },
    choices: { 
      type: Type.ARRAY, 
      items: { 
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          tone: { type: Type.STRING, description: "One of: kind, pragmatic, aggressive, curious, neutral" },
          timed: { type: Type.INTEGER, description: "Only set if this is a high-stress QTE (in seconds, like 5). Omit otherwise." }
        }
      }, 
      description: "2 to 4 actionable choices for the player." 
    },
    itemGained: { type: Type.STRING, description: "Item added to inventory. ONLY unique distinct items. Leave empty if none." },
    itemsRemoved: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Items to delete from inventory (used, duplicate, combined). Empty if none." },
    questUpdated: { type: Type.STRING, description: "Updated current quest objective. Keep it concise. Leave empty string if unchanged." },
    hpChange: { type: Type.INTEGER, description: "Amound of HP to add (e.g. 25) or subtract (e.g. -15). 0 if none." },
    bgmMood: { type: Type.STRING, description: "One of: peaceful, market, heroic, mystery, dungeon, battle, boss." },
    sfxAction: { type: Type.STRING, description: "One of: none, sword_swing, sword_unsheathe, magic_cast, impact_hit, explosion, page_turn, dramatic_sting." },
    regionalGoal: { type: Type.STRING, description: "(Only for prologue) The regional goal." },
    newChapter: { type: Type.INTEGER, description: "Increment the chapter number ONLY if a major regional storyline is fully resolved. Otherwise omit." },
    locationChange: { type: Type.STRING, description: "Set if the player moves to a noticeably different named location this turn. Otherwise omit." },
    mainGoalComplete: { type: Type.BOOLEAN, description: "True ONLY if the player just accomplished the current MAIN GOAL this turn. Otherwise false." },
    sideGoalsThisTurn: {
      type: Type.ARRAY,
      description: "Anything noteworthy the player just did that ISN'T the main goal — short freeform labels. Empty array if nothing of note. Examples: 'Helped a merchant find their cat', 'Eavesdropped on guards', 'Bought a sweet flower'.",
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          kind: { type: Type.STRING, description: "'completed' if a discrete side activity finished this turn, 'ongoing' if started but not yet done." }
        }
      }
    },
    flagsSet: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING },
          value: { type: Type.STRING },
          note: { type: Type.STRING }
        }
      },
      description: "Any permanent narrative choices or flags set in this turn (e.g. 'sided_with': 'Mages')."
    },
    relationshipDelta: {
       type: Type.ARRAY,
       maxItems: 5,
       items: {
          type: Type.OBJECT,
          properties: {
             npc: { type: Type.STRING },
             affinityChange: { type: Type.INTEGER },
             note: { type: Type.STRING }
          }
       },
       description: "Telltale-style relationship deltas. MUST be an array. Empty array [] if no NPC was meaningfully interacted with this turn. Include one entry per NPC whose opinion of the player shifted (positive or negative) due to a choice, dialogue line, or action this turn."
    }
  },
  required: ["narrative", "speaker", "dialogue", "imagePrompt", "choices", "mainGoalComplete", "sideGoalsThisTurn", "relationshipDelta"]
};

// Returns an ID to the images table
async function generateMangaImageInternal(sessionId: string | null, imagePrompt: string): Promise<string> {
  const ai = getAi();
  const prompt = `Black and white manga style, official Genshin Impact manga art style, highly detailed and accurate anime illustration, screentones, dramatic lighting. Strictly adhere to Genshin Impact character designs, environments. ${imagePrompt}`;
  
  let bytes = null;
  let mime = 'image/jpeg';
  
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt,
      config: { numberOfImages: 1, outputMimeType: "image/jpeg", aspectRatio: "16:9" }
    });
    if (response.generatedImages?.[0]?.image?.imageBytes) {
      bytes = Buffer.from(response.generatedImages[0].image.imageBytes, 'base64');
      mime = response.generatedImages[0].image.mimeType || 'image/jpeg';
    }
  } catch (err) {
    try {
      const fbResponse = await ai.models.generateImages({
        model: 'imagen-3.0-fast-generate-001',
        prompt,
        config: { numberOfImages: 1, outputMimeType: "image/jpeg", aspectRatio: "16:9" }
      });
      if (fbResponse.generatedImages?.[0]?.image?.imageBytes) {
        bytes = Buffer.from(fbResponse.generatedImages[0].image.imageBytes, 'base64');
        mime = fbResponse.generatedImages[0].image.mimeType || 'image/jpeg';
      }
    } catch(e) {}
  }

  const id = crypto.randomUUID();
  if (bytes) {
      db.prepare('INSERT INTO images (id, session_id, kind, mime, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, sessionId, 'panel', mime, bytes, Date.now());
      return `/api/images/${id}`;
  }
  return `https://picsum.photos/seed/${encodeURIComponent(imagePrompt)}/1024/576?grayscale&blur=2`;
}

aiRouter.post("/generateAvatar", async (req, res) => {
  try {
    const ai = getAi();
    const { character } = req.body;
    const prompt = `Official Genshin Impact character concept art, full body portrait, character design sheet. ${character.gender}, ${character.description || 'standard adventurer outfit'}, element: ${character.element}. White background, highly detailed, masterpieces, 8k resolution, anime style.`;
    
    let bytes = null;
    let mime = 'image/jpeg';
    try {
      const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt,
        config: { numberOfImages: 1, outputMimeType: "image/jpeg", aspectRatio: "1:1" }
      });
      if (response.generatedImages?.[0]?.image?.imageBytes) {
        bytes = Buffer.from(response.generatedImages[0].image.imageBytes, 'base64');
        mime = response.generatedImages[0].image.mimeType || 'image/jpeg';
      }
    } catch(err) {
      try {
        const fbResponse = await ai.models.generateImages({
          model: 'imagen-3.0-fast-generate-001',
          prompt,
          config: { numberOfImages: 1, outputMimeType: "image/jpeg", aspectRatio: "1:1" }
        });
        if (fbResponse.generatedImages?.[0]?.image?.imageBytes) {
            bytes = Buffer.from(fbResponse.generatedImages[0].image.imageBytes, 'base64');
            mime = fbResponse.generatedImages[0].image.mimeType || 'image/jpeg';
        }
      } catch (e) {}
    }
    
    let enhancedDescription = '';
    if (bytes) {
        try {
            const descRes = await ai.models.generateContent({
                model: "gemini-3-flash-preview", // Or equivalent multimodal model
                contents: [{
                    role: 'user',
                    parts: [
                        { text: "Analyze this generated character avatar and provide a highly detailed, distinct physical description focusing on clothing, style, precise colors, pose, and aesthetic to maintain highly consistent representations in future image generations. Keep it concise but dense with visual keywords." },
                        { inlineData: { data: bytes.toString('base64'), mimeType: mime } }
                    ]
                }]
            });
            enhancedDescription = descRes.text || '';
        } catch (e) {
            console.error("Failed to generate expanded vision description:", e);
        }
        
        const id = crypto.randomUUID();
        db.prepare('INSERT INTO images (id, session_id, kind, mime, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(id, null, 'avatar', mime, bytes, Date.now());
        res.json({ avatarUrl: `/api/images/${id}`, enhancedDescription });
    } else {
        res.json({ avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(character.name || "Traveler")}&backgroundColor=b6e3f4` });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function aiCallWithTimeoutAndRetry(ai: any, params: any) {
    const timeoutMs = 30000;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const result = await Promise.race([
                ai.models.generateContent(params),
                new Promise((_, reject) => setTimeout(() => reject(new Error('TimeoutError')), timeoutMs))
            ]) as any;
            
            // Check parsing specifically
            if (params.config?.responseMimeType === 'application/json') {
                const text = result.text || "{}";
                JSON.parse(text); // validation throw if broken
            }
            return result;
        } catch (e: any) {
            console.error(`[generateContent] Attempt ${attempt} failed:`, e?.message);
            if (attempt === 2) throw e;
            // modify for second attempt if it's a parse error
            if (e instanceof Error && (e.name === 'SyntaxError' || e.message.includes('JSON'))) {
                params.config.temperature = Math.max(0, (params.config.temperature || 0.7) - 0.2);
                const currentText = params.contents[0].parts[0].text;
                params.contents[0].parts[0].text = currentText + `\n\nCRITICAL: RESPOND ONLY WITH VALID JSON MATCHING THE SCHEMA. NO PROSE OUTSIDE THE JSON OBJECT.`;
            }
        }
    }
}
function applyTurnDeltas(sessionId: string, parsed: any, turnIdx: number) {
    db.transaction(() => {
        if (parsed.hpChange !== undefined && parsed.hpChange !== 0) {
            db.prepare('UPDATE character SET hp = MIN(max_hp, MAX(0, hp + ?)) WHERE session_id = ?').run(parsed.hpChange, sessionId);
        }
        if (parsed.itemGained) {
            db.prepare('INSERT INTO inventory (session_id, item, qty, acquired_turn) VALUES (?, ?, 1, ?)').run(sessionId, parsed.itemGained, turnIdx);
        }
        if (parsed.itemsRemoved && Array.isArray(parsed.itemsRemoved)) {
            for (const item of parsed.itemsRemoved) {
                // Approximate match for removal to be safe against slight naming differences
                db.prepare('DELETE FROM inventory WHERE session_id = ? AND item LIKE ?').run(sessionId, `%${item}%`);
            }
        }
        if (parsed.questUpdated) {
            db.prepare('UPDATE character SET current_quest = ? WHERE session_id = ?').run(parsed.questUpdated, sessionId);
        }
        if (parsed.regionalGoal) {
            db.prepare('UPDATE character SET regional_goal = ? WHERE session_id = ?').run(parsed.regionalGoal, sessionId);
        }
        if (parsed.newChapter) {
            db.prepare('UPDATE character SET chapter = ? WHERE session_id = ?').run(parsed.newChapter, sessionId);
        }
        let currentBeatIdRow = db.prepare('SELECT current_beat_id, completed_beats FROM story_progress WHERE session_id = ?').get(sessionId) as {current_beat_id: string, completed_beats: string} | undefined;
        let beatId = currentBeatIdRow?.current_beat_id;
        const beat = beatId ? getBeat(beatId) : null;

        if (parsed.locationChange) {
            const session = db.prepare('SELECT unlocked_regions FROM sessions WHERE id = ?').get(sessionId) as any;
            const unlocked: string[] = JSON.parse(session?.unlocked_regions ?? '["Mondstadt"]');
            const region = regionOfLocation(parsed.locationChange);

            if (region && !unlocked.includes(region)) {
                console.warn(`[Region Lock] Refusing locationChange="${parsed.locationChange}" — region "${region}" is locked. Unlocked: ${unlocked.join(", ")}.`);
            } else {
                db.prepare('UPDATE character SET location = ? WHERE session_id = ?').run(parsed.locationChange, sessionId);
            }
        }
        if (parsed.relationshipDelta && Array.isArray(parsed.relationshipDelta)) {
            for (const d of parsed.relationshipDelta) {
                const existing = db.prepare('SELECT affinity FROM relationships WHERE session_id = ? AND npc = ?').get(sessionId, d.npc) as any;
                if (existing) {
                    db.prepare('UPDATE relationships SET affinity = affinity + ?, last_seen_turn = ?, notes = ? WHERE session_id = ? AND npc = ?')
                      .run(d.affinityChange, turnIdx, d.note, sessionId, d.npc);
                } else {
                    db.prepare('INSERT INTO relationships (session_id, npc, affinity, last_seen_turn, notes) VALUES (?, ?, ?, ?, ?)')
                      .run(sessionId, d.npc, d.affinityChange, turnIdx, d.note);
                }
            }
        }
        
        if (parsed.mainGoalComplete && beatId && beat) {
            let row = db.prepare('SELECT beat_state FROM story_progress WHERE session_id = ?').get(sessionId) as any;
            let state = row?.beat_state ? JSON.parse(row.beat_state) : { completedMustHappen: [] };
            if (!state.completedMustHappen) state.completedMustHappen = [];
            const pendingEvents = beat.must_happen.filter((mh: string) => !state.completedMustHappen?.includes(mh));
            
            if (pendingEvents.length > 0) {
                // Completed the current MUST HAPPEN event
                const completedMh = pendingEvents[0];
                state.completedMustHappen.push(completedMh);
                db.prepare('UPDATE story_progress SET beat_state = ? WHERE session_id = ?').run(JSON.stringify(state), sessionId);
            } else {
                // Completed the EXIT CONDITION / MAIN GOAL
                const nextBeat = getNextBeat(beatId);
                const completed = currentBeatIdRow?.completed_beats ? JSON.parse(currentBeatIdRow.completed_beats) : [];
                if (!completed.includes(beatId)) completed.push(beatId);

                if (nextBeat && nextBeat.region && nextBeat.region !== beat.region) {
                    const session = db.prepare('SELECT unlocked_regions FROM sessions WHERE id = ?').get(sessionId) as any;
                    const unlocked = JSON.parse(session?.unlocked_regions ?? '["Mondstadt"]');
                    if (!unlocked.includes(nextBeat.region)) {
                        unlocked.push(nextBeat.region);
                        db.prepare('UPDATE sessions SET unlocked_regions = ? WHERE id = ?').run(JSON.stringify(unlocked), sessionId);
                    }
                }

                db.prepare('UPDATE story_progress SET current_beat_id = ?, completed_beats = ?, beat_state = ? WHERE session_id = ?')
                  .run(nextBeat ? nextBeat.id : '__END__', JSON.stringify(completed), '{"completedMustHappen":[]}', sessionId);
            }
        }

        if (Array.isArray(parsed.sideGoalsThisTurn)) {
            for (const sg of parsed.sideGoalsThisTurn) {
                if (!sg?.label) continue;
                db.prepare('INSERT INTO side_goals (session_id, beat_id, turn_idx, label, kind, created_at) VALUES (?, ?, ?, ?, ?, ?)')
                  .run(sessionId, beatId ?? null, turnIdx, sg.label, sg.kind ?? 'completed', Date.now());
            }
        }

        if (parsed.flagsSet && Array.isArray(parsed.flagsSet)) {
            for (const f of parsed.flagsSet) {
                db.prepare('INSERT OR REPLACE INTO choice_flags (session_id, flag, value, set_at_turn, set_at_beat) VALUES (?, ?, ?, ?, ?)')
                  .run(sessionId, f.key, f.value, turnIdx, beatId || null);
            }
        }
    })();
}

function buildTurnPrompt(sessionId: string, userAction: string, characterInfo: any) {
   let prompt = "";

   let currentBeatIdRow = db.prepare('SELECT current_beat_id, beat_state FROM story_progress WHERE session_id = ?').get(sessionId) as {current_beat_id: string | null, beat_state: string | null} | undefined;
   let beat = null;
   if (currentBeatIdRow?.current_beat_id === '__END__') {
       prompt += `--- CANON COMPLETE ---\nThe player has finished the main storyline of this test region! Let them freely explore the world, talk to NPCs, and pursue their own goals. Do not set mainGoalComplete to true anymore.\n----------------------\n\n`;
   } else {
       beat = currentBeatIdRow?.current_beat_id ? getBeat(currentBeatIdRow.current_beat_id) : null;
       if (!beat) {
           beat = getBeat(getFirstBeatId() || "");
           if (beat) {
               console.warn(`[buildTurnPrompt] story_progress missing for ${sessionId}, seeding with first beat ${beat.id}`);
               db.prepare('INSERT OR IGNORE INTO story_progress (session_id, current_beat_id, completed_beats) VALUES (?, ?, ?)')
                 .run(sessionId, beat.id, "[]");
           }
       }
   }
   
   if (beat) {
       let beatState = currentBeatIdRow?.beat_state ? JSON.parse(currentBeatIdRow.beat_state) : { completedMustHappen: [] };
       if (!beatState.completedMustHappen) beatState.completedMustHappen = [];
       const pendingEvents = beat.must_happen.filter((mh: string) => !beatState.completedMustHappen?.includes(mh));
       const currentObjective = pendingEvents.length > 0 ? pendingEvents[0] : beat.main_goal;

       prompt += `--- CURRENT BEAT ---
Beat: ${beat.title}
Region: ${beat.region}
Suggested Location: ${beat.location}
Required NPCs (try to feature): ${beat.required_npcs.join(", ")}

CURRENT OBJECTIVE (MAIN GOAL):
${currentObjective}

Conceptual hooks you may use:
${(Array.isArray(beat.canon_dialogue_hooks) ? beat.canon_dialogue_hooks : []).map((h: string) => "- " + h).join("\n")}

The player is free to do other things — small talk, exploration, mundane choices, helping NPCs. Roll with it. Track those as sideGoalsThisTurn. Set mainGoalComplete=true ONLY when the player has actually achieved the MAIN GOAL above.
--------------------\n\n`;
   }

   prompt += `CHARACTER STATE:
Name: ${characterInfo.name} | Element: ${characterInfo.element} | Skill: ${characterInfo.skill}
Appearance: ${characterInfo.appearance_desc || "Standard adventurer outfit"}
Companion: ${characterInfo.has_paimon === 1 ? "Traveling with Paimon" : "Lone Wolf (No Companion)"}
HP: ${characterInfo.hp}/${characterInfo.max_hp} | Location: ${characterInfo.location} | Chapter: ${characterInfo.chapter}
Quest: ${characterInfo.current_quest}
Player Surface Goal: ${characterInfo.surface_goal}
Current Regional Goal: ${characterInfo.regional_goal || '(unset — let the region introduce one)'}\n`;

   const session = db.prepare('SELECT unlocked_regions FROM sessions WHERE id = ?').get(sessionId) as any;
   const unlocked = JSON.parse(session?.unlocked_regions ?? '["Mondstadt"]');
   prompt += `\nUNLOCKED REGIONS: ${unlocked.join(", ")}\n(The player cannot physically travel to any other region yet.)\n`;

   const inventory = db.prepare('SELECT item FROM inventory WHERE session_id = ?').all(sessionId) as {item: string}[];
   if (inventory.length > 0) prompt += `Inventory: ${inventory.map(i => i.item).join(", ")}\n`;
   
   const rels = db.prepare('SELECT npc, affinity, notes FROM relationships WHERE session_id = ? ORDER BY last_seen_turn DESC').all(sessionId) as any[];
   if (rels.length > 0) prompt += `Relationships: ${rels.map(r => `${r.npc}(${r.affinity}): ${r.notes}`).join(" | ")}\n`;

   const summary = db.prepare('SELECT text FROM summary WHERE session_id = ?').get(sessionId) as {text:string};
   if (summary) prompt += `\nSTORY SUMMARY SO FAR:\n${summary.text}\n`;

   const flags = db.prepare('SELECT flag, value FROM choice_flags WHERE session_id = ?').all(sessionId) as {flag:string, value:string}[];
   if (flags.length > 0) prompt += `\nPAST PLAYER CHOICES (Flags):\n${flags.map(f => `${f.flag}: ${f.value}`).join("\n")}\n`;

   const history = db.prepare('SELECT narrative, dialogue, user_action FROM history WHERE session_id = ? ORDER BY turn_idx DESC LIMIT 3').all(sessionId).reverse() as any[];
   if (history.length > 0) {
       prompt += `\nLAST 3 TURNS:\n`;
       for (const h of history) {
           prompt += `Player: ${h.user_action}\nNarrator/Character: ${h.narrative} ${h.dialogue}\n\n`;
       }
   }

   return prompt;
}

aiRouter.post("/getInitialNode", async (req, res) => {
  try {
    const ai = getAi();
    const { sessionId, userAction = "Awakened in Teyvat" } = req.body;
    
    if (!sessionId) return res.status(400).json({error: "sessionId required"});
    const characterInfo = db.prepare('SELECT * FROM character WHERE session_id = ?').get(sessionId) as any;
    if (!characterInfo) return res.status(404).json({error: "Character not found"});

    const promptText = buildTurnPrompt(sessionId, userAction, characterInfo) + 
      "\nPROLOGUE INSTRUCTION: Write a dramatic prologue waking up. Set the 'questUpdated' to a fitting objective. End the prologue with an immediate threat or intense mystery facing the player.";

    const parts = [{ text: promptText }];

    let parsed: any;
    try {
      const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const configVars = {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          maxOutputTokens: 4096,
          temperature: 0.7,
      };
      
      const response = await aiCallWithTimeoutAndRetry(ai, {
        model: modelName,
        contents: [{ role: 'user', parts }],
        config: configVars
      });
      parsed = JSON.parse(response.text || "{}");

    } catch (e: any) {
      console.error("[getInitialNode] Parse or timeout error:", {
          name: e?.name, message: e?.message,
          stack: e?.stack?.split('\n').slice(0, 5).join('\n'),
      });
      parsed = {
          narrative: "You awaken in a strange, shifting dimension. Something went wrong...",
          speaker: "",
          dialogue: "Temporal distortion detected. (Prologue Generation Failed)",
          choices: ["Try to focus and wake up fully"],
          imagePrompt: "A blurry, glitching dimension in Teyvat. Abstract.",
          bgmMood: "normal",
          sfxAction: "none",
          __debug: e?.message || String(e)
      };
    }
    const imageUrl = await generateMangaImageInternal(sessionId, parsed.imagePrompt || parsed.narrative);

    // Turn index 0
    const turnIdx = 0;
    
    db.prepare('INSERT INTO history (session_id, turn_idx, speaker, narrative, dialogue, user_action, image_id, bgm_mood, sfx_action, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(sessionId, turnIdx, parsed.speaker || '', parsed.narrative || '', parsed.dialogue || '', userAction, imageUrl, parsed.bgmMood || 'normal', parsed.sfxAction || 'none', Date.now());

    applyTurnDeltas(sessionId, parsed, turnIdx);
    
    // Background noun harvesting
    harvestNouns((parsed.narrative || "") + " " + (parsed.dialogue || ""), sessionId).catch(e => console.error("Harvest error", e));

    const currentBeatRow = db.prepare('SELECT current_beat_id, beat_state FROM story_progress WHERE session_id = ?').get(sessionId) as {current_beat_id: string, beat_state: string} | undefined;
    let mainGoalToReturn = null;
    if (currentBeatRow) {
        const beatObj = getBeat(currentBeatRow.current_beat_id);
        if (beatObj) {
            const beatState = currentBeatRow.beat_state ? JSON.parse(currentBeatRow.beat_state) : { completedMustHappen: [] };
            if (!beatState.completedMustHappen) beatState.completedMustHappen = [];
            const pendingEvents = beatObj.must_happen.filter((mh: string) => !beatState.completedMustHappen.includes(mh));
            mainGoalToReturn = pendingEvents.length > 0 ? pendingEvents[0] : beatObj.main_goal;
        }
    }
    
    const sideGoalsLog = db.prepare('SELECT label, kind, created_at FROM side_goals WHERE session_id = ? ORDER BY id DESC LIMIT 20').all(sessionId);

    res.json({
      id: `${sessionId}-${turnIdx}`,
      narrative: parsed.narrative,
      speaker: parsed.speaker || "",
      dialogue: parsed.dialogue || "",
      choices: parsed.choices || ["Who's there!?", "Stay silent and manifest elements."],
      imageUrl,
      userAction,
      bgmMood: parsed.bgmMood || 'normal',
      sfxAction: parsed.sfxAction || 'none',
      relationshipDelta: parsed.relationshipDelta,
      flagsSet: parsed.flagsSet,
      mainGoal: mainGoalToReturn,
      sideGoalsThisTurn: parsed.sideGoalsThisTurn,
      sideGoalsLog
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

aiRouter.post("/generateStoryTurn", async (req, res) => {
  try {
    const ai = getAi();
    const { sessionId, userAction } = req.body;
    
    if (!sessionId) return res.status(400).json({error: "sessionId required"});
    const characterInfo = db.prepare('SELECT * FROM character WHERE session_id = ?').get(sessionId) as any;
    if (!characterInfo) return res.status(404).json({error: "Character not found"});

    let prompt = buildTurnPrompt(sessionId, userAction, characterInfo);
    
    // Noun Entities -> Entity Lore section
    const recentHistory = db.prepare('SELECT narrative, dialogue FROM history WHERE session_id = ? ORDER BY turn_idx DESC LIMIT 1').get(sessionId) as any;
    const toHarvest = userAction + " " + (recentHistory?.narrative || "") + " " + (recentHistory?.dialogue || "");
    const entityLoreRaw = await harvestNouns(toHarvest, sessionId);
    
    const entityLore = entityLoreRaw.slice(0, 5);
    
    if (entityLore.length > 0) {
        prompt += `\nENTITY LORE (Context for exact visual and thematic accuracy):\n` + entityLore.join('\n') + '\n';
    }

    // Hybrid FTS + Vec retrieval
    const retrievedLoreChunks = await retrieveContext(sessionId, userAction + " " + (recentHistory?.narrative || ""));
    if (retrievedLoreChunks) {
        prompt += `\nRETRIEVED LORE & VISUALS:\n` + retrievedLoreChunks + '\n';
    }

    if (prompt.length > 12000) {
      console.warn(`[Prompt Size] WARNING: Prompt length is ${prompt.length} chars (approx ${Math.round(prompt.length/3)} tokens). Bloat risk.`);
    }

    prompt += `\nREMEMBER: The CURRENT BEAT block above is contractual. Drive the scene toward MAIN GOAL this turn. Set mainGoalComplete=true ONLY when the player accomplishes it.\n`;
    prompt += `CURRENT ACTION: "${userAction}"\nGENERATE NEXT SCENE.`;
    
    const parts = [{ text: prompt }];

    let parsed: any;
    try {
      const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const configVars = {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          maxOutputTokens: 4096,
          temperature: 0.7,
      };

      const response = await aiCallWithTimeoutAndRetry(ai, {
        model: modelName,
        contents: [{ role: 'user', parts }],
        config: configVars
      });
      parsed = JSON.parse(response.text || "{}");

    } catch (e: any) {
      console.error("[generateStoryTurn] Parse or timeout error:", {
          name: e?.name, message: e?.message,
          stack: e?.stack?.split('\n').slice(0, 5).join('\n'),
      });
      const isTimeout = e?.message?.includes('Timeout');
      parsed = {
          narrative: "Space and time seem to distort. You can't quite grasp what just happened.",
          speaker: "System",
          dialogue: isTimeout ? "The wind has gone still. Try again." : "Your action echoed strangely. Rephrase or pick a choice.",
          choices: isTimeout ? ["Try the same action again"] : ["Take a different path"],
          imagePrompt: "Temporal distortion in Teyvat, reality glitching.",
          bgmMood: "normal",
          sfxAction: "none",
          __debug: e?.message || String(e)
      };
    }
    const imageUrl = await generateMangaImageInternal(sessionId, parsed.imagePrompt || parsed.narrative);

    // Get current max turn
    const maxTurnRow = db.prepare('SELECT MAX(turn_idx) as maxTurn FROM history WHERE session_id = ?').get(sessionId) as {maxTurn: number};
    const nextTurn = (maxTurnRow?.maxTurn ?? -1) + 1;

    db.prepare('INSERT INTO history (session_id, turn_idx, speaker, narrative, dialogue, user_action, image_id, bgm_mood, sfx_action, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(sessionId, nextTurn, parsed.speaker || '', parsed.narrative || '', parsed.dialogue || '', userAction, imageUrl, parsed.bgmMood || 'normal', parsed.sfxAction || 'none', Date.now());

    applyTurnDeltas(sessionId, parsed, nextTurn);
    
    // Schedule rolling summary async
    if (nextTurn > 0 && nextTurn % 5 === 0) {
        summarizeSession(sessionId, nextTurn).catch(e => console.error("Summarize error", e));
    }
    
    // Autosave roughly every 3 turns
    if (nextTurn > 0 && nextTurn % 3 === 0) {
        // Will be picked up by save route logic or we can trigger it. Since we just have the DB, we can insert an autosave record directly if we build the helper.
        // Doing minimal for now.
    }
    
    // Post-turn harvest
    harvestNouns((parsed.narrative || "") + " " + (parsed.dialogue || ""), sessionId).catch(e => console.error("Harvest error", e));

    const currentBeatRowAfter = db.prepare('SELECT current_beat_id, beat_state FROM story_progress WHERE session_id = ?').get(sessionId) as {current_beat_id: string, beat_state: string} | undefined;
    let mainGoalToReturn = null;
    if (currentBeatRowAfter) {
        const beatObjAfter = getBeat(currentBeatRowAfter.current_beat_id);
        if (beatObjAfter) {
            const beatStateAfter = currentBeatRowAfter.beat_state ? JSON.parse(currentBeatRowAfter.beat_state) : { completedMustHappen: [] };
            if (!beatStateAfter.completedMustHappen) beatStateAfter.completedMustHappen = [];
            const pendingEventsAfter = beatObjAfter.must_happen.filter((mh: string) => !beatStateAfter.completedMustHappen.includes(mh));
            mainGoalToReturn = pendingEventsAfter.length > 0 ? pendingEventsAfter[0] : beatObjAfter.main_goal;
        }
    }
    
    const sideGoalsLog = db.prepare('SELECT label, kind, created_at FROM side_goals WHERE session_id = ? ORDER BY id DESC LIMIT 20').all(sessionId);

    res.json({
      id: `${sessionId}-${nextTurn}`,
      mainGoalComplete: parsed.mainGoalComplete === true,
      narrative: parsed.narrative || "The scene goes dark...",
      speaker: parsed.speaker || "",
      dialogue: parsed.dialogue || "",
      choices: parsed.choices || ["Look around", "Proceed cautiously"],
      imageUrl,
      userAction,
      bgmMood: parsed.bgmMood || 'normal',
      sfxAction: parsed.sfxAction || 'none',
      relationshipDelta: parsed.relationshipDelta,
      flagsSet: parsed.flagsSet,
      mainGoal: mainGoalToReturn,
      sideGoalsThisTurn: parsed.sideGoalsThisTurn,
      sideGoalsLog
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

aiRouter.post("/rollback", async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({error: "sessionId required"});
    
    // We can confidently rollback the last history entry if it exists and turn > 0
    const maxTurnRow = db.prepare('SELECT MAX(turn_idx) as maxTurn FROM history WHERE session_id = ?').get(sessionId) as {maxTurn: number};
    if (maxTurnRow && maxTurnRow.maxTurn > 0) {
      db.prepare('DELETE FROM history WHERE session_id = ? AND turn_idx = ?').run(sessionId, maxTurnRow.maxTurn);
      // NOTE: For a real TellTale game, we'd delete flags set at this turn_idx too
      db.prepare('DELETE FROM choice_flags WHERE session_id = ? AND set_at_turn = ?').run(sessionId, maxTurnRow.maxTurn);
      res.json({ success: true, rolledBackTurn: maxTurnRow.maxTurn });
    } else {
      res.status(400).json({error: "Cannot rollback further."});
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
