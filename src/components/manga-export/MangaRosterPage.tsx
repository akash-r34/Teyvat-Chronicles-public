import React from 'react';
import { Character, StoryNode } from '../../types';

interface Props {
  character: Character;
  history: StoryNode[];
}

export const MangaRosterPage: React.FC<Props> = ({ character, history }) => {
  
  // Extract unique encountered characters
  const metNPCs = new Set<string>();
  history.forEach(node => {
    node.relationshipDelta?.forEach(rel => {
       if (rel.npc) metNPCs.add(rel.npc);
    });
    if (node.speaker && node.speaker !== 'System' && node.speaker !== 'Narrator' && node.speaker !== character.name) {
       metNPCs.add(node.speaker);
    }
  });

  const npcList = Array.from(metNPCs);

  return (
    <div className="relative w-[1240px] h-[1754px] bg-white border-[16px] border-black p-20 flex flex-col font-manga-text overflow-hidden halftone-bg text-black">
      <h1 className="text-[80px] font-manga-sfx font-black uppercase text-center bg-black text-white p-6 mb-16 rotate-[-2deg] shadow-[12px_12px_0_0_rgba(255,255,255,1)] outline outline-[8px] outline-black">
        Character Roster
      </h1>

      <div className="grid grid-cols-2 gap-12">
        {/* Protagonist Spot */}
        <div className="col-span-2 flex items-center bg-white border-[8px] border-black p-8 shadow-[16px_16px_0_0_#000] rotate-[1deg] mb-12">
           <div className="w-56 h-56 bg-gray-200 border-8 border-black rounded-full overflow-hidden shrink-0">
               {character.avatarUrl && (
                  <img src={character.avatarUrl} alt={character.name} className="w-full h-full object-cover filter grayscale" />
               )}
           </div>
           <div className="ml-12 flex-1">
             <h2 className="text-5xl font-manga-dialogue font-black">{character.name}</h2>
             <p className="text-3xl font-bold mt-4 uppercase tracking-widest bg-black text-white inline-block px-4 py-2">The Traveler</p>
           </div>
        </div>

        {/* NPCs */}
        {npcList.slice(0, 8).map((npc, i) => (
          <div key={i} className="flex items-center bg-white border-[6px] border-black p-4 shadow-[8px_8px_0_0_#000] rotate-[-1deg]">
             <div className="w-32 h-32 bg-gray-900 overflow-hidden shrink-0 border-4 border-black halftone-bg opacity-30">
             </div>
             <div className="ml-6 flex-1">
                <h3 className="text-4xl font-manga-dialogue font-black uppercase leading-none">{npc}</h3>
                <p className="text-xl mt-2">Met on journey</p>
             </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-8 right-12 z-30 bg-white border-4 border-black px-6 py-2 font-manga-sfx text-5xl font-black text-black shadow-[4px_4px_0_0_#000] rotate-[-2deg]">
        3
      </div>
    </div>
  );
};
