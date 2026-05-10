import fs from 'fs';
import path from 'path';

export interface Beat {
  id: string;
  title: string;
  required_npcs: string[];
  location: string;
  must_happen: string[];
  canon_dialogue_hooks: string[];
  player_freedom: string[];
  emotional_register: string;
  location_flexible?: boolean;
  sets_flags_optional?: string[];
  main_goal: string;
  main_goal_keywords: string[];
  region: string;
}

export interface RegionAct {
  region: string;
  act: string;
  summary_for_director?: string;
  beats: Beat[];
}

let canonActs: RegionAct[] = [];

const locationToRegion = new Map<string, string>();

function loadCanon() {
  const canonDir = path.join(process.cwd(), 'data', 'canon');
  if (!fs.existsSync(canonDir)) return;
  const files = fs.readdirSync(canonDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  files.sort(); // fs.readdir is not always sorted.
  for (const file of files) {
    try {
      const p = path.join(canonDir, file);
      const json = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (Array.isArray(json.beats) && json.beats.length > 0) {
        canonActs.push(json);
        for (const beat of json.beats) {
          if (beat.location && beat.region) {
            locationToRegion.set(beat.location.toLowerCase(), beat.region);
          }
        }
      }
    } catch(e) {
      console.error("Failed to load canon act", file, e);
    }
  }
}

loadCanon();

export function regionOfLocation(loc: string): string | null {
  return locationToRegion.get(loc.toLowerCase()) || null;
}

export function getBeat(beatId: string): Beat | null {
  for (const act of canonActs) {
    const beat = act.beats.find(b => b.id === beatId);
    if (beat) return beat;
  }
  return null;
}

export function getNextBeat(beatId: string | null): Beat | null {
  if (!beatId) {
    return canonActs.length > 0 && canonActs[0].beats.length > 0 ? canonActs[0].beats[0] : null;
  }
  
  for (let i = 0; i < canonActs.length; i++) {
    const act = canonActs[i];
    const beatIndex = act.beats.findIndex(b => b.id === beatId);
    if (beatIndex !== -1) {
      if (beatIndex + 1 < act.beats.length) {
        return act.beats[beatIndex + 1];
      } else if (i + 1 < canonActs.length) {
        return canonActs[i+1].beats[0];
      }
      return null;
    }
  }
  return null;
}

export function getFirstBeatId(): string | null {
  return canonActs.length > 0 && canonActs[0].beats.length > 0 ? canonActs[0].beats[0].id : null;
}

export function getFirstRegionSummary(): string | null {
  return canonActs.length > 0 ? canonActs[0].summary_for_director || null : null;
}
