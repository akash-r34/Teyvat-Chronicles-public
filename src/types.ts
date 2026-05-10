/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ElementType = 'Anemo' | 'Geo' | 'Electro' | 'Dendro' | 'Hydro' | 'Pyro' | 'Cryo';

export interface Character {
  name: string;
  gender: string;
  description?: string;
  element: ElementType;
  skill: string;
  skillDesc?: string;
  ultimate: string;
  ultimateDesc?: string;
  hasPaimon: boolean;
  avatarUrl?: string; // Should now refer to /api/images/:id after creation
  chapter: number;
  hp: number;
  maxHp: number;
  level: number;
  location: string;
  inventory: string[];
  relationships?: { npc: string, affinity: number }[];
  surfaceGoal: string;
  regionalGoal: string;
  hiddenArcGoal: string;
  endgameGoal?: string; // deprecated
  currentQuest: string;
}

export interface Choice {
  text: string;
  tone?: 'kind' | 'pragmatic' | 'aggressive' | 'curious' | 'neutral';
  timed?: number;
}

export interface StoryNode {
  id: string;
  narrative: string;
  speaker: string;
  dialogue: string;
  choices: Choice[] | string[];
  imageUrl?: string;
  userAction?: string;
  itemGained?: string;
  itemsRemoved?: string[];
  questUpdated?: string;
  hpChange?: number;
  endgameGoal?: string;
  newChapter?: number;
  bgmMood?: string;
  sfxAction?: string;
  relationshipDelta?: { npc: string, affinityChange: number, note: string }[];
  locationChange?: string;
  mainGoalComplete?: boolean;
  sideGoalsThisTurn?: { label: string; kind: 'completed' | 'ongoing' }[];
  sideGoalsLog?: { label: string; kind: 'completed' | 'ongoing'; created_at: number }[];
  mainGoal?: string;
  flagsSet?: { key: string; value: string; note: string }[];
}

export interface Message {
  role: 'user' | 'model' | 'system';
  parts: { text: string }[];
}

export interface GameState {
  character: Character | null;
  history: StoryNode[];
  status: 'creation' | 'playing' | 'loading';
  lastActionResult?: string;
}
