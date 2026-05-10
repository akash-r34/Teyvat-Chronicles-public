import express from "express";
import crypto from 'crypto';
import { db } from '../db.ts';
import { migrateSnapshot } from '../saveMigrations.ts';

export const saveRouter = express.Router();

const SCHEMA_VERSION = 1;

saveRouter.get("/", (req, res) => {
    try {
        const saves = db.prepare(`
            SELECT s.id as saveId, s.slot, s.name, s.turn_idx, s.preview_text, s.preview_image_id, s.created_at, 
                   ss.character_json
            FROM saves s
            JOIN session_snapshots ss ON s.id = ss.save_id
            ORDER BY s.created_at DESC
        `).all() as any[];
        
        const results = saves.map(s => {
            const char = JSON.parse(s.character_json);
            return {
                saveId: s.saveId,
                slot: s.slot,
                name: s.name || `Save Slot ${s.slot}`,
                characterName: char.name,
                chapter: char.chapter,
                turnIdx: s.turn_idx,
                preview: s.preview_text,
                createdAt: s.created_at,
                previewImageId: s.preview_image_id ? `/api/images/${s.preview_image_id}` : null
            };
        });
        res.json(results);
    } catch(e: any) {
        res.status(500).json({ error: e.message });
    }
});

saveRouter.post("/session/:id/save", (req, res) => {
    try {
        const { id } = req.params;
        const { slot, name } = req.body;
        
        // Find max turn
        const lastTurn = db.prepare('SELECT * FROM history WHERE session_id = ? ORDER BY turn_idx DESC LIMIT 1').get(id) as any;
        if (!lastTurn) return res.status(400).json({error: "No history found for session"});
        
        const character = db.prepare('SELECT * FROM character WHERE session_id = ?').get(id);
        const inventory = db.prepare('SELECT * FROM inventory WHERE session_id = ?').all(id);
        const relationships = db.prepare('SELECT * FROM relationships WHERE session_id = ?').all(id);
        const summary = db.prepare('SELECT text FROM summary WHERE session_id = ?').get(id) as any;
        const storyProgress = db.prepare('SELECT * FROM story_progress WHERE session_id = ?').get(id) as any;
        const choiceFlags = db.prepare('SELECT * FROM choice_flags WHERE session_id = ?').all(id);
        const npcState = db.prepare('SELECT * FROM npc_state WHERE session_id = ?').all(id);

        const saveId = crypto.randomUUID();
        const now = Date.now();
        
        db.transaction(() => {
            db.prepare(`INSERT INTO saves (id, session_id, slot, name, turn_idx, preview_text, preview_image_id, created_at, schema_version)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
               .run(saveId, id, slot || 0, name || 'Manual Save', lastTurn.turn_idx, lastTurn.narrative?.substring(0, 50), lastTurn.image_id ? lastTurn.image_id.split('/').pop() : null, now, SCHEMA_VERSION);
               
            db.prepare(`INSERT INTO session_snapshots (save_id, character_json, inventory_json, relationships_json, summary_text, turn_idx, schema_version, story_progress_json, choice_flags_json, npc_state_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
               .run(saveId, JSON.stringify(character), JSON.stringify(inventory), JSON.stringify(relationships), summary?.text || '', lastTurn.turn_idx, SCHEMA_VERSION, JSON.stringify(storyProgress || {}), JSON.stringify(choiceFlags || []), JSON.stringify(npcState || []));
        })();

        res.json({ saveId, slot, turnIdx: lastTurn.turn_idx, createdAt: now });
    } catch(e: any) {
        res.status(500).json({ error: e.message });
    }
});

saveRouter.post("/:saveId/load", (req, res) => {
    try {
        const { saveId } = req.params;
        const saveInfo = db.prepare('SELECT session_id, turn_idx FROM saves WHERE id = ?').get(saveId) as any;
        if (!saveInfo) return res.status(404).json({ error: "Save not found" });

        const snapshot = db.prepare('SELECT * FROM session_snapshots WHERE save_id = ?').get(saveId) as any;
        if (!snapshot) return res.status(404).json({ error: "Snapshot missing" });

        if (snapshot.schema_version < SCHEMA_VERSION) {
            // run migrations
            // snapshot = migrateSnapshot(...)
        }

        const newSessionId = crypto.randomUUID();
        const now = Date.now();
        
        const char = JSON.parse(snapshot.character_json);
        const inv = JSON.parse(snapshot.inventory_json);
        const rels = JSON.parse(snapshot.relationships_json);
        const storyProgress = snapshot.story_progress_json ? JSON.parse(snapshot.story_progress_json) : {};
        const choiceFlags = snapshot.choice_flags_json ? JSON.parse(snapshot.choice_flags_json) : [];
        const npcState = snapshot.npc_state_json ? JSON.parse(snapshot.npc_state_json) : [];

        // Legacy endgame_goal migration
        let migratedSurfaceGoal = char.surface_goal || char.endgame_goal || '';
        if (migratedSurfaceGoal.includes('ultimate truth') || migratedSurfaceGoal.includes('False Sky')) {
            migratedSurfaceGoal = "Survive Teyvat and uncover what brought you here."; // safe fallback
        }

        db.transaction(() => {
            // 1. Create new session
            db.prepare('INSERT INTO sessions (id, created_at, updated_at) VALUES (?, ?, ?)').run(newSessionId, now, now);

            // 2. Insert char
            db.prepare(`
              INSERT INTO character 
              (session_id, name, gender, element, skill, skill_desc, ultimate, ultimate_desc, has_paimon, chapter, hp, max_hp, level, location, surface_goal, regional_goal, hidden_arc_goal, endgame_goal, current_quest, appearance_desc) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              newSessionId, char.name, char.gender, char.element, char.skill, char.skill_desc, char.ultimate, char.ultimate_desc, 
              char.has_paimon, char.chapter, char.hp, char.max_hp, char.level, char.location, migratedSurfaceGoal, char.regional_goal || '', char.hidden_arc_goal || '', char.endgame_goal, char.current_quest, char.appearance_desc
            );

            // 3. Inventory
            const insertInv = db.prepare('INSERT INTO inventory (session_id, item, qty, acquired_turn) VALUES (?, ?, ?, ?)');
            for (const item of inv) {
                insertInv.run(newSessionId, item.item, item.qty, item.acquired_turn);
            }

            // 4. Relationships
            const insertRel = db.prepare('INSERT INTO relationships (session_id, npc, affinity, last_seen_turn, notes) VALUES (?, ?, ?, ?, ?)');
            for (const r of rels) {
                insertRel.run(newSessionId, r.npc, r.affinity, r.last_seen_turn, r.notes);
            }

            // 5. Summary
            if (snapshot.summary_text) {
                db.prepare('INSERT INTO summary (session_id, up_to_turn, text) VALUES (?, ?, ?)').run(newSessionId, snapshot.turn_idx, snapshot.summary_text);
            }

            // 5.5 TellTale features
            if (storyProgress && storyProgress.current_beat_id) {
                db.prepare('INSERT INTO story_progress (session_id, current_beat_id, beat_state, completed_beats) VALUES (?, ?, ?, ?)')
                  .run(newSessionId, storyProgress.current_beat_id, storyProgress.beat_state, storyProgress.completed_beats);
            }
            const insertFlag = db.prepare('INSERT INTO choice_flags (session_id, flag, value, set_at_turn, set_at_beat) VALUES (?, ?, ?, ?, ?)');
            for (const f of choiceFlags) {
                insertFlag.run(newSessionId, f.flag, f.value, f.set_at_turn, f.set_at_beat);
            }
            const insertNpc = db.prepare('INSERT INTO npc_state (session_id, canonical_name, status, last_seen_beat, sprite_image_id, portrait_desc) VALUES (?, ?, ?, ?, ?, ?)');
            for (const n of npcState) {
                insertNpc.run(newSessionId, n.canonical_name, n.status, n.last_seen_beat, n.sprite_image_id, n.portrait_desc);
            }

            // 6. Copy history up to turn_idx
            const insertHist = db.prepare(`
                INSERT INTO history (session_id, turn_idx, speaker, narrative, dialogue, user_action, image_id, bgm_mood, sfx_action, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const oldHistory = db.prepare('SELECT * FROM history WHERE session_id = ? AND turn_idx <= ?').all(saveInfo.session_id, saveInfo.turn_idx) as any[];
            for (const h of oldHistory) {
                insertHist.run(newSessionId, h.turn_idx, h.speaker, h.narrative, h.dialogue, h.user_action, h.image_id, h.bgm_mood, h.sfx_action, h.created_at);
            }
        })();

        // Return the tail 5 history nodes to populate UI
        const tailHistory = db.prepare('SELECT * FROM history WHERE session_id = ? ORDER BY turn_idx DESC LIMIT 5').all(newSessionId).reverse() as any[];
        const mappedTail = tailHistory.map(h => ({
            id: `${newSessionId}-${h.turn_idx}`,
            speaker: h.speaker,
            narrative: h.narrative,
            dialogue: h.dialogue,
            userAction: h.user_action,
            imageUrl: h.image_id,
            bgmMood: h.bgm_mood,
            sfxAction: h.sfx_action,
            choices: [] // Can't fully restore choices easily if they were transient, client can just generate next turn
        }));

        res.json({ sessionId: newSessionId, history: mappedTail });
    } catch(e: any) {
        console.error("Load save error", e);
        res.status(500).json({ error: e.message });
    }
});

saveRouter.delete("/:saveId", (req, res) => {
    try {
        db.prepare('DELETE FROM saves WHERE id = ?').run(req.params.saveId);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});
