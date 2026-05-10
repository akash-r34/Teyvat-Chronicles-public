import express from 'express';
import { db } from '../db.ts';
import path from 'path';
import fs from 'fs';
import os from 'os';
import multer from 'multer';
import AdmZip from 'adm-zip';

export const dbAdminRouter = express.Router();

const upload = multer({ dest: os.tmpdir() });

dbAdminRouter.get('/download', async (req, res) => {
  try {
    const backupPath = path.join(os.tmpdir(), `teyvat_backup_${Date.now()}.db`);
    await db.backup(backupPath);
    
    res.download(backupPath, 'teyvat_backup.db', (err) => {
      // Cleanup after sending
      try {
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
        }
      } catch(e) {}
    });
  } catch (err: any) {
    console.error('Backup failed:', err);
    res.status(500).json({ error: err.message });
  }
});

dbAdminRouter.post('/upload-chunk', upload.single('chunk'), async (req, res) => {
  try {
    const { index, total, filename } = req.body;
    const chunkFile = req.file;

    if (!chunkFile) {
      return res.status(400).json({ error: 'No chunk file uploaded' });
    }

    const chunksDir = path.join(os.tmpdir(), 'db_chunks');
    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir, { recursive: true });
    }

    const targetFile = path.join(chunksDir, `${filename}.chunk.${index}`);
    fs.renameSync(chunkFile.path, targetFile);

    // Check if we have all chunks
    const uploadedChunks = fs.readdirSync(chunksDir).filter(f => f.startsWith(`${filename}.chunk.`));
    if (uploadedChunks.length === parseInt(total)) {
      // Assemble the file
      const finalFilePath = path.join(os.tmpdir(), filename);
      const writeStream = fs.createWriteStream(finalFilePath);

      for (let i = 0; i < parseInt(total); i++) {
        const chunkPath = path.join(chunksDir, `${filename}.chunk.${i}`);
        const chunkData = fs.readFileSync(chunkPath);
        writeStream.write(chunkData);
        fs.unlinkSync(chunkPath); // delete chunk
      }

      writeStream.end();

      writeStream.on('finish', () => {
        // Process final file
        const dataDir = path.join(process.cwd(), 'data');
        const targetDbPath = path.join(dataDir, 'teyvat.db');
        const originalName = filename.toLowerCase();

        try {
          db.close();
        } catch (e) {
          console.error('Error closing DB:', e);
        }

        try {
          if (fs.existsSync(targetDbPath + '-wal')) fs.unlinkSync(targetDbPath + '-wal');
          if (fs.existsSync(targetDbPath + '-shm')) fs.unlinkSync(targetDbPath + '-shm');
        } catch (e) {}

        if (originalName.endsWith('.zip')) {
          const zip = new AdmZip(finalFilePath);
          const zipEntries = zip.getEntries();
          let foundDb = false;
          for (const entry of zipEntries) {
            if (entry.entryName.endsWith('teyvat.db')) {
              foundDb = true;
              zip.extractEntryTo(entry, dataDir, false, true);
            }
          }
          if (!foundDb) {
             return res.status(400).json({ error: 'Zip file did not contain a teyvat.db file.' });
          }
        } else {
          fs.copyFileSync(finalFilePath, targetDbPath);
        }

        fs.unlinkSync(finalFilePath);

        res.json({ success: true, message: 'Database assembled and uploaded successfully. The server will now restart.', done: true });

        setTimeout(() => {
          process.exit(1);
        }, 1000);
      });
      
      writeStream.on('error', (err) => {
        console.error("Assembly error", err);
        res.status(500).json({ error: "File assembly failed" });
      });

    } else {
      res.json({ success: true, message: `Chunk ${index} received` });
    }
  } catch (err: any) {
    console.error('Chunk upload failed:', err);
    res.status(500).json({ error: err.message });
  }
});

dbAdminRouter.post('/upload', upload.single('db'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const uploadedPath = req.file.path;
    const originalName = req.file.originalname.toLowerCase();
    const dataDir = path.join(process.cwd(), 'data');
    const targetDbPath = path.join(dataDir, 'teyvat.db');
    
    // Close existing connection
    try {
      db.close();
    } catch (e) {
      console.error('Error closing DB:', e);
    }
    
    // Delete -wal and -shm
    const deleteWalShm = () => {
      try {
        if (fs.existsSync(targetDbPath + '-wal')) fs.unlinkSync(targetDbPath + '-wal');
        if (fs.existsSync(targetDbPath + '-shm')) fs.unlinkSync(targetDbPath + '-shm');
      } catch (e) {}
    };
    
    deleteWalShm();

    if (originalName.endsWith('.zip')) {
      // Extract ZIP
      const zip = new AdmZip(uploadedPath);
      const zipEntries = zip.getEntries();
      
      let foundDb = false;
      for (const entry of zipEntries) {
        if (entry.entryName.endsWith('teyvat.db')) {
          foundDb = true;
          zip.extractEntryTo(entry, dataDir, false, true);
        }
      }
      
      if (!foundDb) {
        return res.status(400).json({ error: 'Zip file did not contain a teyvat.db file.' });
      }
    } else {
      // Plain DB
      fs.copyFileSync(uploadedPath, targetDbPath);
    }

    fs.unlinkSync(uploadedPath);
    
    res.json({ success: true, message: 'Database uploaded successfully. The server will now restart.' });
    
    // Trigger server restart
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  } catch (err: any) {
    console.error('Upload failed:', err);
    res.status(500).json({ error: err.message });
  }
});
