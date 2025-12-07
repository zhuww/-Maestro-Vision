export interface ParsedNote {
  pitch: string; // e.g., "C4", "G#5"
  duration: string; // e.g., "4n", "8n", "2n"
  x: number; // Normalized horizontal position (0-1) within the system
  startTime?: number; // Calculated start time in seconds
  durationSeconds?: number;
}

export interface ParsedSystem {
  yTop: number; // Normalized Y position of the top of this staff system (0-1)
  yBottom: number; // Normalized Y position of the bottom of this staff system (0-1)
  notes: ParsedNote[];
  measureLines?: number[]; // Array of normalized X positions for bar lines
}

export interface SheetAnalysis {
  tempo: number; // BPM
  timeSignature: string; // e.g., "4/4"
  systems: ParsedSystem[];
}

export interface SheetPage {
  id: string;
  imageUrl: string;
  file: File;
  status: 'pending' | 'analyzing' | 'ready' | 'error';
  data?: SheetAnalysis;
  errorMsg?: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentPageIndex: number;
  currentSystemIndex: number;
  currentNoteIndex: number;
  playbackSeconds: number;
  totalDuration: number;
  tempoMultiplier: number;
}