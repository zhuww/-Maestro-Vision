import React, { useRef, useEffect, useState } from 'react';
import { SheetPage, ParsedNote } from '../types';

interface SheetDisplayProps {
  page: SheetPage;
  currentSystemIndex: number;
  currentNoteIndex: number;
  isPlaying: boolean;
}

const SheetDisplay: React.FC<SheetDisplayProps> = ({ page, currentSystemIndex, currentNoteIndex, isPlaying }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorStyle, setCursorStyle] = useState<React.CSSProperties>({ display: 'none' });

  useEffect(() => {
    // Hide cursor if not playing or if indexes are invalid
    if (!isPlaying || !page.data || currentSystemIndex < 0) {
      setCursorStyle({ display: 'none' });
      return;
    }

    const system = page.data.systems[currentSystemIndex];
    if (!system) return;

    // Use current note if available
    const note: ParsedNote | undefined = system.notes[currentNoteIndex];
    
    if (note) {
      // Calculate percentages
      const topPct = system.yTop * 100;
      const heightPct = (system.yBottom - system.yTop) * 100;
      const leftPct = note.x * 100;

      setCursorStyle({
        position: 'absolute',
        left: `${leftPct}%`,
        top: `${topPct}%`,
        height: `${heightPct}%`,
        width: '4px',
        backgroundColor: '#3b82f6', // Primary color
        boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)',
        borderRadius: '2px',
        transform: 'translateX(-50%)',
        transition: 'left 0.1s linear, top 0.3s ease',
        display: 'block',
        zIndex: 10
      });

      // Simple scroll into view
      if (containerRef.current) {
        // In a real app we might want to scroll the parent container
      }
    }
  }, [page, currentSystemIndex, currentNoteIndex, isPlaying]);

  if (page.status === 'analyzing') {
    return (
      <div className="aspect-[3/4] w-full bg-gray-900 rounded-lg flex flex-col items-center justify-center animate-pulse border border-gray-800">
        <div className="h-12 w-12 border-4 border-gray-700 border-t-primary-500 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400">Analyzing Sheet Music...</p>
        <p className="text-xs text-gray-600 mt-2">This may take a few seconds</p>
      </div>
    );
  }

  if (page.status === 'error') {
     return (
      <div className="aspect-[3/4] w-full bg-gray-900 rounded-lg flex flex-col items-center justify-center text-red-400 border border-red-900/50">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2 opacity-50" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <p className="font-medium">Analysis Failed</p>
        <p className="text-xs opacity-75 mt-1 max-w-[80%] text-center">{page.errorMsg}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full rounded-lg overflow-hidden bg-white shadow-xl">
      {/* The Sheet Music Image */}
      <img 
        src={page.imageUrl} 
        alt="Sheet Music" 
        className="w-full h-auto block select-none"
        draggable={false}
      />
      
      {/* Overlay Cursor */}
      {page.data && (
        <div style={cursorStyle}></div>
      )}
    </div>
  );
};

export default SheetDisplay;