export const DEFAULT_TEMPO = 100;

// Mapping basic durations to Tone.js notation if needed, though we try to get Gemini to output standard notation
export const DURATION_MAPPING: Record<string, string> = {
  "whole": "1n",
  "half": "2n",
  "quarter": "4n",
  "eighth": "8n",
  "sixteenth": "16n",
  "thirty-second": "32n"
};

export const SAMPLE_LIBRARY_URL = "https://tonejs.github.io/audio/salamander/";