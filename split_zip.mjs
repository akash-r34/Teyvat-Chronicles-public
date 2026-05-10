import fs from 'fs';
import path from 'path';

const inputFile = './public/teyvat_backup.zip';
const outputDir = './public/parts';

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const buffer = fs.readFileSync(inputFile);
const chunkSize = 15 * 1024 * 1024; // 15MB
const numChunks = Math.ceil(buffer.length / chunkSize);

console.log(`Splitting into ${numChunks} chunks...`);

for (let i = 0; i < numChunks; i++) {
  const start = i * chunkSize;
  const end = Math.min(start + chunkSize, buffer.length);
  const chunk = buffer.slice(start, end);
  fs.writeFileSync(path.join(outputDir, `part_${i}.bin`), chunk);
}

console.log('Done splitting!');

// Create an HTML file to assemble them
const html = `<!DOCTYPE html>
<html>
<head><title>Download DB Backup</title></head>
<body style="font-family: sans-serif; padding: 2rem;">
  <h2>DB Backup Downloader</h2>
  <button id="dlBtn" style="padding: 1rem 2rem; font-size: 1.2rem; cursor: pointer;">Start Download</button>
  <p id="status"></p>
  
  <script>
    const numChunks = ${numChunks};
    const btn = document.getElementById('dlBtn');
    const status = document.getElementById('status');
    
    btn.onclick = async () => {
      try {
        btn.disabled = true;
        let chunks = [];
        for (let i = 0; i < numChunks; i++) {
          status.innerText = 'Downloading part ' + (i + 1) + ' of ' + numChunks + '...';
          const res = await fetch('/parts/part_' + i + '.bin');
          if (!res.ok) throw new Error('Failed to fetch part ' + i);
          const buf = await res.arrayBuffer();
          chunks.push(buf);
        }
        status.innerText = 'Assembling file...';
        const blob = new Blob(chunks, { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'teyvat_backup.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        status.innerText = 'Download complete! You can close this page.';
      } catch (err) {
        console.error(err);
        status.innerText = 'Error: ' + err.message;
      } finally {
        btn.disabled = false;
      }
    };
  </script>
</body>
</html>`;

fs.writeFileSync('./public/download_db.html', html);
console.log('Created downloader at /download_db.html');
