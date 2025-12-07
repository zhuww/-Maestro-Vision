import React from 'react';

interface ControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  tempo: number;
  onTempoChange: (val: number) => void;
  disabled: boolean;
  loading: boolean;
}

const Controls: React.FC<ControlsProps> = ({ 
  isPlaying, 
  onPlayPause, 
  onStop, 
  tempo, 
  onTempoChange,
  disabled,
  loading
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-950/90 backdrop-blur-md border-t border-gray-800 p-4 pb-6 z-50">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        
        {/* Playback Buttons */}
        <div className="flex items-center gap-3">
          <button 
            onClick={onPlayPause}
            disabled={disabled}
            className={`h-12 w-12 flex items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-95
              ${disabled 
                ? 'bg-gray-700 cursor-not-allowed' 
                : 'bg-primary-600 hover:bg-primary-500'}`}
          >
             {loading ? (
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
             ) : isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 translate-x-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          <button 
            onClick={onStop}
            disabled={disabled}
            className="h-10 w-10 flex items-center justify-center rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Tempo Control */}
        <div className="flex-1 max-w-sm">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Tempo</span>
            <span>{tempo} BPM</span>
          </div>
          <input
            type="range"
            min="40"
            max="200"
            value={tempo}
            onChange={(e) => onTempoChange(parseInt(e.target.value))}
            disabled={disabled}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
          />
        </div>
      </div>
    </div>
  );
};

export default Controls;