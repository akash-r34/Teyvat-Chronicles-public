import fs from 'fs';
import path from 'path';

const name = process.argv[2];
if (!name) {
  console.error("Usage: npx tsx scripts/canon_new_region.ts <name>");
  process.exit(1);
}

const canonDir = path.join(process.cwd(), 'data', 'canon');
const files = fs.readdirSync(canonDir).filter(f => f.match(/^\d{2}_.*\.json$/));
let nextIdx = 0;
if (files.length > 0) {
  const indices = files.map(f => parseInt(f.split('_')[0], 10));
  nextIdx = Math.max(...indices) + 1;
}

const prefix = nextIdx.toString().padStart(2, '0');
const filename = `${prefix}_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.json`;

const template = {
  region: name,
  archon_quest_chapter: "",
  archon_quest_acts: [],
  version: "x.x",
  last_reviewed: new Date().toISOString().split('T')[0],
  summary_for_director: "",
  emotional_register_default: "",
  named_npcs_introduced: [],
  lore_unlocks_region_grants: {
    named: [],
    hint_only: []
  },
  beats: [],
  branch_notes: ""
};

fs.writeFileSync(path.join(canonDir, filename), JSON.stringify(template, null, 2));
console.log(`Created ${filename}`);
