import fs from 'fs';
import path from 'path';

// A simple script to list status of canon files and check required fields.
const canonDir = path.join(process.cwd(), 'data', 'canon');
const files = fs.readdirSync(canonDir).filter(f => f.match(/^\d{2}_.*\.json$/));

let hasErrors = false;

for (const file of files) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(canonDir, file), 'utf8'));
    if (!data.region || !data.version || !data.last_reviewed || !data.beats) {
      console.error(`[FAIL] ${file} is missing required root fields.`);
      hasErrors = true;
    }
  } catch (e: any) {
    console.error(`[FAIL] ${file} failed to parse: ${e.message}`);
    hasErrors = true;
  }
}

if (!hasErrors) {
  console.log("Canon audit passed.");
} else {
  process.exit(1);
}
