import React from 'react';
import { MangaPage } from '../../lib/mangaPagination';

interface Props {
  pages: MangaPage[];
}

export const MangaTOCPage: React.FC<Props> = ({ pages }) => {
  const chapters = pages.filter(p => p.chapterStart);

  return (
    <div className="relative w-[1240px] h-[1754px] bg-white border-[16px] border-black p-24 flex flex-col font-manga-text halftone-bg">
       <h1 className="text-[100px] font-manga-sfx font-black uppercase mb-20 border-b-[16px] border-black pb-8 text-black border-dashed">
          Table of Contents
       </h1>
       
       <div className="flex flex-col gap-12 mt-12 z-10 w-full flex-grow">
          {chapters.map((chap, idx) => (
             <div key={idx} className="flex justify-between items-baseline w-full text-4xl font-manga-dialogue font-black text-black">
                <span className="shrink-0 mr-8">Ch. {chap.chapterStart?.num} — {chap.chapterStart?.title}</span>
                <span className="flex-grow border-b-8 border-black border-dotted opacity-50 block relative top-[-10px] mx-4"></span>
                <span className="shrink-0 ml-8 text-5xl">p. {chap.pageNumber}</span>
             </div>
          ))}
       </div>

       <div className="absolute bottom-8 right-12 z-30 bg-white border-4 border-black px-6 py-2 font-manga-sfx text-5xl font-black text-black shadow-[4px_4px_0_0_#000] rotate-[-2deg]">
        2
      </div>
    </div>
  );
};
