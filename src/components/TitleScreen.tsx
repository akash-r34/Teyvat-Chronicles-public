import React from 'react';
import { motion } from 'motion/react';
import { Play, Settings, RefreshCcw, BookOpen } from 'lucide-react';
import { playUiSfx } from '../services/uiAudio';

interface Props {
  onNewGame: () => void;
  onLoadGame: () => void;
  onOpenSettings: () => void;
  onExportManga?: () => void;
  hasSaveGame: boolean;
}

export default function TitleScreen({ onNewGame, onLoadGame, onOpenSettings, onExportManga, hasSaveGame }: Props) {
  const [isRestoring, setIsRestoring] = React.useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0C10] p-6 text-white relative overflow-hidden halftone-bg">
      {/* Background aesthetics */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
         <img src="https://upload.wikimedia.org/wikipedia/commons/e/e5/Genshin_Impact_logo.svg" className="w-full h-full object-cover grayscale blur-sm mix-blend-overlay" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 bg-white border-8 border-black p-10 shadow-[16px_16px_0_0_#000] rotate-[-1deg] text-black w-full max-w-lg flex flex-col items-center"
      >
        <div className="w-full text-center mb-10 border-b-8 border-black pb-8">
          <p className="font-manga-text font-bold mb-2 uppercase tracking-[0.3em] text-gray-500 text-sm">Visual Novel Edition</p>
          <h1 className="text-5xl md:text-6xl font-manga-sfx tracking-widest uppercase drop-shadow-[4px_4px_0_#FBBF24]">Teyvat<br/>Chronicles</h1>
        </div>

        <div className="w-full flex flex-col gap-4">
          <button 
            onClick={() => { playUiSfx('confirm'); onNewGame(); }}
            onMouseEnter={() => playUiSfx('hover')}
            className="w-full bg-yellow-400 border-4 border-black font-manga-sfx text-2xl py-4 uppercase tracking-widest flex items-center justify-center gap-3 shadow-[6px_6px_0_0_#000] hover:translate-y-1 hover:shadow-[2px_2px_0_0_#000] hover:bg-yellow-300 transition-all group"
          >
            <Play className="group-hover:scale-125 transition-transform" />
            Awaken (New Game)
          </button>

          <div className="flex gap-4">
              <button 
                onClick={() => { playUiSfx('confirm'); onLoadGame(); }}
                onMouseEnter={() => { if(hasSaveGame) playUiSfx('hover'); }}
                disabled={!hasSaveGame}
                className={`flex-1 border-4 border-black font-manga-text font-bold text-xl py-4 uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                  hasSaveGame 
                    ? 'bg-white shadow-[6px_6px_0_0_#000] hover:translate-y-1 hover:shadow-[2px_2px_0_0_#000] hover:bg-gray-100 cursor-pointer' 
                    : 'bg-gray-200 text-gray-400 shadow-none cursor-not-allowed border-dashed'
                }`}
              >
                <RefreshCcw className={hasSaveGame ? "" : "opacity-50"} />
                Load
              </button>
              
              <button 
                onClick={() => { playUiSfx('click'); if(onExportManga) onExportManga(); }}
                onMouseEnter={() => { if(hasSaveGame) playUiSfx('hover'); }}
                disabled={!hasSaveGame || !onExportManga}
                className={`flex-1 border-4 border-black font-manga-text font-bold text-xl py-4 uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                  hasSaveGame 
                    ? 'bg-blue-100 shadow-[6px_6px_0_0_#000] hover:translate-y-1 hover:shadow-[2px_2px_0_0_#000] hover:bg-blue-200 cursor-pointer' 
                    : 'bg-gray-200 text-gray-400 shadow-none cursor-not-allowed border-dashed'
                }`}
                title="Export a saved adventure as a PDF Manga Book"
              >
                <BookOpen className={hasSaveGame ? "text-blue-800" : "opacity-50"} />
                Export
              </button>
          </div>

          <button 
            onClick={() => { playUiSfx('click'); onOpenSettings(); }}
            onMouseEnter={() => playUiSfx('hover')}
            className="w-full bg-white border-4 border-black font-manga-text font-bold text-xl py-4 uppercase tracking-widest flex items-center justify-center gap-3 shadow-[6px_6px_0_0_#000] hover:translate-y-1 hover:shadow-[2px_2px_0_0_#000] hover:bg-gray-100 transition-all mt-4"
          >
            <Settings />
            Settings
          </button>
        </div>

        <div className="w-full flex justify-between mt-8 pt-4 border-t-4 border-black border-dashed flex-col gap-4">
          <div className="flex flex-col items-start gap-1">
            <span className="text-xs text-red-600 font-bold max-w-sm">
              ⚠️ If you are in the AI Studio editor, you MUST click the "Open in new tab" icon (top right of preview window) first.
            </span>
            <a
              href="/download_db.html"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-manga-text font-bold text-blue-600 underline hover:text-blue-800 underline-offset-4"
            >
              ⬇️ Step 1: Download DB Backup (Split method, 100% works)
            </a>
          </div>
          
          <label className={`text-sm font-manga-text font-bold text-blue-600 underline hover:text-blue-800 cursor-pointer underline-offset-4 mt-4 ${isRestoring ? 'opacity-50 pointer-events-none' : ''}`}>
            {isRestoring ? '⏳ Restoring DB (Please wait up to 30s)...' : '⬆️ Step 2: Restore DB (Upload .db or .zip)'}
            <input 
              type="file" 
              className="hidden" 
              accept=".db,.zip"
              disabled={isRestoring}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!confirm("Warning: Restoring will overwrite the current database. Proceed?")) return;
                
                setIsRestoring(true);
                
                const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
                const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
                let uploadSuccess = false;
                
                try {
                  for (let i = 0; i < totalChunks; i++) {
                    const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                    const formData = new FormData();
                    formData.append('chunk', chunk);
                    formData.append('index', i.toString());
                    formData.append('total', totalChunks.toString());
                    formData.append('filename', file.name);

                    const res = await fetch('/api/db/upload-chunk', {
                      method: 'POST',
                      body: formData,
                    });
                    
                    if (!res.ok) {
                      throw new Error(`HTTP error! status: ${res.status}`);
                    }
                    
                    const data = await res.json();
                    if (data.error) {
                      throw new Error(data.error);
                    }
                    if (data.done) {
                      uploadSuccess = true;
                      alert(data.message + " The page will now reload.");
                    }
                  }
                  
                  if (uploadSuccess) {
                    window.location.reload();
                  }
                } catch(err: any) {
                  alert('Upload error: ' + err.message);
                  setIsRestoring(false);
                }
              }}
            />
          </label>
        </div>
      </motion.div>
    </div>
  );
}
