import React from 'react';
import { Character } from '../../types';

interface Props {
  title: string;
  character: Character;
  firstImage?: string;
}

export const MangaCoverPage: React.FC<Props> = ({ title, character, firstImage }) => {
  return (
    <div className="relative w-[1240px] h-[1754px] bg-white border-[32px] border-black p-12 flex flex-col items-center justify-center font-manga-text overflow-hidden halftone-bg">
      <div className="absolute inset-0 z-0">
         {(firstImage || character.avatarUrl) ? (
            <img 
              src={firstImage || character.avatarUrl} 
              alt="Cover" 
              className="w-full h-full object-cover filter grayscale contrast-125 brightness-75 scale-105 rotate-[1deg]"
              referrerPolicy="no-referrer"
            />
         ) : null}
         <div className="absolute inset-0 bg-black bg-opacity-30 mix-blend-overlay"></div>
      </div>
      
      <div className="relative z-10 w-full flex flex-col items-center top-[-100px]">
        <div className="bg-black text-white text-3xl tracking-widest font-bold uppercase mb-4 px-8 py-2 border-4 border-white rotate-[-3deg] shadow-[8px_8px_0_0_#FFF]">
          A Teyvat Chronicle
        </div>
        
        <h1 className="text-[120px] font-manga-sfx font-black text-white uppercase text-center leading-[0.9] drop-shadow-[0_12px_12px_rgba(0,0,0,0.8)] filter drop-shadow-[12px_12px_0_#000] rotate-[-2deg] bg-black p-4 px-12 border-8 border-white whitespace-pre-wrap break-words">
          {title}
        </h1>
        
        <div className="mt-16 bg-yellow-400 text-black border-8 border-black p-8 rotate-[4deg] shadow-[16px_16px_0_0_#000] w-2/3 flex items-center justify-center">
             <div className="text-4xl font-manga-dialogue font-bold text-center">
                 Starring {character.name}
             </div>
        </div>
      </div>
      
      <div className="absolute bottom-16 right-16 z-20 text-white font-manga-text text-2xl bg-black border-4 border-white px-6 py-2">
         {new Date().toISOString().split('T')[0]}
      </div>
    </div>
  );
};
