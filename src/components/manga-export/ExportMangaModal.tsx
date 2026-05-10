import React, { useState } from 'react';
import { BookOpen, X, Download, Loader2 } from 'lucide-react';
import { Character, StoryNode } from '../../types';
import { exportMangaPdf } from '../../lib/mangaExport';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  character: Character;
  history: StoryNode[];
  saveName: string;
}

export const ExportMangaModal: React.FC<Props> = ({ isOpen, onClose, character, history, saveName }) => {
  const [title, setTitle] = useState(saveName || 'My Teyvat Journey');
  const [includeCover, setIncludeCover] = useState(true);
  const [includeTOC, setIncludeTOC] = useState(true);
  const [includeRoster, setIncludeRoster] = useState(true);
  const [includeEpilogue, setIncludeEpilogue] = useState(true);
  const [quality, setQuality] = useState(2);
  const [status, setStatus] = useState<'idle' | 'exporting' | 'done'>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  if (!isOpen) return null;

  const handleExport = async () => {
    setStatus('exporting');
    try {
      await exportMangaPdf({
        history,
        character,
        saveName: title,
        options: {
           title,
           includeCover,
           includeTOC,
           includeRoster,
           includeEpilogue,
           qualityMultiplier: quality
        },
        onProgress: setProgress
      });
      setStatus('done');
      setTimeout(() => {
         onClose();
         setStatus('idle');
      }, 2000);
    } catch (e: any) {
      console.error(e);
      alert('Error exporting Manga PDF. See console.');
      setStatus('idle');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-70 font-manga-text">
        <div className="bg-white border-4 border-black p-8 shadow-[12px_12px_0_0_#000] rotate-[-1deg] w-full max-w-xl relative text-black">
            <button onClick={status !== 'exporting' ? onClose : undefined} className="absolute top-4 right-4 bg-white border-2 border-black p-2 hover:bg-gray-200 transition-colors cursor-pointer z-10 disabled:opacity-50" disabled={status === 'exporting'}>
                 <X size={24} />
            </button>
            <h2 className="text-3xl font-manga-dialogue font-black uppercase mb-6 border-b-4 border-black pb-4 text-black flex items-center gap-3">
                 <BookOpen size={32} /> Export Manga Book
            </h2>

            {status === 'idle' && (
                <div className="space-y-6">
                    <div>
                        <label className="block font-black uppercase text-sm mb-2 text-black">Book Title</label>
                        <input type="text" className="w-full bg-white text-black border-2 border-black p-3 font-manga-text text-lg shadow-[4px_4px_0_0_#000] focus:outline-none" value={title} onChange={e => setTitle(e.target.value)} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-black">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={includeCover} onChange={e => setIncludeCover(e.target.checked)} className="w-5 h-5 accent-black" />
                            <span className="font-bold">Cover Page</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={includeTOC} onChange={e => setIncludeTOC(e.target.checked)} className="w-5 h-5 accent-black" />
                            <span className="font-bold">Table of Contents</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={includeRoster} onChange={e => setIncludeRoster(e.target.checked)} className="w-5 h-5 accent-black" />
                            <span className="font-bold">Character Roster</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={includeEpilogue} onChange={e => setIncludeEpilogue(e.target.checked)} className="w-5 h-5 accent-black" />
                            <span className="font-bold">Epilogue Stats</span>
                        </label>
                    </div>

                    <div>
                        <label className="block font-black uppercase text-sm mb-2 text-black">Quality (Higher = Slower, Bigger File)</label>
                        <select className="w-full bg-white text-black border-2 border-black p-3 font-bold shadow-[4px_4px_0_0_#000] cursor-pointer outline-none" value={quality} onChange={e => setQuality(Number(e.target.value))}>
                            <option value={1.5}>Fast Draft (1.5x) - Mobile friendly</option>
                            <option value={2}>Standard (2x) - Recommended</option>
                            <option value={3}>High Quality (3x)</option>
                        </select>
                    </div>

                    <button 
                        onClick={handleExport}
                        className="w-full bg-black text-white py-4 font-black text-xl uppercase mt-8 hover:bg-gray-800 transition-colors shadow-[6px_6px_0_0_#ccc] active:translate-y-1 active:translate-x-1 active:shadow-none flex justify-center items-center gap-3 cursor-pointer"
                    >
                        <Download size={24} /> Generate PDF
                    </button>
                    
                    <p className="text-gray-500 text-sm mt-4 text-center px-4 font-sans font-medium">Please note generation can take up to a minute depending on adventure length. Ensure images are loading correctly before export.</p>
                </div>
            )}

            {status === 'exporting' && (
                <div className="py-16 flex flex-col items-center text-center space-y-6 text-black">
                    <Loader2 size={64} className="animate-spin text-black mb-4 mx-auto" />
                    <h3 className="text-2xl font-black font-manga-dialogue uppercase">Generating PDF...</h3>
                    <div className="w-full bg-gray-200 border-2 border-black h-8 relative shadow-[4px_4px_0_0_#000] overflow-hidden">
                        <div className="absolute top-0 left-0 h-full bg-black transition-all duration-300" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}></div>
                    </div>
                    <p className="font-bold font-manga-text text-xl">Rendering page {progress.done} of {progress.total}</p>
                    <p className="text-red-600 font-bold mt-4 animate-pulse uppercase">Do not close window or tab!</p>
                </div>
            )}

            {status === 'done' && (
                <div className="py-16 text-center space-y-6">
                    <div className="w-24 h-24 bg-green-500 rounded-full mx-auto border-4 border-black text-black shadow-[6px_6px_0_0_#000] flex items-center justify-center">
                        <Download size={48} />
                    </div>
                    <h3 className="text-3xl font-black font-manga-dialogue uppercase">Success!</h3>
                    <p className="text-xl font-bold">Your Manga book is downloading.</p>
                </div>
            )}
        </div>
    </div>
  );
};
