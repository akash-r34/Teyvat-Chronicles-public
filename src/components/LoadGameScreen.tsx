import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Trash2, Clock, Trash, BookOpen } from 'lucide-react';
import { playUiSfx } from '../services/uiAudio';
import { ExportMangaButton } from './manga-export/ExportMangaButton';

interface SaveInfo {
    saveId: string;
    slot: number;
    name: string;
    characterName: string;
    chapter: number;
    turnIdx: number;
    preview: string;
    createdAt: number;
    previewImageId: string | null;
}

interface Props {
  onBack: () => void;
  onLoad: (saveId: string) => void;
  onExportSave?: (saveId: string) => void;
  exportMode?: boolean;
}

export default function LoadGameScreen({ onBack, onLoad, onExportSave, exportMode = false }: Props) {
  const [saves, setSaves] = useState<SaveInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/saves')
      .then(res => res.json())
      .then(data => {
          setSaves(data);
          setLoading(false);
      })
      .catch(e => {
          console.error(e);
          setLoading(false);
      });
  }, []);

  const handleDelete = async (e: React.MouseEvent, saveId: string) => {
      e.stopPropagation();
      playUiSfx('click');
      if (confirm('Delete this save?')) {
          await fetch(`/api/saves/${saveId}`, { method: 'DELETE' });
          setSaves(saves.filter(s => s.saveId !== saveId));
      }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-[#0A0C10] p-6 text-white relative overflow-hidden halftone-bg overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="z-10 bg-white border-8 border-black p-6 md:p-10 shadow-[16px_16px_0_0_#000] rotate-[-1deg] text-black w-full max-w-4xl flex flex-col"
      >
        <div className="flex items-center justify-between mb-8 border-b-8 border-black pb-4">
            <button onClick={() => { playUiSfx('click'); onBack(); }} className="flex items-center gap-2 font-manga-text font-bold text-xl uppercase hover:underline">
                <ArrowLeft /> Back
            </button>
            <h1 className="text-3xl md:text-5xl font-manga-sfx tracking-widest uppercase">{exportMode ? "Select Save to Export" : "Select Save"}</h1>
            <div className="w-24"></div> {/* spacer */}
        </div>

        {loading ? (
            <div className="py-20 text-center font-manga-text text-xl">Loading...</div>
        ) : saves.length === 0 ? (
            <div className="py-20 text-center font-manga-text text-xl text-gray-500">No saved games found.</div>
        ) : (
            <div className="flex flex-col gap-6">
                {saves.map(save => (
                    <motion.div 
                        key={save.saveId}
                        whileHover={{ x: 5, y: -5, boxShadow: '8px 8px 0px 0px #FBBF24' }}
                        className="bg-gray-100 border-4 border-black p-4 flex flex-col md:flex-row gap-6 cursor-pointer shadow-[4px_4px_0_0_#000] transition-all group"
                        onClick={() => { playUiSfx('confirm'); onLoad(save.saveId); }}
                    >
                        {save.previewImageId ? (
                            <img src={save.previewImageId} alt="Preview" className="w-full md:w-48 h-32 object-cover border-4 border-black grayscale group-hover:grayscale-0 transition-all" />
                        ) : (
                            <div className="w-full md:w-48 h-32 bg-gray-300 border-4 border-black flex items-center justify-center font-manga-text text-gray-500">No Image</div>
                        )}
                        <div className="flex-1 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start">
                                    <h2 className="text-2xl font-manga-sfx uppercase tracking-widest">{save.name}</h2>
                                    <div className="flex gap-2">
                                        {!exportMode && onExportSave && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); playUiSfx('click'); onExportSave(save.saveId); }}
                                                className="text-blue-600 hover:text-blue-800 p-2"
                                                title="Export PDF"
                                            >
                                                <BookOpen size={24} />
                                            </button>
                                        )}
                                        <button 
                                            onClick={(e) => handleDelete(e, save.saveId)}
                                            className="text-red-600 hover:text-red-800 p-2"
                                            title="Delete Save"
                                        >
                                            <Trash2 size={24} />
                                        </button>
                                    </div>
                                </div>
                                <p className="font-manga-text font-bold text-lg">{save.characterName} — Chapter {save.chapter}</p>
                                <p className="font-manga-text text-gray-600 italic mt-2 line-clamp-2">"{save.preview}..."</p>
                            </div>
                            <div className="flex justify-between items-end mt-4 font-manga-text text-sm text-gray-500 font-bold uppercase tracking-widest">
                                <span>Turn {save.turnIdx}</span>
                                <span className="flex items-center gap-1"><Clock size={14}/> {new Date(save.createdAt).toLocaleString()}</span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        )}
      </motion.div>
    </div>
  );
}
