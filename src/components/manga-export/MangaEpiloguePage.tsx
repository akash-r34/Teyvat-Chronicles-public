import React from 'react';
import { Character, StoryNode } from '../../types';

interface Props {
  character: Character;
  history: StoryNode[];
  pageNumber: number;
}

export const MangaEpiloguePage: React.FC<Props> = ({ character, history, pageNumber }) => {
  const turnCount = history.length;
  
  const collectItems = new Set<string>();
  history.forEach(n => {
    n.itemGained?.forEach(i => collectItems.add(i.name));
  });

  const flagsSetCount = history.filter(n => n.flagsSet && n.flagsSet.length > 0).length;

  return (
    <div className="relative w-[1240px] h-[1754px] bg-black border-[16px] border-white p-24 flex flex-col font-manga-text text-white">
      <h1 className="text-[120px] font-manga-sfx font-black uppercase text-center mb-24 rotate-[2deg] drop-shadow-[8px_8px_0_#333]">
        Epilogue Stats
      </h1>

      <div className="grid grid-cols-2 gap-16 text-4xl">
         <div className="bg-white text-black border-[8px] border-gray-400 p-12 shadow-[12px_12px_0_0_#333] rotate-[-2deg]">
             <h3 className="font-manga-dialogue font-black text-6xl mb-6">Turns Taken</h3>
             <p className="text-[100px] font-manga-sfx translate-y-2">{turnCount}</p>
         </div>

         <div className="bg-white text-black border-[8px] border-gray-400 p-12 shadow-[12px_12px_0_0_#333] rotate-[1deg]">
             <h3 className="font-manga-dialogue font-black text-6xl mb-6">Items Found</h3>
             <p className="text-[100px] font-manga-sfx translate-y-2">{collectItems.size}</p>
         </div>

         <div className="bg-white text-black border-[8px] border-gray-400 p-12 shadow-[12px_12px_0_0_#333] rotate-[3deg]">
             <h3 className="font-manga-dialogue font-black text-6xl mb-6">Key Events</h3>
             <p className="text-[100px] font-manga-sfx translate-y-2">{flagsSetCount}</p>
         </div>

         <div className="bg-white text-black border-[8px] border-gray-400 p-12 shadow-[12px_12px_0_0_#333] rotate-[-1deg]">
             <h3 className="font-manga-dialogue font-black text-6xl mb-6">Final Health</h3>
             <p className="text-[100px] font-manga-sfx translate-y-2">{character.hp} HP</p>
         </div>
      </div>

       <div className="absolute bottom-16 w-full left-0 text-center text-4xl font-manga-dialogue uppercase tracking-widest text-gray-500">
           The End.
       </div>

       <div className="absolute bottom-8 right-12 z-30 bg-white border-4 border-black px-6 py-2 font-manga-sfx text-5xl font-black text-black shadow-[4px_4px_0_0_#000] rotate-[-2deg]">
        {pageNumber}
      </div>
    </div>
  );
};
