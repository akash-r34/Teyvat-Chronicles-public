import Database from 'better-sqlite3';
import fs from 'fs';
const db = new Database('./data/teyvat.db');
db.backup('./backup_test.db').then(() => {
  console.log("Size:", fs.statSync('./backup_test.db').size);
}).catch(console.error);
