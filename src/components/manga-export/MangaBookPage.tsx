import React from 'react';
import MangaPanel from '../MangaPanel';
import { MangaPage } from '../../lib/mangaPagination';

interface Props {
  page: MangaPage;
}

export const MangaBookPage: React.FC<Props> = ({ page }) => {
  const getGridClass = () => {
    switch (page.layout) {
      case 'splash': return 'grid-cols-1 grid-rows-1';
      case 'two-row': return 'grid-cols-1 grid-rows-2 gap-8';
      case 'two-vertical': return 'grid-cols-2 grid-rows-1 gap-8';
      case 'three-L-right': return 'grid-cols-2 grid-rows-2 gap-8';
      case 'three-L-left': return 'grid-cols-2 grid-rows-2 gap-8';
      case 'four-grid': return 'grid-cols-2 grid-rows-2 gap-8';
      default: return 'grid-cols-1 grid-rows-1';
    }
  };

  const getCellClass = (index: number) => {
    if (page.layout === 'three-L-right' && index === 0) return 'row-span-2 col-span-1';
    if (page.layout === 'three-L-left' && index === 0) return 'row-span-2 col-span-1 order-last';
    return '';
  };

  return (
    <div className="relative w-full h-[1754px] bg-white border-[16px] border-black p-12 pb-32 flex flex-col font-manga-text overflow-hidden halftone-bg">
      {page.chapterStart && (
        <div className="w-full mb-8 relative z-30">
          <h2 className="text-4xl font-manga-dialogue font-black text-black bg-white inline-block px-4 py-2 border-4 border-black shadow-[4px_4px_0_0_#000]">
             Chapter {page.chapterStart.num} - {page.chapterStart.title}
          </h2>
        </div>
      )}

      <div className={`grid ${getGridClass()} flex-1 h-full relative z-20`}>
        {page.nodes.map((node, i) => (
          <div key={node.id} className={`${getCellClass(i)} h-full w-full shadow-[8px_8px_0_0_#000] rotate-[-0.5deg] scale-[0.99] border-black bg-white`}>
            <MangaPanel 
              node={node} 
              isLatest={false} 
              variant={page.layout === 'splash' ? 'splash' : 'compact'} 
            />
          </div>
        ))}
      </div>

      <div className="absolute bottom-8 right-12 z-30 bg-white border-4 border-black px-6 py-2 font-manga-sfx text-5xl font-black text-black shadow-[4px_4px_0_0_#000] rotate-[-2deg]">
        {page.pageNumber}
      </div>
    </div>
  );
};
