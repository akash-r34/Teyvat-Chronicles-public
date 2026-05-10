import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Character, StoryNode } from '../types';
import MangaPanel from './MangaPanel';
import { playUiSfx } from '../services/uiAudio';
import { MapPin, Sparkles, Sword, Play, Save, Undo, Menu, X, Settings, Home, Volume2, VolumeX, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { speak, stopSpeaking, VoicePrefs } from '../services/voice';

interface Props {
  character: Character;
  loadedHistory?: StoryNode[];
  onOpenSettings: () => void;
  onReturnToMenu: () => void;
  onExport: (history: StoryNode[], saveName: string) => void;
  voicePrefs: VoicePrefs;
  setVoicePrefs: (v: VoicePrefs) => void;
}

export default function GameChat({ character: initialChar, loadedHistory, onOpenSettings, onReturnToMenu, onExport, voicePrefs, setVoicePrefs }: Props) {
  const [character, setCharacter] = useState<Character>(initialChar);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<StoryNode[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [isBondsModalOpen, setIsBondsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPlayerSidebarOpen, setIsPlayerSidebarOpen] = useState(true);
  const [isNarrativeSidebarOpen, setIsNarrativeSidebarOpen] = useState(true);
  const [isSatchelSidebarOpen, setIsSatchelSidebarOpen] = useState(false);
  const [isBondsSidebarOpen, setIsBondsSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    async function startAdventure() {
      try {
        if (loadedHistory && loadedHistory.length > 0) {
          const stored = localStorage.getItem('genshinMangaSession');
          if (stored) {
             const { sessionId: sid } = JSON.parse(stored);
             setSessionId(sid);
          }
          setHistory(loadedHistory);
          setCharacter(initialChar);
          setIsLoading(false);
          return;
        }

        // New Game: Create session
        const sessionRes = await fetch("/api/session", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ character: initialChar })
        });
        const { sessionId: sid } = await sessionRes.json();
        setSessionId(sid);
        localStorage.setItem('genshinMangaSession', JSON.stringify({ sessionId: sid }));

        const initRes = await fetch("/api/getInitialNode", {
           method: "POST",
           headers: {"Content-Type": "application/json"},
           body: JSON.stringify({ sessionId: sid })
        });
        const initialNode = await initRes.json();
        
        // Refresh character to grab server defaults
        const charRes = await fetch(`/api/session/${sid}/character`);
        const updatedChar = await charRes.json();
        
        setCharacter(updatedChar);
        setHistory([initialNode]);
      } catch (err: any) {
        console.error("Failed to start adventure:", err);
        setHistory([{
          id: Date.now().toString(),
          narrative: `Error: ${err.message}. Please refresh and try again.`,
          dialogue: "",
          speaker: "",
          choices: []
        }]);
      } finally {
        setIsLoading(false);
      }
    }
    startAdventure();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight;
      }, 100);
    }
  }, [history, isLoading]);

  useEffect(() => {
    if (!isLoading && history.length > 0) {
      const latest = history[history.length - 1];
      const textToSpeak = voicePrefs.mode === 'narration-and-dialogue' 
        ? `${latest.narrative || ''} ${latest.dialogue || ''}`.trim()
        : (latest.dialogue || '').trim();
      
      if (textToSpeak) {
        speak(textToSpeak, voicePrefs, latest.speaker);
      }
    }
  }, [history, isLoading, voicePrefs]);

  const handleAction = async (action: string) => {
    if (isLoading || !sessionId) return;
    setIsLoading(true);

    try {
      const resp = await fetch("/api/generateStoryTurn", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ sessionId, userAction: action })
      });
      if (!resp.ok) throw new Error(await resp.text());
      const nextNode = await resp.json();
      
      const charRes = await fetch(`/api/session/${sessionId}/character`);
      const updatedChar = await charRes.json();
      
      setCharacter(updatedChar);
      setHistory(prev => [...prev, nextNode]);
    } catch (error) {
      console.error(error);
      const fallbackNode: StoryNode = {
        id: Date.now().toString(),
        narrative: "An anomaly disrupts the Ley Lines. The vision is unclear...",
        speaker: "",
        dialogue: "",
        choices: ["Try again", "Draw weapon", "Run away"],
        userAction: action
      };
      setHistory(prev => [...prev, fallbackNode]);
    } finally {
      setIsLoading(false);
      setInput('');
    }
  };

  const handleSave = async () => {
    if (!sessionId) return;
    try {
      const resp = await fetch(`/api/saves/session/${sessionId}/save`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ name: `Save: ${character.name}` })
      });
      if (!resp.ok) throw new Error("Failed to save");
      setToastMessage('Progress enshrined in the Ley Lines!');
    } catch(e: any) {
      setToastMessage('Failed to save to Ley Lines.');
    }
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRollback = async () => {
      if (!sessionId || history.length <= 1) return;
      try {
        const resp = await fetch('/api/rollback', {
          method: 'POST',
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId })
        });
        if (resp.ok) {
           setHistory(prev => prev.slice(0, -1));
           setToastMessage("Ley Lines rewound. Time bends.");
        } else {
           setToastMessage("Failed to rewind time.");
        }
      } catch (e) {
        setToastMessage("Failed to rewind time.");
      }
      setTimeout(() => setToastMessage(null), 3000);
  };

  const latestNode = history[history.length - 1];

  return (
    <div className="w-full h-screen flex flex-col pt-16 relative bg-[#0A0C10]">
      
      {/* Header - Simple Manga aesthetic */}
      <header className="fixed top-0 left-0 w-full h-16 border-b-4 border-black bg-white px-4 md:px-6 flex items-center justify-between z-40 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="text-black font-manga-text font-black text-xl md:text-2xl uppercase italic tracking-tighter truncate max-w-[150px] md:max-w-none">
            Teyvat Chronicles
          </div>
          <div className="hidden sm:flex items-center pl-3 border-l-2 border-black/20 gap-2">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Inspired By</span>
            <img 
              src="https://upload.wikimedia.org/wikipedia/en/5/5d/Genshin_Impact_logo.svg" 
              alt="Genshin Impact Logo" 
              className="h-5 object-contain"
            />
          </div>
        </div>
        <div className="flex gap-4 md:gap-6 items-center">
            <button 
              key="voice" 
              onClick={() => { 
                playUiSfx('click'); 
                if (voicePrefs.enabled) stopSpeaking();
                setVoicePrefs({ ...voicePrefs, enabled: !voicePrefs.enabled }); 
              }} 
              onMouseEnter={() => playUiSfx('hover')} 
              className={`hidden sm:flex p-1.5 border-2 border-black shadow-[2px_2px_0_0_#000] rotate-[1deg] transition-colors ${voicePrefs.enabled ? 'bg-yellow-400 text-black' : 'bg-gray-100 text-gray-400'}`} 
              title="Toggle Voice"
            >
              {voicePrefs.enabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <button key="settings" onClick={() => { playUiSfx('click'); onOpenSettings(); }} onMouseEnter={() => playUiSfx('hover')} className="hidden sm:flex text-black bg-white hover:bg-yellow-200 border-2 border-black p-1.5 shadow-[2px_2px_0_0_#000] rotate-[2deg] transition-colors" title="Settings">
              <Settings className="w-5 h-5" />
            </button>
            <button key="export" onClick={() => { playUiSfx('click'); onExport(history, `Save: ${character.name}`); }} disabled={isLoading} onMouseEnter={() => playUiSfx('hover')} className="hidden sm:flex text-black bg-white hover:bg-yellow-200 border-2 border-black p-1.5 shadow-[2px_2px_0_0_#000] transition-colors disabled:opacity-50" title="Export Manga PDF">
              <BookOpen className="w-5 h-5" />
            </button>
            <button key="rollback" onClick={() => { playUiSfx('click'); handleRollback(); }} onMouseEnter={() => playUiSfx('hover')} disabled={isLoading || history.length <= 1} className="hidden sm:flex text-black bg-white hover:bg-gray-200 border-2 border-black p-1.5 shadow-[2px_2px_0_0_#000] transition-colors disabled:opacity-50" title="Rollback 1 Turn">
              <Undo className="w-5 h-5" />
            </button>
            <button key="save" onClick={() => { playUiSfx('click'); handleSave(); }} onMouseEnter={() => playUiSfx('hover')} disabled={isLoading} className="hidden sm:flex text-black bg-white hover:bg-yellow-200 border-2 border-black p-1.5 shadow-[2px_2px_0_0_#000] transition-colors disabled:opacity-50" title="Save Game">
              <Save className="w-5 h-5" />
            </button>
            <button key="menu" onClick={() => { playUiSfx('click'); onReturnToMenu(); }} onMouseEnter={() => playUiSfx('hover')} className="hidden sm:flex text-black bg-red-100 hover:bg-red-200 border-2 border-black p-1.5 shadow-[2px_2px_0_0_#000] transition-colors" title="Main Menu">
              <Home className="w-5 h-5 text-red-700" />
            </button>
            <span className="hidden md:inline-block text-black font-manga-sfx text-lg tracking-widest bg-yellow-400 px-3 py-1 border-2 border-black rotate-[-2deg] shadow-[2px_2px_0_0_#000]">
              HP: {character.hp}/{character.maxHp}
            </span>
            <span className="text-black font-manga-sfx text-base md:text-lg tracking-widest bg-cyan-400 px-3 py-1 border-2 border-black rotate-[1deg] shadow-[2px_2px_0_0_#000]">
              CH. {character.chapter}
            </span>
            <button onClick={() => { playUiSfx('click'); setIsMobileMenuOpen(true); }} onMouseEnter={() => playUiSfx('hover')} className="lg:hidden text-black bg-white hover:bg-gray-200 border-2 border-black p-1.5 shadow-[2px_2px_0_0_#000] transition-colors">
              <Menu className="w-6 h-6" />
            </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            className="fixed inset-0 z-50 bg-[#0A0C10] text-white flex flex-col p-6 overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-8 border-b-4 border-white pb-4">
              <h2 className="font-manga-sfx text-3xl uppercase tracking-widest">Player Menu</h2>
              <button onClick={() => setIsMobileMenuOpen(false)} className="bg-white text-black p-2 hover:bg-red-500 hover:text-white transition-colors border-2 border-black shadow-[4px_4px_0_0_#FFF]">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6 font-manga-text">
              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => { handleSave(); setIsMobileMenuOpen(false); }} className="bg-yellow-400 text-black py-3 border-4 border-black font-bold uppercase shadow-[4px_4px_0_0_#FFF] flex justify-center items-center gap-2">
                  <Save className="w-5 h-5"/> Save Mode
                </button>
                <button onClick={() => { handleRollback(); setIsMobileMenuOpen(false); }} className="bg-white text-black py-3 border-4 border-black font-bold uppercase shadow-[4px_4px_0_0_#FFF] flex justify-center items-center gap-2">
                  <Undo className="w-5 h-5"/> Rollback
                </button>
              </div>

              {/* Audio Block */}
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => { onExport(history, `Save: ${character.name}`); setIsMobileMenuOpen(false); }} className="bg-blue-400 text-black font-manga-text py-3 border-4 border-black font-bold uppercase shadow-[4px_4px_0_0_#FFF] flex justify-center items-center gap-2">
                   <BookOpen className="w-5 h-5"/> Export PDF
                </button>
                <button onClick={() => { onOpenSettings(); setIsMobileMenuOpen(false); }} className="bg-gray-800 text-white font-manga-text py-3 border-4 border-white font-bold uppercase shadow-[4px_4px_0_0_#FFF] flex justify-center items-center gap-2">
                  <Settings className="w-5 h-5"/> Settings
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <button onClick={onReturnToMenu} className="bg-red-500 text-white font-manga-text py-3 border-4 border-black font-bold uppercase shadow-[4px_4px_0_0_#000] flex justify-center items-center gap-2">
                  <Home className="w-5 h-5"/> Main Menu
                </button>
              </div>

              {/* Status Board */}
              <div className="bg-white text-black border-4 border-black p-4 shadow-[4px_4px_0_0_#FFF]">
                <h3 className="font-manga-sfx text-xl tracking-widest uppercase border-b-2 border-black pb-1 mb-2 flex justify-between">
                  Chapter {character.chapter} Goal
                  <span className="text-sm bg-red-500 text-white px-2 py-1 rotate-2 shadow-sm">HP: {character.hp}/{character.maxHp}</span>
                </h3>
                <div className="text-sm space-y-2">
                  {latestNode?.mainGoal && (
                    <div>
                      <span className="font-bold text-amber-600 block mb-1 uppercase">Main Goal:</span>
                      <p className="italic leading-tight text-xs">{latestNode.mainGoal}</p>
                    </div>
                  )}
                  {latestNode?.sideGoalsLog && latestNode.sideGoalsLog.length > 0 && (
                    <div>
                      <span className="font-bold text-orange-600 block mb-1 uppercase">Side Goals:</span>
                      <ul className="list-none space-y-1 text-xs font-bold">
                        {latestNode.sideGoalsLog.slice(0, 4).map((sg, i) => (
                           <li key={i} className="leading-tight">
                             {sg.kind === 'completed' ? '✓' : '○'} {sg.label}
                           </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <span className="font-bold uppercase">Current Quest:</span>
                    <p className="italic leading-tight">{character.currentQuest}</p>
                  </div>
                </div>
              </div>

              {/* Inventory */}
              <div className="bg-white text-black border-4 border-black p-4 shadow-[4px_4px_0_0_#FFF]">
                <h3 className="font-manga-sfx text-xl tracking-widest uppercase border-b-2 border-black pb-1 mb-2">Satchel</h3>
                <ul className="list-disc pl-4 text-sm font-bold leading-tight uppercase">
                  {(character.inventory || []).slice(0, 5).map((item, i) => <li key={i}>{item}</li>)}
                </ul>
                {(character.inventory || []).length > 5 && (
                  <button onClick={() => setIsInventoryModalOpen(true)} className="mt-2 text-xs italic underline w-full text-left font-bold tracking-wider hover:text-blue-600">
                    + VIEW MORE ({(character.inventory || []).length - 5} hidden)
                  </button>
                )}
              </div>

              {/* Mobile Bonds */}
              {character.relationships && character.relationships.length > 0 && (
                <div className="bg-white text-black border-4 border-black p-4 shadow-[4px_4px_0_0_#FFF]">
                  <h3 className="font-manga-sfx text-xl tracking-widest uppercase border-b-2 border-black pb-1 mb-2">Bonds</h3>
                  <ul className="space-y-1 text-sm font-bold uppercase leading-tight">
                    {character.relationships.slice(0, 4).map((rel, i) => (
                       <li key={i} className="flex justify-between border-b border-gray-200 pb-1">
                         <span>{rel.npc}</span>
                         <span className={rel.affinity > 0 ? "text-green-600" : rel.affinity < 0 ? "text-red-500" : "text-gray-500"}>
                           {rel.affinity > 0 ? '+' : ''}{rel.affinity}
                         </span>
                       </li>
                    ))}
                  </ul>
                  {character.relationships.length > 4 && (
                    <button onClick={() => setIsBondsModalOpen(true)} className="mt-2 text-xs italic underline w-full text-left font-bold tracking-wider hover:text-blue-600">
                      + VIEW MORE ({character.relationships.length - 4} hidden)
                    </button>
                  )}
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Comic Strip Reader */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto w-full px-4 py-8 md:px-8 space-y-12 no-scrollbar scroll-smooth"
      >
         {/* Playable HUD Updates floating top right */}
        {latestNode && !isLoading && (
          <div className="fixed top-20 right-6 z-50 flex flex-col gap-2 items-end pointer-events-none">
             {latestNode.relationshipDelta && latestNode.relationshipDelta.map((delta, idx) => (
                <motion.div key={`rel-${idx}`} initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="bg-blue-100 border-[3px] border-black px-4 py-2 text-black font-manga-text font-bold shadow-[4px_4px_0_0_#000]">
                  {delta.npc} will remember that. {delta.affinityChange > 0 ? "🤍" : "💔"}
                </motion.div>
             ))}
             {latestNode.flagsSet && latestNode.flagsSet.map((flag, idx) => (
                <motion.div key={`flag-${idx}`} initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="bg-purple-100 border-[3px] border-black px-4 py-2 text-black font-manga-text font-bold shadow-[4px_4px_0_0_#000]">
                  {flag.note || `Choice saved: ${flag.value}`}
                </motion.div>
             ))}
             {latestNode.mainGoalComplete && (
                <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="bg-amber-300 border-[3px] border-black px-4 py-2 text-black font-manga-text font-bold shadow-[4px_4px_0_0_#000] rotate-2">
                  ✦ Canon Goal Completed ✦
                </motion.div>
             )}
             {latestNode.sideGoalsThisTurn && latestNode.sideGoalsThisTurn.map((sg, idx) => (
                <motion.div key={`sg-${idx}`} initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="bg-orange-100 border-[3px] border-black px-4 py-2 text-black font-manga-text font-bold shadow-[4px_4px_0_0_#000]">
                  {sg.kind === 'completed' ? '✓' : '○'} Side Goal: {sg.label}
                </motion.div>
             ))}
             {latestNode.itemGained && (
               <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="bg-yellow-100 border-[3px] border-black px-4 py-2 text-black font-manga-text font-bold shadow-[4px_4px_0_0_#000]">
                 + Loot Plundered: {latestNode.itemGained}
               </motion.div>
             )}
             {latestNode.itemsRemoved && latestNode.itemsRemoved.map((removed, idx) => (
               <motion.div key={`rem-${idx}`} initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="bg-gray-200 border-[3px] border-black px-4 py-2 text-gray-700 font-manga-text font-bold shadow-[4px_4px_0_0_#000]">
                 - Lost: {removed}
               </motion.div>
             ))}
             {latestNode.hpChange && latestNode.hpChange < 0 ? (
               <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="bg-red-500 border-[3px] border-black px-4 py-2 text-white font-manga-sfx tracking-widest shadow-[4px_4px_0_0_#000]">
                 {latestNode.hpChange} HP!
               </motion.div>
             ) : latestNode.hpChange && latestNode.hpChange > 0 ? (
               <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="bg-green-500 border-[3px] border-black px-4 py-2 text-white font-manga-sfx tracking-widest shadow-[4px_4px_0_0_#000]">
                 +{latestNode.hpChange} HP!
               </motion.div>
             ) : null}
             {latestNode.questUpdated && (
               <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="bg-emerald-100 border-[3px] border-black px-4 py-2 text-black font-manga-text shadow-[4px_4px_0_0_#000]">
                 ⚑ Quest Line Updated!
               </motion.div>
             )}
          </div>
        )}
        {history.map((node, idx) => (
          <MangaPanel 
            key={node?.id ? `${node.id}-${idx}` : idx} 
            node={node} 
            isLatest={idx === history.length - 1} 
          />
        ))}

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center my-12">
            <div className="bg-white border-4 border-black px-6 py-4 flex items-center gap-4 shadow-[4px_4px_0_0_#000] rotate-1">
              <Sparkles className="w-6 h-6 text-black animate-spin" />
              <span className="font-manga-dialogue font-bold uppercase text-xl">Drawing next panel...</span>
            </div>
          </motion.div>
        )}
        
        {/* Spacer for bottom choices */}
        <div className="h-[40vh]" />
      </main>

      {/* Telltale / Action Overlay */}
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#050505] via-[#050505]/95 to-transparent pt-32 pb-6 px-4 z-30 pointer-events-none">
        
        {!isLoading && latestNode && (
          <div className="w-full max-w-5xl mx-auto pointer-events-auto flex flex-col lg:flex-row gap-6">
            
            {/* Action/Input Column */}
            <div className="flex-1 flex flex-col gap-4">
              {/* Telltale Choices */}
              <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3">
                {(latestNode?.choices || []).map((choiceRaw, i) => {
                  const isObj = typeof choiceRaw === "object";
                  const text = isObj ? (choiceRaw as any).text : choiceRaw;
                  const tone = isObj ? (choiceRaw as any).tone : 'neutral';
                  
                  let toneBorder = "border-white";
                  if (tone === "kind") toneBorder = "border-green-400";
                  if (tone === "pragmatic") toneBorder = "border-blue-400";
                  if (tone === "aggressive") toneBorder = "border-red-500";
                  if (tone === "curious") toneBorder = "border-purple-400";
                  
                  return (
                    <button
                      key={i}
                      onClick={() => { playUiSfx('choiceClick'); handleAction(text); }}
                      onMouseEnter={() => playUiSfx('hover')}
                      className={`telltale-choice text-left bg-black/80 border-l-[6px] ${toneBorder} px-4 sm:px-6 py-3 sm:py-4 text-white hover:border-yellow-400 focus:outline-none focus:border-yellow-400 transition-all shadow-[0_4px_12px_rgba(0,0,0,0.5)] group`}
                    >
                      <span className="font-manga-text text-base sm:text-lg italic tracking-wide group-hover:text-yellow-400 transition-colors">
                        "{text}"
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Input */}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAction(input)}
                  placeholder="...or do something else"
                  className="flex-1 bg-white border-[4px] border-black text-black rounded-none px-4 py-3 sm:px-6 sm:py-4 font-manga-text font-bold text-base sm:text-lg placeholder-gray-500 focus:outline-none focus:bg-yellow-50 transition-colors shadow-[4px_4px_0_0_#000] sm:shadow-[6px_6px_0_0_#000]"
                  disabled={isLoading}
                />
                <button
                  onClick={() => { playUiSfx('actionBtn'); handleAction(input); }}
                  onMouseEnter={() => playUiSfx('hover')}
                  disabled={!input.trim() || isLoading}
                  className="bg-yellow-400 hover:bg-yellow-300 text-black px-6 py-3 sm:px-8 sm:py-4 font-manga-sfx uppercase tracking-widest text-xl sm:text-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed border-[4px] border-black shadow-[4px_4px_0_0_#000] sm:shadow-[6px_6px_0_0_#000] active:translate-y-1 active:shadow-[2px_2px_0_0_#000]"
                >
                  Go!
                </button>
              </div>
              
              <div className="flex flex-wrap justify-start gap-4">
                 <button 
                   onClick={() => { playUiSfx('actionBtn'); handleAction(`Use Skill: ${character.skill}`); }}
                   onMouseEnter={() => playUiSfx('hover')}
                   className="bg-emerald-100 border-[3px] border-black text-black px-4 py-1.5 sm:px-6 sm:py-2 font-manga-sfx tracking-widest text-base sm:text-xl hover:bg-emerald-200 transition-all shadow-[4px_4px_0_0_#000] rotate-[-2deg]"
                 >
                   SKILL
                 </button>
                 <button 
                   onClick={() => { playUiSfx('actionBtn'); handleAction(`Unleash Ultimate: ${character.ultimate}`); }}
                   onMouseEnter={() => playUiSfx('hover')}
                   className="bg-purple-200 border-[3px] border-black text-black px-4 py-1.5 sm:px-6 sm:py-2 font-manga-sfx tracking-widest text-base sm:text-xl hover:bg-purple-300 transition-all shadow-[4px_4px_0_0_#000] rotate-[1deg]"
                 >
                   ULTIMATE
                 </button>
              </div>
            </div>

            {/* Sidebar Stats Column (Contrast FIXED via text-black) */}
            <div className="hidden lg:flex w-80 flex-col gap-2 font-manga-text self-end pb-12 text-black max-h-[80vh] overflow-y-auto no-scrollbar">
              
              {/* Player Identity Card */}
              <div className="bg-white border-[4px] border-black shadow-[6px_6px_0_0_#000]">
                <button 
                  onClick={() => setIsPlayerSidebarOpen(!isPlayerSidebarOpen)}
                  className="w-full flex justify-between items-center p-3 font-manga-sfx uppercase tracking-widest hover:bg-gray-100 transition-colors"
                >
                  <span className="text-xl">Player</span>
                  {isPlayerSidebarOpen ? <ChevronDown className="w-5 h-5"/> : <ChevronUp className="w-5 h-5"/>}
                </button>
                {isPlayerSidebarOpen && (
                  <div className="p-4 pt-0 flex gap-4 items-center border-t-2 border-dashed border-gray-300">
                    {character.avatarUrl && (
                      <div 
                        className="w-16 h-16 border-[3px] border-black overflow-hidden shadow-[2px_2px_0_0_#000] bg-blue-100 shrink-0 cursor-pointer group relative mt-2"
                        onClick={() => setIsLightboxOpen(true)}
                        title="View Avatar"
                      >
                        <img src={character.avatarUrl} alt="Avatar" className="w-full h-full object-cover object-[center_top] scale-125 pt-[5%] group-hover:scale-150 transition-transform" />
                      </div>
                    )}
                    <div className="mt-2">
                      <h3 className="font-manga-sfx text-xl uppercase tracking-widest leading-none drop-shadow-[1px_1px_0_#FBBF24]">{character.name}</h3>
                      <div className="text-sm font-bold opacity-80 uppercase leading-none mt-1">{character.element} User</div>
                      {character.hasPaimon && <div className="text-[10px] mt-1 bg-black text-white inline-block px-2 rounded-full font-bold">W/ PAIMON</div>}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white border-[4px] border-black shadow-[6px_6px_0_0_#000]">
                <button 
                  onClick={() => setIsNarrativeSidebarOpen(!isNarrativeSidebarOpen)}
                  className="w-full flex justify-between items-center p-3 font-manga-sfx uppercase tracking-widest hover:bg-gray-100 transition-colors"
                >
                  <span className="text-xl">Narrative</span>
                  {isNarrativeSidebarOpen ? <ChevronDown className="w-5 h-5"/> : <ChevronUp className="w-5 h-5"/>}
                </button>
                {isNarrativeSidebarOpen && (
                  <div className="p-4 pt-3 border-t-2 border-dashed border-gray-300 text-sm">
                    {latestNode?.mainGoal && (
                      <>
                        <span className="font-bold text-amber-600 block mb-1">MAIN GOAL:</span>
                        <p className="italic leading-tight mb-3 text-xs">{latestNode.mainGoal}</p>
                      </>
                    )}
                    {latestNode?.sideGoalsLog && latestNode.sideGoalsLog.length > 0 && (
                      <>
                        <span className="font-bold text-orange-600 block mb-1">SIDE GOALS:</span>
                        <ul className="list-none space-y-1 mb-3 text-xs font-bold">
                          {latestNode.sideGoalsLog.slice(0, 4).map((sg, i) => (
                             <li key={i} className="leading-tight">
                               {sg.kind === 'completed' ? '✓' : '○'} {sg.label}
                             </li>
                          ))}
                        </ul>
                      </>
                    )}
                    <span className="font-bold">Current Quest:</span>
                    <p className="italic leading-tight">{character.currentQuest}</p>
                  </div>
                )}
              </div>

              <div className="bg-white border-[4px] border-black shadow-[6px_6px_0_0_#000]">
                <button 
                  onClick={() => setIsSatchelSidebarOpen(!isSatchelSidebarOpen)}
                  className="w-full flex justify-between items-center p-3 font-manga-sfx uppercase tracking-widest hover:bg-gray-100 transition-colors"
                >
                  <span className="text-xl">Satchel</span>
                  {isSatchelSidebarOpen ? <ChevronDown className="w-5 h-5"/> : <ChevronUp className="w-5 h-5"/>}
                </button>
                {isSatchelSidebarOpen && (
                  <div className="p-4 pt-3 border-t-2 border-dashed border-gray-300">
                    <ul className="list-disc pl-4 text-sm font-bold leading-tight mb-2">
                      {(character.inventory || []).slice(0, 5).map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                    {(character.inventory || []).length > 5 && (
                      <button onClick={() => setIsInventoryModalOpen(true)} className="mb-2 text-xs italic underline font-bold tracking-wider hover:text-blue-600 block">
                        + VIEW MORE ({(character.inventory || []).length - 5} hidden)
                      </button>
                    )}
                  </div>
                )}
              </div>
                
              {character.relationships && character.relationships.length > 0 && (
                <div className="bg-white border-[4px] border-black shadow-[6px_6px_0_0_#000]">
                  <button 
                    onClick={() => setIsBondsSidebarOpen(!isBondsSidebarOpen)}
                    className="w-full flex justify-between items-center p-3 font-manga-sfx uppercase tracking-widest hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-xl">Bonds</span>
                    {isBondsSidebarOpen ? <ChevronDown className="w-5 h-5"/> : <ChevronUp className="w-5 h-5"/>}
                  </button>
                  {isBondsSidebarOpen && (
                    <div className="p-4 pt-3 border-t-2 border-dashed border-gray-300">
                      <ul className="space-y-1 mb-2 text-sm font-bold uppercase leading-tight">
                        {character.relationships.slice(0, 4).map((rel, i) => (
                           <li key={i} className="flex justify-between border-b border-gray-200 pb-1">
                             <span>{rel.npc}</span>
                             <span className={rel.affinity > 0 ? "text-green-600" : rel.affinity < 0 ? "text-red-500" : "text-gray-500"}>
                               {rel.affinity > 0 ? '+' : ''}{rel.affinity}
                             </span>
                           </li>
                        ))}
                      </ul>
                      {character.relationships.length > 4 && (
                        <button onClick={() => setIsBondsModalOpen(true)} className="mb-2 text-xs italic underline font-bold tracking-wider hover:text-blue-600 flex justify-start w-full">
                          + VIEW MORE ({character.relationships.length - 4} hidden)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-white border-[4px] border-black p-3 shadow-[6px_6px_0_0_#000]">
                <div className="flex justify-between gap-2">
                  <button onClick={onOpenSettings} className="flex-1 bg-gray-100 hover:bg-gray-200 border-2 border-black font-manga-text font-bold uppercase py-2 flex justify-center items-center gap-2 transition-colors">
                    <Settings className="w-4 h-4" /> Settings
                  </button>
                  <button onClick={onReturnToMenu} className="flex-1 bg-red-100 hover:bg-red-200 border-2 border-black font-manga-text font-bold uppercase py-2 flex justify-center items-center gap-2 transition-colors text-red-700">
                    <Home className="w-4 h-4" /> Menu
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Lightbox for Sidebar Avatar */}
      <AnimatePresence>
        {isLightboxOpen && character.avatarUrl && (
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
              src={character.avatarUrl} 
              alt="Avatar Fullsize" 
              className="max-w-full max-h-[90vh] border-4 border-white object-contain shadow-2xl scale-[1.02] hover:scale-100 transition-transform" 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Inventory Modal */}
      <AnimatePresence>
        {isInventoryModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white border-[6px] border-black p-6 md:p-8 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-[12px_12px_0_0_#FFF]"
            >
              <div className="flex justify-between items-center mb-6 border-b-4 border-black pb-2">
                <h2 className="font-manga-sfx text-3xl text-black uppercase tracking-widest drop-shadow-[2px_2px_0_#FFF]">Full Satchel</h2>
                <button onClick={() => setIsInventoryModalOpen(false)} className="bg-red-500 border-2 border-black p-2 text-white hover:bg-red-600 shadow-[4px_4px_0_0_#000]">
                  <X />
                </button>
              </div>
              <ul className="list-disc pl-6 py-2 space-y-2 text-lg font-manga-text font-bold uppercase text-black">
                {character.inventory?.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
                {(!character.inventory || character.inventory.length === 0) && (
                  <li className="list-none italic opacity-50">Empty</li>
                )}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Bonds Modal */}
      <AnimatePresence>
        {isBondsModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white border-[6px] border-black p-6 md:p-8 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-[12px_12px_0_0_#FFF]"
            >
              <div className="flex justify-between items-center mb-6 border-b-4 border-black pb-2">
                <h2 className="font-manga-sfx text-3xl text-black uppercase tracking-widest drop-shadow-[2px_2px_0_#FFF]">All Bonds</h2>
                <button onClick={() => setIsBondsModalOpen(false)} className="bg-red-500 border-2 border-black p-2 text-white hover:bg-red-600 shadow-[4px_4px_0_0_#000]">
                  <X />
                </button>
              </div>
              <ul className="space-y-3 py-2 text-lg font-manga-text font-bold uppercase text-black">
                {character.relationships?.map((rel, i) => (
                  <li key={i} className="flex justify-between items-center border-b-2 border-dashed border-gray-300 pb-2">
                    <span className="text-xl">{rel.npc}</span>
                    <span className={`text-2xl ${rel.affinity > 0 ? "text-green-600" : rel.affinity < 0 ? "text-red-500" : "text-gray-500"}`}>
                      {rel.affinity > 0 ? '+' : ''}{rel.affinity}
                    </span>
                  </li>
                ))}
                {(!character.relationships || character.relationships.length === 0) && (
                  <li className="list-none italic opacity-50">No bonds formed yet</li>
                )}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-10 left-1/2 z-50 bg-white border-4 border-black px-6 py-3 font-manga-text font-bold text-black uppercase tracking-widest shadow-[6px_6px_0_0_#FBBF24]"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
