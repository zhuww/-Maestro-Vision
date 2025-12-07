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
  const [systemStyle, setSystemStyle] = useState<React.CSSProperties>({ display: 'none' });

  useEffect(() => {
    // Hide cursor if not playing or if indexes are invalid
    if (!isPlaying || !page.data || currentSystemIndex < 0) {
      setCursorStyle({ display: 'none' });
      setSystemStyle({ display: 'none' });
      return;
    }

    const system = page.data.systems[currentSystemIndex];
    if (!system) return;

    // --- 1. System Highlight (The Horizontal Bar) ---
    const sysTop = system.yTop * 100;
    const sysHeight = (system.yBottom - system.yTop) * 100;

    setSystemStyle({
        position: 'absolute',
        left: '0%',
        width: '100%',
        top: `${sysTop}%`,
        height: `${sysHeight}%`,
        backgroundColor: 'rgba(59, 130, 246, 0.1)', // Light blue tint
        borderTop: '1px solid rgba(59, 130, 246, 0.2)', // Subtle borders
        borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
        transition: 'top 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), height 0.4s ease',
        pointerEvents: 'none',
        zIndex: 5
    });

    // --- 2. Note Cursor (The Vertical Line) ---
    // Use current note if available
    const note: ParsedNote | undefined = system.notes[currentNoteIndex];
    
    if (note) {
      const leftPct = note.x * 100;

      setCursorStyle({
        position: 'absolute',
        left: `${leftPct}%`,
        top: `${sysTop}%`, // Align top with system
        height: `${sysHeight}%`, // Align height with system
        width: '4px',
        backgroundColor: '#60a5fa', // Brighter blue for the cursor
        boxShadow: '0 0 12px 2px rgba(96, 165, 250, 0.6)', // Glow effect
        borderRadius: '2px',
        transform: 'translateX(-50%)',
        transition: 'left 0.1s linear, top 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
        display: 'block',
        zIndex: 10
      });
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
    <div ref={containerRef} className="relative w-full rounded-lg overflow-hidden bg-white shadow-xl group">
      {/* The Sheet Music Image */}
      <img 
        src={page.imageUrl} 
        alt="Sheet Music" 
        className="w-full h-auto block select-none"
        draggable={false}
      />
      
      {/* Overlays */}
      {page.data && (
        <>
            {/* Measure Lines for all systems */}
            {page.data.systems.map((sys, idx) => (
                <React.Fragment key={idx}>
                    {sys.measureLines?.map((mx, mIdx) => (
                         <div 
                            key={`m-${idx}-${mIdx}`}
                            style={{
                                position: 'absolute',
                                left: `${mx * 100}%`,
                                top: `${sys.yTop * 100}%`,
                                height: `${(sys.yBottom - sys.yTop) * 100}%`,
                                width: '1px',
                                backgroundColor: 'rgba(245, 158, 11, 0.4)', // Amber tint
                                zIndex: 4,
                                pointerEvents: 'none'
                            }}
                         />
                    ))}
                </React.Fragment>
            ))}

            <div style={systemStyle}></div>
            <div style={cursorStyle}></div>
        </>
      )}
    </div>
  );
};

export default SheetDisplay;