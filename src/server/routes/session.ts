import express from "express";
import crypto from 'crypto';
import { db } from '../db.ts';
import { getFirstBeatId, getFirstRegionSummary, getBeat } from '../canon.ts';

export const sessionRouter = express.Router();

sessionRouter.post("/", (req, res) => {
    try {
        const { character } = req.body;
        const sessionId = crypto.randomUUID();
        const now = Date.now();
        
        db.prepare('INSERT INTO sessions (id, unlocked_regions, created_at, updated_at) VALUES (?, ?, ?, ?)')
          .run(sessionId, '["Mondstadt"]', now, now);
          
        const surfaceGoal = character.surfaceGoal || "Survive Teyvat and uncover what brought you here.";
        const firstBeatId = getFirstBeatId() || '';
        const regionalGoal = getFirstRegionSummary() || '';
        
        const startingBeat = firstBeatId ? getBeat(firstBeatId) : null;
        const initialLocation = startingBeat?.location ?? 'Starfell Valley Beach';

        db.prepare(`
          INSERT INTO character 
          (session_id, name, gender, element, skill, skill_desc, ultimate, ultimate_desc, has_paimon, chapter, hp, max_hp, level, location, surface_goal, current_quest, appearance_desc, regional_goal) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          sessionId, 
          character.name, 
          character.gender, 
          character.element, 
          character.skill, 
          character.skillDesc || '', 
          character.ultimate, 
          character.ultimateDesc || '', 
          character.hasPaimon ? 1 : 0, 
          1, 
          100, 
          100, 
          1, 
          initialLocation, 
          surfaceGoal, 
          '',
          character.description || '',
          regionalGoal
        );

        if (character.inventory && Array.isArray(character.inventory)) {
            const insertInv = db.prepare('INSERT INTO inventory (session_id, item, qty, acquired_turn) VALUES (?, ?, ?, ?)');
            for (const item of character.inventory) {
                insertInv.run(sessionId, item, 1, 0);
            }
        }
        
        db.prepare(`INSERT INTO story_progress (session_id, current_beat_id, beat_state, completed_beats) VALUES (?, ?, '{}', '[]')`).run(sessionId, firstBeatId);

        res.json({ sessionId });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

sessionRouter.get("/:id/character", (req, res) => {
    const { id } = req.params;
    const char = db.prepare('SELECT * FROM character WHERE session_id = ?').get(id) as any;
    if (!char) return res.status(404).json({ error: 'Session not found' });
    
    // Check if an avatar exists
    const avatar = db.prepare(`SELECT id FROM images WHERE session_id = ? AND kind = 'avatar' ORDER BY created_at DESC LIMIT 1`).get(id) as any;
    
    const inventoryList = db.prepare('SELECT item FROM inventory WHERE session_id = ?').all(id) as any[];
    const relationships = db.prepare('SELECT npc, affinity FROM relationships WHERE session_id = ?').all(id) as any[];

    // Map snake to camel
    res.json({
        name: char.name,
        gender: char.gender,
        description: char.appearance_desc || "",
        element: char.element,
        skill: char.skill,
        skillDesc: char.skill_desc,
        ultimate: char.ultimate,
        ultimateDesc: char.ultimate_desc,
        hasPaimon: char.has_paimon === 1,
        chapter: char.chapter,
        hp: char.hp,
        maxHp: char.max_hp,
        level: char.level,
        location: char.location,
        surfaceGoal: char.surface_goal,
        regionalGoal: char.regional_goal,
        hiddenArcGoal: char.hidden_arc_goal,
        endgameGoal: char.endgame_goal,
        currentQuest: char.current_quest,
        inventory: inventoryList.map(i => i.item),
        relationships: relationships.map(r => ({npc: r.npc, affinity: r.affinity})),
        avatarUrl: avatar ? `/api/images/${avatar.id}` : undefined
    });
});
