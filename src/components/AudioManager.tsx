import React, { useEffect, useRef, useState } from 'react';
import { StoryNode } from '../types';
import { setUiSfxVolume } from '../services/uiAudio';

const bgmUrls: Record<string, string> = {
  peaceful: '/audio/bgm/peaceful_town.mp3',
  market:   '/audio/bgm/market.mp3',
  heroic:   '/audio/bgm/heroic.mp3',
  mystery:  '/audio/bgm/mystery.mp3',
  dungeon:  '/audio/bgm/dungeon.mp3',
  battle:   '/audio/bgm/battle_jrpg_loop.mp3',
  boss:     '/audio/bgm/boss.mp3',
  none:     '',
  stop:     '',
  // legacy aliases
  normal:   '/audio/bgm/peaceful_town.mp3',
  serious:  '/audio/bgm/dungeon.mp3',
};

const sfxUrls: Record<string, string> = {
  none:              '',
  sword_swing:       '/audio/sfx/sword_swing.ogg',
  sword_unsheathe:   '/audio/sfx/sword_unsheathe.ogg',
  magic_cast:        '/audio/sfx/magic_cast.ogg',
  impact_hit:        '/audio/sfx/impact_hit.ogg',
  explosion:         '/audio/sfx/explosion.ogg',
  page_turn:         '/audio/sfx/page_turn.ogg',
  dramatic_sting:    '/audio/sfx/dramatic_sting.ogg',
  // legacy aliases
  combat:            '/audio/sfx/sword_swing.ogg',
  magic:             '/audio/sfx/magic_cast.ogg',
};

const regionDefaultBgm: Record<string, string> = {
  Mondstadt: 'peaceful',
  Liyue:     'market',
  Inazuma:   'mystery',
  Sumeru:    'mystery',
  Fontaine:  'heroic',
  Natlan:    'battle',
  Snezhnaya: 'dungeon',
};

export default function AudioManager({ 
  currentNode, 
  location,
  musicVolume, 
  sfxVolume 
}: { 
  currentNode?: StoryNode; 
  location?: string;
  musicVolume: number; 
  sfxVolume: number;
}) {
  const bgmRef = useRef<HTMLAudioElement>(null);
  const sfxRef = useRef<HTMLAudioElement>(null);
  const currentBgmUrl = useRef<string>("");
  const fadeAnimationRef = useRef<number | null>(null);
  
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    const handleInteraction = () => setInteracted(true);
    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('touchstart', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  useEffect(() => {
    if (bgmRef.current && !fadeAnimationRef.current) bgmRef.current.volume = musicVolume;
    if (sfxRef.current) sfxRef.current.volume = sfxVolume;
    setUiSfxVolume(sfxVolume);
  }, [musicVolume, sfxVolume]);

  useEffect(() => {
    if (!bgmRef.current || !interacted) return;
    
    const targetBgmKey = currentNode?.bgmMood || (location ? regionDefaultBgm[location] : null) || 'peaceful';
    const targetBgm = bgmUrls[targetBgmKey] ?? bgmUrls.peaceful;
    
    if (currentBgmUrl.current !== targetBgm) {
      if (bgmRef.current.src && bgmRef.current.volume > 0 && !bgmRef.current.paused) {
        if (fadeAnimationRef.current) cancelAnimationFrame(fadeAnimationRef.current);
        const startVol = bgmRef.current.volume;
        const fadeStart = performance.now();
        const fadeDuration = 500;
        const fadeOut = (time: number) => {
          const elapsed = time - fadeStart;
          const progress = Math.min(elapsed / fadeDuration, 1);
          if (bgmRef.current) {
            bgmRef.current.volume = startVol * (1 - progress);
          }
          if (progress < 1) {
            fadeAnimationRef.current = requestAnimationFrame(fadeOut);
          } else {
            fadeAnimationRef.current = null;
            if (bgmRef.current) {
              currentBgmUrl.current = targetBgm;
              if (targetBgm) {
                bgmRef.current.src = targetBgm;
                bgmRef.current.volume = musicVolume;
                if (musicVolume > 0) {
                  bgmRef.current.play().catch(e => console.warn('BGM AutoPlay Blocked:', e));
                }
              } else {
                bgmRef.current.pause();
                bgmRef.current.removeAttribute('src');
              }
            }
          }
        };
        fadeAnimationRef.current = requestAnimationFrame(fadeOut);
      } else {
        currentBgmUrl.current = targetBgm;
        if (targetBgm) {
          bgmRef.current.src = targetBgm;
          bgmRef.current.volume = musicVolume;
          if (musicVolume > 0) {
            bgmRef.current.play().catch(e => console.warn('BGM AutoPlay Blocked:', e));
          }
        } else {
          bgmRef.current.pause();
          bgmRef.current.removeAttribute('src');
        }
      }
    } else if (bgmRef.current.paused && musicVolume > 0 && !fadeAnimationRef.current) {
      bgmRef.current.play().catch(e => console.warn('BGM Play Blocked:', e));
    }
  }, [currentNode, location, interacted, musicVolume]); 

  useEffect(() => {
    if (!sfxRef.current || !currentNode || !interacted) return;
    
    if (currentNode.sfxAction && currentNode.sfxAction !== 'none' && sfxVolume > 0) {
       const clip = sfxUrls[currentNode.sfxAction as keyof typeof sfxUrls];
       if (clip) {
         setTimeout(() => {
           if (sfxRef.current) {
             if (!sfxRef.current.src || !sfxRef.current.src.endsWith(clip)) {
               sfxRef.current.src = clip;
             }
             sfxRef.current.currentTime = 0;
             sfxRef.current.play().catch(e => console.warn('SFX AutoPlay Blocked:', e));
           }
         }, 250);
       }
    }
  }, [currentNode, interacted, sfxVolume]);
  
  return (
    <>
      <audio ref={bgmRef} loop preload="auto" src={bgmUrls.peaceful} />
      <audio ref={sfxRef} />
    </>
  );
}
