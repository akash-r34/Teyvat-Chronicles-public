import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Character, ElementType, StoryNode } from '../types';
import { playUiSfx } from '../services/uiAudio';
import { Wind, Flame, Droplets, Zap, Mountain, Ghost, Leaf, Settings, Server } from 'lucide-react';

interface Props {
  onComplete: (char: Character) => void;
  onOpenSettings?: () => void;
}

const ELEMENTS: { type: ElementType; icon: React.ReactNode; color: string; desc: string }[] = [
  { type: 'Anemo', icon: <Wind className="w-5 h-5" />, color: 'text-emerald-500', desc: 'Freedom.' },
  { type: 'Pyro', icon: <Flame className="w-5 h-5" />, color: 'text-orange-500', desc: 'Passion.' },
  { type: 'Hydro', icon: <Droplets className="w-5 h-5" />, color: 'text-blue-500', desc: 'Justice.' },
  { type: 'Electro', icon: <Zap className="w-5 h-5" />, color: 'text-purple-500', desc: 'Eternity.' },
  { type: 'Geo', icon: <Mountain className="w-5 h-5" />, color: 'text-yellow-600', desc: 'Contracts.' },
  { type: 'Cryo', icon: <Ghost className="w-5 h-5" />, color: 'text-cyan-500', desc: 'Mercy.' },
  { type: 'Dendro', icon: <Leaf className="w-5 h-5" />, color: 'text-green-600', desc: 'Wisdom.' },
];

