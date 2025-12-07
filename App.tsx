import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Tone from 'https://esm.sh/tone@14.7.77';
import { SheetPage } from './types';
import FileUpload from './components/FileUpload';
import SheetDisplay from './components/SheetDisplay';
import Controls from './components/Controls';
import { analyzeSheetMusic } from './services/geminiService';
import { audioService } from './services/audioService';
import { DEFAULT_TEMPO } from './constants';

const App: React.FC = () => {
  const [pages, setPages] = useState<SheetPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  
  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSystemIndex, setCurrentSystemIndex] = useState(-1);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(-1);
  const [tempo, setTempo] = useState(DEFAULT_TEMPO);
  const [isAudioReady, setIsAudioReady] = useState(false);
  
  // Track the last page ID that was successfully scheduled on the timeline
  const [scheduledUpToPageId, setScheduledUpToPageId] = useState<string | null>(null);

  // Refs for tracking playback state inside callbacks
  const playingRef = useRef(false);
  
  // Initialize Audio Service
  useEffect(() => {
    audioService.initialize().then(() => setIsAudioReady(true));
  }, []);

  // Update Tone.js tempo when state changes
  useEffect(() => {
    audioService.setTempo(tempo);
  }, [tempo]);

  // --- Smart Analysis Queue ---
  // Sequentially processes pending pages, prioritizing current and next page.
  useEffect(() => {
    // 1. Check if any page is currently being analyzed (Limit 1 concurrent analysis)
    const isAnalyzing = pages.some(p => p.status === 'analyzing');
    if (isAnalyzing) return;

    // 2. Determine Priority:
    // Priority A: Current Page
    if (pages[currentPageIndex]?.status === 'pending') {
        processPage(pages[currentPageIndex]);
        return;
    }
    
    // Priority B: Next Page (Buffered)
    if (pages[currentPageIndex + 1]?.status === 'pending') {
        processPage(pages[currentPageIndex + 1]);
        return;
    }

    // Priority C: Any pending page (FIFO)
    const firstPending = pages.find(p => p.status === 'pending');
    if (firstPending) {
        processPage(firstPending);
    }
  }, [pages, currentPageIndex]);

  // --- Dynamic Playback Scheduler ---
  // Watches for pages becoming ready while playing and appends them to the schedule
  useEffect(() => {
      if (!isPlaying || !scheduledUpToPageId) return;

      const scheduledIndex = pages.findIndex(p => p.id === scheduledUpToPageId);
      if (scheduledIndex === -1) return;

      const nextPage = pages[scheduledIndex + 1];
      
      // If the next page exists, is ready, but hasn't been scheduled yet (implied by scheduledUpToPageId check)
      if (nextPage && nextPage.status === 'ready' && nextPage.data) {
          console.log("Dynamically scheduling next page:", nextPage.id);
          const prevEndTime = audioService.getPageEndTime(scheduledUpToPageId);
          
          if (prevEndTime !== undefined) {
              audioService.schedulePage(
                  nextPage,
                  prevEndTime,
                  onNotePlayCallback
              );
              setScheduledUpToPageId(nextPage.id);
          }
      }
  }, [pages, isPlaying, scheduledUpToPageId]);


  const handleFilesSelected = (files: File[]) => {
    // Create page objects with 'pending' status. 
    // The Analysis Queue effect will pick them up.
    const newPages: SheetPage[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      imageUrl: URL.createObjectURL(file),
      file,
      status: 'pending'
    }));

    setPages(prev => [...prev, ...newPages]);
  };

  /**
   * Compresses and resizes an image file to reduce payload size for Gemini API.
   * Target: Max 1024px width/height, JPEG quality 0.8
   */
  const compressImage = async (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const img = new Image();
          const url = URL.createObjectURL(file);
          
          img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_SIZE = 1024; // Resize to max 1024px to prevent payload errors
              let width = img.width;
              let height = img.height;

              if (width > height) {
                  if (width > MAX_SIZE) {
                      height *= MAX_SIZE / width;
                      width = MAX_SIZE;
                  }
              } else {
                  if (height > MAX_SIZE) {
                      width *= MAX_SIZE / height;
                      height = MAX_SIZE;
                  }
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                  URL.revokeObjectURL(url);
                  reject(new Error("Canvas context failed"));
                  return;
              }
              
              ctx.drawImage(img, 0, 0, width, height);
              
              // Export as JPEG with 0.8 quality
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              URL.revokeObjectURL(url);
              resolve(dataUrl);
          };

          img.onerror = () => {
              URL.revokeObjectURL(url);
              reject(new Error("Failed to load image"));
          };
          
          img.src = url;
      });
  };

  const processPage = async (page: SheetPage) => {
    // Mark as analyzing
    setPages(prev => prev.map(p => p.id === page.id ? { ...p, status: 'analyzing' } : p));

    try {
      // Compress image before sending to prevent XHR/Payload errors
      const base64Full = await compressImage(page.file);
      const cleanBase64 = base64Full.split(',')[1];
      
      const analysis = await analyzeSheetMusic(cleanBase64);

      setPages(prev => {
          const updated = prev.map(p => 
            p.id === page.id ? { ...p, status: 'ready', data: analysis } : p
          );
          
          // Auto-set tempo from the first page if available and not yet set
          if (page.id === updated[0].id && analysis.tempo) {
              setTempo(analysis.tempo);
          }
          return updated as SheetPage[];
      });

    } catch (err: any) {
      console.error(err);
      setPages(prev => prev.map(p => 
        p.id === page.id ? { ...p, status: 'error', errorMsg: err.message || 'Analysis failed' } : p
      ));
    }
  };

  const handlePlayPause = async () => {
    if (!isAudioReady) return;

    if (isPlaying) {
      handleStop();
    } else {
      await startPlayback();
    }
  };

  // Define callback outside to be reusable
  const onNotePlayCallback = (pageId: string, sysIdx: number, noteIdx: number) => {
      if (!playingRef.current) return;
      
      // Update active page view logic
      setCurrentPageIndex(prevIndex => prevIndex); 

      // Update cursor
      setCurrentSystemIndex(sysIdx);
      setCurrentNoteIndex(noteIdx);
      
      // Dispatch event for components that need strict sync
      window.dispatchEvent(new CustomEvent('playback-update', { detail: { pageId } }));
  };

  // Listen for page updates from audio thread
  useEffect(() => {
      const handler = (e: Event) => {
          const detail = (e as CustomEvent).detail;
          setPages(currentPages => {
              const idx = currentPages.findIndex(p => p.id === detail.pageId);
              if (idx !== -1 && idx !== currentPageIndex) {
                  setCurrentPageIndex(idx);
              }
              return currentPages;
          });
      };
      window.addEventListener('playback-update', handler);
      return () => window.removeEventListener('playback-update', handler);
  }, [currentPageIndex]);


  const startPlayback = async () => {
    await audioService.startContext();
    
    const startPage = pages[currentPageIndex];
    if (!startPage || startPage.status !== 'ready' || !startPage.data) return;

    setIsPlaying(true);
    playingRef.current = true;
    setScheduledUpToPageId(null);
    
    Tone.Transport.stop();
    Tone.Transport.cancel();
    
    let accumulatedTime = 0;
    let lastScheduledId = null;
    
    // Schedule available contiguous pages starting from current
    for (let i = currentPageIndex; i < pages.length; i++) {
        const p = pages[i];
        if (p.status === 'ready' && p.data) {
            accumulatedTime = audioService.schedulePage(
                p, 
                accumulatedTime, 
                onNotePlayCallback
            );
            lastScheduledId = p.id;
        } else {
            break; 
        }
    }
    
    setScheduledUpToPageId(lastScheduledId);
    audioService.start();
  };

  const handleStop = () => {
    setIsPlaying(false);
    playingRef.current = false;
    setScheduledUpToPageId(null);
    audioService.stop();
    setCurrentSystemIndex(-1);
    setCurrentNoteIndex(-1);
  };

  const handleNextPage = () => {
      if (currentPageIndex < pages.length - 1) {
          handleStop();
          setCurrentPageIndex(prev => prev + 1);
      }
  };
  
  const handlePrevPage = () => {
      if (currentPageIndex > 0) {
          handleStop();
          setCurrentPageIndex(prev => prev - 1);
      }
  };

  const activePage = pages[currentPageIndex];
  const isReady = activePage?.status === 'ready';

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-32">
      {/* Header */}
      <header className="p-6 border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-primary-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                </svg>
             </div>
             <h1 className="text-2xl font-bold tracking-tight">Maestro Vision</h1>
          </div>
          
          {pages.length > 0 && (
             <button 
               onClick={() => {
                   handleStop();
                   setPages([]);
                   setCurrentPageIndex(0);
               }}
               className="text-sm text-gray-400 hover:text-white transition-colors"
             >
               Clear All
             </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        
        {/* Empty State */}
        {pages.length === 0 && (
          <div className="mt-12 space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                Bring your sheet music to life
              </h2>
              <p className="text-gray-400 max-w-lg mx-auto">
                Upload photos of your sheet music. We'll analyze them in the background and play them back seamlessly.
              </p>
            </div>
            <FileUpload onFilesSelected={handleFilesSelected} />
          </div>
        )}

        {/* Player View */}
        {pages.length > 0 && activePage && (
          <div className="space-y-6">
             {/* Pagination / Page Tabs */}
             <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {pages.map((p, idx) => (
                    <button
                        key={p.id}
                        onClick={() => {
                            if (!isPlaying) {
                                setCurrentPageIndex(idx);
                            } else {
                                handleStop();
                                setCurrentPageIndex(idx);
                            }
                        }}
                        className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                            ${idx === currentPageIndex 
                                ? 'bg-gray-800 text-white border border-gray-600' 
                                : 'text-gray-500 hover:text-gray-300'
                            }
                        `}
                    >
                        <span>Page {idx + 1}</span>
                        {p.status === 'analyzing' && <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full" />}
                        {p.status === 'pending' && <span className="text-xs text-gray-600">Wait</span>}
                        {p.status === 'error' && <span className="text-red-500">!</span>}
                    </button>
                ))}
                
                {/* Mini Add Button */}
                <div className="relative overflow-hidden ml-2 flex-shrink-0">
                     <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        onChange={(e) => {
                            if(e.target.files) handleFilesSelected(Array.from(e.target.files));
                        }} 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                    />
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 text-gray-400 transition-colors cursor-pointer border border-gray-700 hover:border-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                </div>
             </div>

             {/* Main Display */}
             <div className="flex justify-between items-start gap-4">
                 <button onClick={handlePrevPage} disabled={currentPageIndex === 0} className="mt-[20%] p-2 text-gray-500 hover:text-white disabled:opacity-0 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                 </button>
                 
                 <div className="flex-1 max-w-[800px] bg-gray-900 rounded-xl p-1">
                     <SheetDisplay 
                        page={activePage} 
                        currentSystemIndex={currentSystemIndex}
                        currentNoteIndex={currentNoteIndex}
                        isPlaying={isPlaying}
                     />
                 </div>
                 
                 <button onClick={handleNextPage} disabled={currentPageIndex === pages.length - 1} className="mt-[20%] p-2 text-gray-500 hover:text-white disabled:opacity-0 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                 </button>
             </div>
          </div>
        )}
      </main>

      <Controls 
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onStop={handleStop}
        tempo={tempo}
        onTempoChange={setTempo}
        disabled={!isReady || !isAudioReady}
        loading={activePage?.status === 'analyzing'}
      />
    </div>
  );
};

export default App;