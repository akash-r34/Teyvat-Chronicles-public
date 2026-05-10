import React from 'react';
import { BookOpen } from 'lucide-react';

interface Props {
   onClick: () => void;
   compact?: boolean;
}

export const ExportMangaButton: React.FC<Props> = ({ onClick, compact = false }) => {
   if (compact) {
       return (
           <button
             onClick={onClick}
             className="w-full flex items-center justify-center space-x-2 bg-yellow-400 text-black py-4 border-t-2 border-black font-bold uppercase tracking-widest text-sm hover:bg-yellow-500 transition-colors shadow-none"
             title="Export Manga Book PDF"
           >
             <BookOpen size={20} />
             <span>Export PDF</span>
           </button>
       );
   }

   return (
       <div className="pointer-events-auto">
           <button
               onClick={onClick}
               className="bg-yellow-400 text-black p-3 md:p-4 rounded-xl shadow-[4px_4px_0px_0px_#000] border-2 border-black hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#000] hover:bg-yellow-500 transition-all active:translate-y-1 active:shadow-[2px_2px_0px_0px_#000] flex items-center space-x-2"
               title="Export Manga Book PDF"
           >
               <BookOpen size={24} className="opacity-80 md:w-6 md:h-6 w-5 h-5" />
               <span className="hidden md:inline font-bold text-sm tracking-wide">Export PDF</span>
           </button>
       </div>
   );
};
