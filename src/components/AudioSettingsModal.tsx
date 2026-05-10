import React from 'react';
import { motion } from 'motion/react';
import { Volume2, VolumeX, X, Mic2, MicOff } from 'lucide-react';
import { playUiSfx } from '../services/uiAudio';
import { VoicePrefs, stopSpeaking } from '../services/voice';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  musicVol: number;
  setMusicVol: (v: number) => void;
  sfxVol: number;
  setSfxVol: (v: number) => void;
  voicePrefs: VoicePrefs;
  setVoicePrefs: (v: VoicePrefs) => void;
}

export default function AudioSettingsModal({ isOpen, onClose, musicVol, setMusicVol, sfxVol, setSfxVol, voicePrefs, setVoicePrefs }: Props) {
  if (!isOpen) return null;

  const toggleVoice = () => {
      playUiSfx('click');
      if (voicePrefs.enabled) stopSpeaking();
      setVoicePrefs({ ...voicePrefs, enabled: !voicePrefs.enabled });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="w-full max-w-sm bg-white border-8 border-black shadow-[12px_12px_0_0_#FFF] p-6 relative font-manga-text text-black rotate-[-1deg] max-h-[90vh] overflow-y-auto"
      >
        <button 
          onClick={() => { playUiSfx('click'); onClose(); }}
          onMouseEnter={() => playUiSfx('hover')}
          className="absolute top-2 right-2 p-2 hover:bg-yellow-200 border-2 border-transparent hover:border-black transition"
        >
          <X size={24} />
        </button>

        <h2 className="text-3xl font-manga-sfx uppercase tracking-widest text-center border-b-4 border-black pb-4 mb-6">
          Audio Settings
        </h2>

        <div className="space-y-8">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="font-bold text-xl uppercase tracking-widest flex items-center gap-2">
                {musicVol > 0 ? <Volume2 size={24} /> : <VolumeX size={24} />}
                Music Volume
              </label>
              <span className="font-bold">{Math.round(musicVol * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0" max="1" step="0.05"
              value={musicVol}
              onChange={(e) => setMusicVol(parseFloat(e.target.value))}
              onMouseUp={() => playUiSfx('click')}
              onTouchEnd={() => playUiSfx('click')}
              className="w-full accent-black h-3 bg-gray-200 rounded-none border-2 border-black"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="font-bold text-xl uppercase tracking-widest flex items-center gap-2">
                {sfxVol > 0 ? <Volume2 size={24} /> : <VolumeX size={24} />}
                SFX & UI
              </label>
              <span className="font-bold">{Math.round(sfxVol * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0" max="1" step="0.05"
              value={sfxVol}
              onChange={(e) => setSfxVol(parseFloat(e.target.value))}
              onMouseUp={() => playUiSfx('click')}
              onTouchEnd={() => playUiSfx('click')}
              className="w-full accent-black h-3 bg-gray-200 rounded-none border-2 border-black"
            />
          </div>

          <div className="border-t-4 border-black pt-6">
            <div className="flex justify-between items-center mb-4">
              <label className="font-bold text-xl uppercase tracking-widest flex items-center gap-2">
                {voicePrefs.enabled ? <Mic2 size={24} /> : <MicOff size={24} />}
                Voice Acting
              </label>
              <button 
                onClick={toggleVoice}
                className={`px-4 py-2 border-2 border-black font-bold uppercase transition-colors ${voicePrefs.enabled ? 'bg-yellow-400' : 'bg-gray-200 text-gray-500'}`}
              >
                {voicePrefs.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
            
            {voicePrefs.enabled && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold uppercase tracking-widest">Voice Volume</span>
                    <span className="font-bold">{Math.round(voicePrefs.volume * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="1" step="0.05"
                    value={voicePrefs.volume}
                    onChange={(e) => setVoicePrefs({...voicePrefs, volume: parseFloat(e.target.value)})}
                    onMouseUp={() => playUiSfx('click')}
                    onTouchEnd={() => playUiSfx('click')}
                    className="w-full accent-black h-3 bg-gray-200 rounded-none border-2 border-black"
                  />
                </div>
                
                <div>
                  <span className="font-bold uppercase tracking-widest block mb-2">Narration Mode</span>
                  <select 
                    value={voicePrefs.mode}
                    onChange={(e) => setVoicePrefs({...voicePrefs, mode: e.target.value as any})}
                    className="w-full p-2 border-2 border-black font-manga-text font-bold bg-gray-50 focus:outline-none focus:ring-0 cursor-pointer"
                  >
                    <option value="dialogue-only">Dialogue Only</option>
                    <option value="narration-and-dialogue">Narration & Dialogue</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={() => { playUiSfx('click'); onClose(); }}
          onMouseEnter={() => playUiSfx('hover')}
          className="w-full mt-8 bg-black text-white font-bold font-manga-text py-3 uppercase tracking-widest hover:bg-gray-800 transition shadow-[4px_4px_0_0_#FBBF24]"
        >
          Confirm
        </button>
      </motion.div>
    </div>
  );
}
