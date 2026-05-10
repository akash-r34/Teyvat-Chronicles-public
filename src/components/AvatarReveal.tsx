import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Character } from '../types';
import { generateAvatar } from '../services/aiService';
import { playUiSfx } from '../services/uiAudio';
import { X, RefreshCw } from 'lucide-react';

interface Props {
  character: Character;
  onConfirm: (char: Character) => void;
}

export default function AvatarReveal({ character, onConfirm }: Props) {
  const [avatar, setAvatar] = useState<string | null>(character.avatarUrl || null);
  const [loading, setLoading] = useState(!character.avatarUrl);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  useEffect(() => {
    if (!avatar && !errorMsg) {
      generateAvatar(character).then(res => {
        setAvatar(res.avatarUrl);
        if (res.enhancedDescription) {
          character.description = res.enhancedDescription; // Overwrite or append! Let's overwrite since the model generated a highly detailed one.
        }
        setLoading(false);
      }).catch(err => {
        console.error("Failed to generate avatar:", err);
        setErrorMsg(err.message || "Failed to manifest vessel. The stars are clouded.");
        setLoading(false);
      });
    }
  }, [avatar, character, errorMsg]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0C10] p-6 text-black relative z-10 halftone-bg">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-white border-8 border-black p-8 shadow-[12px_12px_0_0_#000] rotate-[-1deg] flex flex-col items-center"
      >
        <h1 className="text-4xl md:text-5xl font-manga-sfx tracking-widest uppercase text-black drop-shadow-[3px_3px_0_#FBBF24] mb-6 text-center">
          Vessel Manifested
        </h1>
        
        {loading ? (
          <div className="w-64 h-[400px] border-4 border-black border-dashed flex items-center justify-center bg-gray-100 flex-col gap-4 shadow-[6px_6px_0_0_#000]">
            <div className="w-12 h-12 border-t-4 border-black rounded-full animate-spin"></div>
            <span className="font-manga-text font-bold animate-pulse text-lg uppercase text-center px-4">
              Weaving elemental fibers...<br/><span className="text-sm">(Generating Art)</span>
            </span>
          </div>
        ) : errorMsg ? (
          <div className="w-64 h-[400px] border-4 border-red-500 border-dashed flex items-center justify-center bg-red-50 flex-col gap-4 shadow-[6px_6px_0_0_#000] p-4 text-center">
             <span className="font-manga-text font-bold text-red-600 text-lg uppercase">
               Manifestation Failed
             </span>
             <p className="font-manga-text text-sm text-black">{errorMsg}</p>
             <button 
               onClick={() => { playUiSfx('click'); setErrorMsg(null); setLoading(true); }}
               onMouseEnter={() => playUiSfx('hover')}
               className="bg-black text-white px-4 py-2 font-manga-sfx uppercase mt-4 hover:scale-105 transition-transform"
             >
               Retry
             </button>
             <button 
               onClick={() => { playUiSfx('click'); onConfirm({ ...character, avatarUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e5/Genshin_Impact_logo.svg" }); }}
               onMouseEnter={() => playUiSfx('hover')}
               className="bg-white border-2 border-black text-black px-4 py-2 font-manga-sfx uppercase hover:bg-gray-200 transition-colors"
             >
               Skip (Use Default)
             </button>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full sm:w-2/3 border-4 border-black p-2 bg-white shadow-[6px_6px_0_0_#000] cursor-pointer hover:bg-yellow-50 overflow-hidden relative group"
            onClick={() => setIsLightboxOpen(true)}
            title="View Full Size"
          >
            {avatar && <img src={avatar} alt="Character Avatar" className="w-full h-auto object-contain group-hover:scale-105 transition-transform duration-300" />}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
               <span className="text-white font-manga-text font-bold tracking-widest uppercase border-2 border-white px-4 py-2">Click to View</span>
            </div>
          </motion.div>
        )}

        {!loading && avatar && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 flex gap-4 w-full justify-center max-w-md"
          >
            <button
              onClick={() => {
                playUiSfx('click');
                setAvatar(null);
                setLoading(true);
              }}
              onMouseEnter={() => playUiSfx('hover')}
              title="Regenerate Avatar"
              className="bg-white border-4 border-black p-4 font-manga-sfx uppercase tracking-widest text-2xl shadow-[6px_6px_0_0_#000] hover:bg-gray-200 hover:translate-y-1 hover:shadow-[2px_2px_0_0_#000] transition-all flex items-center justify-center flex-shrink-0"
            >
              <RefreshCw className="w-8 h-8" />
            </button>
            <button
              onClick={() => { playUiSfx('confirm'); onConfirm({ ...character, avatarUrl: avatar }); }}
              onMouseEnter={() => playUiSfx('hover')}
              className="bg-yellow-400 border-4 border-black px-8 py-4 font-manga-sfx uppercase tracking-widest text-2xl shadow-[6px_6px_0_0_#000] hover:bg-yellow-300 hover:translate-y-1 hover:shadow-[2px_2px_0_0_#000] transition-all flex-1"
            >
              Begin Journey
            </button>
          </motion.div>
        )}
      </motion.div>

      {/* Lightbox */}
      <AnimatePresence>
        {isLightboxOpen && avatar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsLightboxOpen(false)}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          >
            <button 
              className="absolute top-6 right-6 text-white hover:text-yellow-400 z-50 p-2"
              onClick={() => setIsLightboxOpen(false)}
            >
              <X size={40} />
            </button>
            <img 
              src={avatar} 
              alt="Avatar Fullsize" 
              className="max-w-full max-h-[90vh] border-4 border-white object-contain shadow-2xl scale-[1.02] hover:scale-100 transition-transform" 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