export default function CharacterCreation({ onComplete, onOpenSettings }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hasPaimon, setHasPaimon] = useState(true);
  const [hasSibling, setHasSibling] = useState(true);
  const [gender, setGender] = useState('Male');
  const [element, setElement] = useState<ElementType>('Anemo');
  const [skill, setSkill] = useState('');
  const [skillDesc, setSkillDesc] = useState('');
  const [ultimate, setUltimate] = useState('');
  const [ultimateDesc, setUltimateDesc] = useState('');
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
    else {
      onComplete({
        name,
        description,
        gender,
        hasPaimon,
        element,
        skill,
        skillDesc,
        ultimate,
        ultimateDesc,
        chapter: 1,
        hp: 100,
        maxHp: 100,
        level: 1,
        location: 'Starfell Valley, Mondstadt',
        inventory: ['Dull Blade', 'Mora x100'],
        surfaceGoal: hasSibling ? 'Find my lost twin and find a way back home.' : 'Survive Teyvat and uncover what brought you here.',
        regionalGoal: '',
        hiddenArcGoal: '',
        endgameGoal: '', // To be defined by AI Prologue
        currentQuest: 'Awake in a strange new world.'
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0C10] text-black p-6 relative overflow-hidden select-none halftone-bg">
      {onOpenSettings && (
        <button 
          onClick={() => { playUiSfx('click'); onOpenSettings(); }}
          onMouseEnter={() => playUiSfx('hover')}
          className="absolute top-6 right-6 z-50 bg-white border-2 border-black p-2 shadow-[4px_4px_0_0_#000] hover:bg-yellow-100 transition rotate-[2deg] text-black"
          title="Audio Settings"
        >
          <Settings size={28} />
        </button>
      )}

      <div className="absolute top-6 left-6 z-50 flex flex-col gap-2">
        <button 
          onClick={async () => {
            playUiSfx('click');
            console.log("Testing Vertex AI connection...");
            try {
              const { testVertexConnection } = await import('../services/aiService');
              const result = await testVertexConnection();
              console.log("Vertex test result shown to user.");
              alert(result);
            } catch(e: any) {
              console.error("Critical error testing Vertex:", e);
              alert("Vertex test failed: " + e.message);
            }
          }}
          onMouseEnter={() => playUiSfx('hover')}
          className="bg-white border-2 border-black px-4 py-2 font-manga-text font-bold shadow-[4px_4px_0_0_#000] hover:bg-blue-100 transition flex items-center gap-2 rotate-[-2deg] text-black"
          title="Test Vertex AI"
        >
          <Server size={20} /> Test Vertex
        </button>

        <button 
          onClick={async () => {
            playUiSfx('click');
            console.log("Testing Gemini API connection...");
            try {
              const { testGeminiConnection } = await import('../services/aiService');
              const result = await testGeminiConnection();
              console.log("Gemini test result shown to user.");
              alert(result);
            } catch(e: any) {
              console.error("Critical error testing Gemini:", e);
              alert("Gemini test failed: " + e.message);
            }
          }}
          onMouseEnter={() => playUiSfx('hover')}
          className="bg-white border-2 border-black px-4 py-2 font-manga-text font-bold shadow-[4px_4px_0_0_#000] hover:bg-purple-100 transition flex items-center gap-2 rotate-[1deg] text-black"
          title="Test Gemini API"
        >
          <Zap size={20} className="text-purple-600" /> Test Gemini API
        </button>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        className="w-full max-w-lg bg-white border-8 border-black p-8 z-10 shadow-[12px_12px_0_0_#000] rotate-[-1deg]"
      >
        <div className="mb-4 flex items-center justify-center gap-2">
           <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Inspired By</span>
           <img 
              src="https://upload.wikimedia.org/wikipedia/en/5/5d/Genshin_Impact_logo.svg" 
              alt="Genshin Impact Logo" 
              className="h-6 object-contain grayscale opacity-80"
            />
        </div>
        
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-manga-sfx tracking-widest uppercase text-black drop-shadow-[3px_3px_0_#FBBF24]">Awakening!</h1>
          <div className="inline-block mt-3 bg-black text-white px-4 py-1 font-manga-text font-bold rotate-2 border-2 border-dashed border-white shadow-[2px_2px_0_0_#FBBF24]">
            Create Your Vessel
          </div>
        </div>

        <div className="space-y-6">
          {step === 0 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <label className="block font-manga-text text-xl font-bold uppercase mb-3 text-black">What is your Alias?</label>
              <input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter Name..."
                className="w-full bg-white border-4 border-black font-manga-text text-xl px-4 py-3 outline-none focus:bg-yellow-100 shadow-[6px_6px_0_0_#000] transition-colors mb-6"
                id="char-name"
              />
              <label className="block font-manga-text text-xl font-bold uppercase mb-3 text-black">Physical Description (Optional)</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Tall, silver hair, wearing an Outrider's coat..."
                className="w-full h-24 resize-none bg-white border-4 border-black font-manga-text text-lg px-4 py-3 outline-none focus:bg-yellow-100 shadow-[6px_6px_0_0_#000] transition-colors"
              />
            </motion.div>
          )}

          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <label className="block font-manga-text text-xl font-bold uppercase mb-3 text-black">Choose your Form (Gender)</label>
              <div className="grid grid-cols-2 gap-4 mb-8">
                 {['Male', 'Female', 'Non-Binary', 'Other'].map(g => (
                   <button
                     key={g}
                     onClick={() => { playUiSfx('click'); setGender(g); }}
                     onMouseEnter={() => playUiSfx('hover')}
                     className={`p-3 border-4 border-black font-manga-text uppercase tracking-wider text-xl transition-all shadow-[4px_4px_0_0_#000] hover:translate-y-1 hover:shadow-[0_0_0_0_#000] hover:bg-yellow-100 ${
                       gender === g ? 'bg-yellow-400 font-black scale-105' : 'bg-white font-bold text-black'
                     }`}
                   >
                     {g}
                   </button>
                 ))}
              </div>
              <label className="block font-manga-text text-xl font-bold uppercase mb-3 text-black">Do you travel with Paimon?</label>
              <div className="flex gap-4">
                 <button onClick={() => { playUiSfx('click'); setHasPaimon(true); }} onMouseEnter={() => playUiSfx('hover')} className={`flex-1 p-3 border-4 border-black font-manga-text uppercase text-xl shadow-[4px_4px_0_0_#000] ${hasPaimon ? 'bg-yellow-400 font-black' : 'bg-white'}`}>Yes</button>
                 <button onClick={() => { playUiSfx('click'); setHasPaimon(false); }} onMouseEnter={() => playUiSfx('hover')} className={`flex-1 p-3 border-4 border-black font-manga-text uppercase text-xl shadow-[4px_4px_0_0_#000] ${!hasPaimon ? 'bg-yellow-400 font-black' : 'bg-white'}`}>No (Lone Wolf)</button>
              </div>
              <label className="block font-manga-text text-xl font-bold uppercase mb-3 text-black mt-8">Did you arrive in Teyvat with a sibling?</label>
              <div className="flex gap-4">
                 <button onClick={() => { playUiSfx('click'); setHasSibling(true); }} onMouseEnter={() => playUiSfx('hover')} className={`flex-1 p-3 border-4 border-black font-manga-text uppercase text-xl shadow-[4px_4px_0_0_#000] ${hasSibling ? 'bg-yellow-400 font-black' : 'bg-white'}`}>Yes</button>
                 <button onClick={() => { playUiSfx('click'); setHasSibling(false); }} onMouseEnter={() => playUiSfx('hover')} className={`flex-1 p-3 border-4 border-black font-manga-text uppercase text-xl shadow-[4px_4px_0_0_#000] ${!hasSibling ? 'bg-yellow-400 font-black' : 'bg-white'}`}>No</button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-2 gap-4">
              <label className="col-span-2 block font-manga-text text-xl font-bold uppercase mb-1 text-black">Vision Core Resonance</label>
              {ELEMENTS.map((e) => (
                <button
                  key={e.type}
                  onClick={() => { playUiSfx('click'); setElement(e.type); }}
                  onMouseEnter={() => playUiSfx('hover')}
                  className={`p-3 border-4 border-black flex items-center justify-center gap-2 transition-all shadow-[4px_4px_0_0_#000] hover:translate-y-1 hover:shadow-[0_0_0_0_#000] hover:bg-yellow-100 ${
                    element === e.type 
                      ? 'bg-yellow-400 font-black scale-105' 
                      : 'bg-white font-bold'
                  }`}
                  id={`element-${e.type}`}
                >
                  <span className={`${element === e.type ? 'text-black' : e.color}`}>{e.icon}</span>
                  <span className="font-manga-text uppercase tracking-widest text-lg">{e.type}</span>
                </button>
              ))}
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div>
                <label className="block font-manga-text text-xl font-bold uppercase mb-3 text-black">Primary Elemental Skill</label>
                <input 
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                  placeholder="e.g. Vortex Slash..."
                  className="w-full bg-white border-4 border-black font-manga-text text-xl px-4 py-3 outline-none focus:bg-yellow-100 shadow-[6px_6px_0_0_#000] transition-colors mb-4"
                  id="skill-name"
                />
                <textarea 
                  value={skillDesc}
                  onChange={(e) => setSkillDesc(e.target.value)}
                  placeholder="Describe your skill (Optional)"
                  className="w-full h-16 resize-none bg-white border-4 border-black font-manga-text text-sm px-4 py-2 outline-none focus:bg-yellow-100 shadow-[4px_4px_0_0_#000]"
                />
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div>
                <label className="block font-manga-text text-xl font-bold uppercase mb-3 text-black">Elemental Burst (Ultimate)</label>
                <input 
                  value={ultimate}
                  onChange={(e) => setUltimate(e.target.value)}
                  placeholder="e.g. Stellar Restoration..."
                  className="w-full bg-white border-4 border-black font-manga-text text-xl px-4 py-3 outline-none focus:bg-yellow-100 shadow-[6px_6px_0_0_#000] transition-colors mb-4"
                  id="ultimate-name"
                />
                <textarea 
                  value={ultimateDesc}
                  onChange={(e) => setUltimateDesc(e.target.value)}
                  placeholder="Describe your ultimate (Optional)"
                  className="w-full h-16 resize-none bg-white border-4 border-black font-manga-text text-sm px-4 py-2 outline-none focus:bg-yellow-100 shadow-[4px_4px_0_0_#000]"
                />
              </div>
            </motion.div>
          )}

          <div className="pt-4">
            <button
              onClick={() => { playUiSfx(step === 4 ? 'confirm' : 'click'); handleNext(); }}
              onMouseEnter={() => playUiSfx('hover')}
              disabled={(step === 0 && !name) || (step === 3 && !skill) || (step === 4 && !ultimate)}
              className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:bg-gray-300 border-[6px] border-black text-black font-manga-sfx text-3xl uppercase py-4 transition-all shadow-[8px_8px_0_0_#000] hover:translate-y-1 hover:shadow-[4px_4px_0_0_#000] active:translate-y-2 active:shadow-none"
              id="next-btn"
            >
              {step === 4 ? 'Descend to Teyvat!' : 'Next'}
            </button>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-3 rounded-full border-2 border-black transition-all ${step === i ? 'w-10 bg-yellow-400' : 'w-3 bg-white'}`} />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
