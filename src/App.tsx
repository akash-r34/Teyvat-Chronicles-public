import React, { useState, useEffect } from 'react';
import { GameState, Character, StoryNode } from './types';
import TitleScreen from './components/TitleScreen';
import LoadGameScreen from './components/LoadGameScreen';
import CharacterCreation from './components/CharacterCreation';
import AvatarReveal from './components/AvatarReveal';
import GameChat from './components/GameChat';
import AudioManager from './components/AudioManager';
import AudioSettingsModal from './components/AudioSettingsModal';
import { ExportMangaModal } from './components/manga-export/ExportMangaModal';
import { VoicePrefs } from './services/voice';

interface ExtendedGameState extends GameState {
  loadedHistory?: StoryNode[];
}

export default function App() {
  const [state, setState] = useState<ExtendedGameState & { status: 'title' | 'load' | 'creation' | 'reveal' | 'playing' }>({
    character: null,
    history: [],
    status: 'title', 
  });

  const [musicVol, setMusicVol] = useState(0.5);
  const [sfxVol, setSfxVol] = useState(0.5);
  const [voicePrefs, setVoicePrefs] = useState<VoicePrefs>(() => {
    try {
      const stored = localStorage.getItem('genshinVoicePrefs');
      if (stored) return JSON.parse(stored);
    } catch(e) {}
    return { enabled: false, volume: 0.8, mode: 'dialogue-only' };
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasSaveGame, setHasSaveGame] = useState(false);
  const [exportTarget, setExportTarget] = useState<{ history: StoryNode[], character: Character, saveName: string } | null>(null);
  const [loadMode, setLoadMode] = useState<'load' | 'export'>('load');

  useEffect(() => {
    localStorage.setItem('genshinVoicePrefs', JSON.stringify(voicePrefs));
  }, [voicePrefs]);

  useEffect(() => {
    fetch('/api/saves')
      .then(r => r.json())
      .then(d => {
        if (d && d.length > 0) setHasSaveGame(true);
        else setHasSaveGame(false);
      }).catch(e => setHasSaveGame(false));
  }, [state.status]); // Refresh when returning to menu

  const handleNewGame = () => setState({ character: null, history: [], status: 'creation' });
  const handleOpenLoad = () => { setLoadMode('load'); setState({ ...state, status: 'load' }); };
  const handleOpenExportPicker = () => { setLoadMode('export'); setState({ ...state, status: 'load' }); };
  
  const handleLoadGame = async (saveId: string) => {
    try {
      const res = await fetch(`/api/saves/${saveId}/load`, { method: 'POST' });
      if (!res.ok) {
         const err = await res.json();
         alert("Load failed: " + err.error);
         return;
      }
      const data = await res.json();
      
      const charRes = await fetch(`/api/session/${data.sessionId}/character`);
      const char = await charRes.json();
      
      if (loadMode === 'export') {
         setExportTarget({ history: data.history, character: char, saveName: `Save_${saveId}` });
         // Go back to title
         setState({ ...state, status: 'title' });
         return;
      }

      localStorage.setItem('genshinMangaSession', JSON.stringify({ sessionId: data.sessionId }));
      setState({
        character: char,
        history: data.history,
        loadedHistory: data.history,
        status: 'playing'
      });
    } catch (e: any) {
        alert("Load failed: " + e.message);
    }
  };

  const handleReturnToMenu = () => {
    setState({ character: null, history: [], status: 'title' });
  };

  const handleCharacterCreated = (char: Character) => {
    setState({
      ...state,
      character: char,
      status: 'reveal'
    });
  };

  const handleAvatarConfirmed = (char: Character) => {
    setState({
      ...state,
      character: char,
      status: 'playing'
    });
  };

  return (
    <div className="min-h-screen bg-black overflow-hidden selection:bg-yellow-400/30">
      <AudioManager 
        currentNode={state.history[state.history.length - 1]} 
        location={state.character?.location}
        musicVolume={musicVol} 
        sfxVolume={sfxVol} 
      />
      
      <AudioSettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        musicVol={musicVol} 
        setMusicVol={setMusicVol} 
        sfxVol={sfxVol} 
        setSfxVol={setSfxVol}
        voicePrefs={voicePrefs}
        setVoicePrefs={setVoicePrefs}
      />

      {exportTarget && (
        <ExportMangaModal
          isOpen={true}
          onClose={() => setExportTarget(null)}
          character={exportTarget.character}
          history={exportTarget.history}
          saveName={exportTarget.saveName}
        />
      )}

      {state.status === 'title' && (
        <TitleScreen 
          onNewGame={handleNewGame} 
          onLoadGame={handleOpenLoad} 
          onOpenSettings={() => setIsSettingsOpen(true)} 
          onExportManga={handleOpenExportPicker}
          hasSaveGame={hasSaveGame} 
        />
      )}

      {state.status === 'load' && (
        <LoadGameScreen 
          onBack={handleReturnToMenu}
          onLoad={handleLoadGame}
          onExportSave={(saveId) => { setLoadMode('export'); handleLoadGame(saveId); }}
          exportMode={loadMode === 'export'}
        />
      )}

      {state.status === 'creation' && (
        <CharacterCreation 
          onComplete={handleCharacterCreated} 
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}
      
      {state.status === 'reveal' && state.character && (
        <AvatarReveal
          character={state.character}
          onConfirm={handleAvatarConfirmed}
        />
      )}
      
      {state.status === 'playing' && state.character && (
        <GameChat 
          character={state.character} 
          loadedHistory={state.loadedHistory} 
          onOpenSettings={() => setIsSettingsOpen(true)}
          onReturnToMenu={handleReturnToMenu}
          onExport={(history, saveName) => setExportTarget({ history, character: state.character!, saveName })}
          voicePrefs={voicePrefs}
          setVoicePrefs={setVoicePrefs}
        />
      )}
    </div>
  );
}
