import fs from 'fs';
import path from 'path';

const canonDir = path.join(process.cwd(), 'data/canon');
const files = fs.readdirSync(canonDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));

for (const file of files) {
  const p = path.join(canonDir, file);
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  
  // Try to determine the region from the filename or contents
  let defaultRegion = 'Mondstadt';
  if (file.includes('liyue')) defaultRegion = 'Liyue';
  else if (file.includes('inazuma')) defaultRegion = 'Inazuma';
  else if (file.includes('sumeru')) defaultRegion = 'Sumeru';
  else if (file.includes('fontaine')) defaultRegion = 'Fontaine';
  else if (file.includes('natlan')) defaultRegion = 'Natlan';
  else if (file.includes('snezhnaya')) defaultRegion = 'Snezhnaya';
  else if (file.includes('interlude')) defaultRegion = 'Interlude';

  if (data.beats) {
    for (const beat of data.beats) {
      if (!beat.main_goal) {
        if (beat.exit_when && beat.exit_when.length > 0) {
          beat.main_goal = beat.exit_when[0];
        } else {
          beat.main_goal = "Progress the story.";
        }
      }
      
      if (!beat.main_goal_keywords) {
        if (beat.exit_keywords && beat.exit_keywords.length > 0) {
          beat.main_goal_keywords = beat.exit_keywords;
        } else if (beat.exit_when && beat.exit_when.length > 0) {
          beat.main_goal_keywords = beat.exit_when.map((ew) => ew.toLowerCase());
        } else {
          beat.main_goal_keywords = ["progress the story"];
        }
      }
      
      beat.region = beat.region || defaultRegion;
      
      delete beat.unlocks_named;
      delete beat.unlocks_hint;
      delete beat.forbidden;
      delete beat.exit_when;
      delete beat.exit_keywords;
    }
  }
  
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}
console.log("Canon JSON files updated.");
