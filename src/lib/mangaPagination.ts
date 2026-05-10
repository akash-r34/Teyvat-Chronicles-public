export type PageLayout =
  | 'splash'         // 1 panel, full bleed
  | 'two-row'        // 2 stacked
  | 'two-vertical'   // 2 side-by-side
  | 'three-L-right'  // big left + 2 stacked right
  | 'three-L-left'   // mirrored
  | 'four-grid';     // 2x2

export interface MangaPage {
  layout: PageLayout;
  nodes: import('../types').StoryNode[];
  chapterStart?: { num: number; title: string };
  pageNumber: number;
}

export function paginate(history: import('../types').StoryNode[], options: any): MangaPage[] {
  const pages: MangaPage[] = [];
  let pageNumber = 4; // Cover, TOC, Roster. So chapter 1 starts at page 4.
  let chapterNum = 0;
  
  let i = 0;
  while (i < history.length) {
    const isChapterStart = i === 0 || history[i - 1]?.mainGoalComplete || (i > 0 && i % 25 === 0);
    
    let chapterStartInfo;
    if (isChapterStart) {
      chapterNum++;
      const node = history[i];
      chapterStartInfo = { num: chapterNum, title: node.mainGoal || `Chapter ${chapterNum}` };
    }

    const chunkLen = Math.min(2, history.length - i);
    const chunk = history.slice(i, i + chunkLen);
    
    pages.push({
      layout: 'two-row',
      nodes: chunk,
      chapterStart: chapterStartInfo,
      pageNumber: pageNumber++
    });
    
    i += chunkLen;
  }

  return pages;
}
