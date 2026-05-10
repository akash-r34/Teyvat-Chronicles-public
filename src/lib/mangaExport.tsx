import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import { paginate } from './mangaPagination';
import { Character, StoryNode } from '../types';
import { MangaCoverPage } from '../components/manga-export/MangaCoverPage';
import { MangaTOCPage } from '../components/manga-export/MangaTOCPage';
import { MangaRosterPage } from '../components/manga-export/MangaRosterPage';
import { MangaBookPage } from '../components/manga-export/MangaBookPage';
import { MangaEpiloguePage } from '../components/manga-export/MangaEpiloguePage';

interface ExportOptions {
    title: string;
    includeCover: boolean;
    includeTOC: boolean;
    includeRoster: boolean;
    includeEpilogue: boolean;
    qualityMultiplier: number;
}

interface ExportMangaProps {
    history: StoryNode[];
    character: Character;
    saveName: string;
    options: ExportOptions;
    onProgress: (progress: { done: number, total: number }) => void;
}

const preloadImages = async (urls: string[]) => {
    const uniqueUrls = Array.from(new Set(urls)).filter(Boolean);
    const promises = uniqueUrls.map(url => new Promise((resolve) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = resolve; // resolve on error so we don't hang
        img.src = url;
    }));
    await Promise.all(promises);
}

export async function exportMangaPdf({ history, character, saveName, options, onProgress }: ExportMangaProps) {
    const pagesList = paginate(history, options);
    
    // total pages is dynamic based on includes
    let totalPages = pagesList.length;
    if (options.includeCover) totalPages++;
    if (options.includeTOC) totalPages++;
    if (options.includeRoster) totalPages++;
    if (options.includeEpilogue) totalPages++;

    const imageUrls = history.map(n => n.imageUrl).filter(Boolean) as string[];
    if (character.avatarUrl) imageUrls.push(character.avatarUrl);
    
    await preloadImages(imageUrls);
    if (document.fonts) await document.fonts.ready;

    const container = document.createElement('div');
    Object.assign(container.style, { position: 'fixed', left: '-10000px', top: '0', width: '1240px', height: '1754px', zIndex: -9999 });
    document.body.appendChild(container);
    
    const root = ReactDOMClient.createRoot(container);
    const pdf = new jsPDF({ unit: 'px', format: [1240, 1754], orientation: 'p' });
    
    let currentIndex = 0;
    
    let captureEl: HTMLElement | null = null;
    
    const renderAndAddPage = async (Component: React.ReactElement, isCover = false) => {
        await new Promise<void>(resolve => {
            root.render(
                <div 
                    style={{ width: '1240px', height: '1754px', position: 'relative', overflow: 'hidden' }}
                    ref={(el) => { 
                        if (el) {
                            captureEl = el;
                            setTimeout(resolve, 300);
                        }
                    }}
                >
                    {Component}
                </div>
            );
        });
        
        await new Promise(r => requestAnimationFrame(r));
        if (!captureEl) return;
        
        const dataUrl = await (isCover 
            ? toPng(captureEl, { width: 1240, height: 1754, backgroundColor: '#ffffff', pixelRatio: options.qualityMultiplier }) 
            : toJpeg(captureEl, { width: 1240, height: 1754, backgroundColor: '#ffffff', quality: 0.85, pixelRatio: options.qualityMultiplier })
        );
        
        if (currentIndex > 0) pdf.addPage();
        pdf.addImage(dataUrl, isCover ? 'PNG' : 'JPEG', 0, 0, 1240, 1754);
        
        currentIndex++;
        onProgress({ done: currentIndex, total: totalPages });
        await new Promise(r => setTimeout(r, 50)); // let GC run
    }

    try {
        if (options.includeCover) {
            await renderAndAddPage(<MangaCoverPage title={options.title} character={character} firstImage={pagesList[0]?.nodes[0]?.imageUrl} />, true);
        }
        
        if (options.includeTOC) {
            await renderAndAddPage(<MangaTOCPage pages={pagesList} />);
        }
        
        if (options.includeRoster) {
            await renderAndAddPage(<MangaRosterPage character={character} history={history} />);
        }
        
        for (const page of pagesList) {
            await renderAndAddPage(<MangaBookPage page={page} />);
        }
        
        if (options.includeEpilogue) {
            const finalPageNum = pagesList.length > 0 ? pagesList[pagesList.length - 1].pageNumber + 1 : 4;
            await renderAndAddPage(<MangaEpiloguePage character={character} history={history} pageNumber={finalPageNum} />);
        }

        pdf.save(`${saveName}.pdf`);
    } finally {
        root.unmount(); 
        container.remove();
    }
}
