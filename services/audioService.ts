import * as Tone from 'https://esm.sh/tone@14.7.77';
import { SheetPage, ParsedNote } from '../types';
import { SAMPLE_LIBRARY_URL } from '../constants';

type NoteWithIndex = ParsedNote & { originalIndex: number };

class AudioService {
  private sampler: Tone.Sampler | null = null;
  private isLoaded = false;
  private pageEndTimes: Map<string, number> = new Map();

  async initialize() {
    if (this.sampler) return;

    return new Promise<void>((resolve) => {
      this.sampler = new Tone.Sampler({
        urls: {
          "A0": "A0.mp3",
          "C1": "C1.mp3",
          "D#1": "Ds1.mp3",
          "F#1": "Fs1.mp3",
          "A1": "A1.mp3",
          "C2": "C2.mp3",
          "D#2": "Ds2.mp3",
          "F#2": "Fs2.mp3",
          "A2": "A2.mp3",
          "C3": "C3.mp3",
          "D#3": "Ds3.mp3",
          "F#3": "Fs3.mp3",
          "A3": "A3.mp3",
          "C4": "C4.mp3",
          "D#4": "Ds4.mp3",
          "F#4": "Fs4.mp3",
          "A4": "A4.mp3",
          "C5": "C5.mp3",
          "D#5": "Ds5.mp3",
          "F#5": "Fs5.mp3",
          "A5": "A5.mp3",
          "C6": "C6.mp3",
          "D#6": "Ds6.mp3",
          "F#6": "Fs6.mp3",
          "A6": "A6.mp3",
          "C7": "C7.mp3",
          "D#7": "Ds7.mp3",
          "F#7": "Fs7.mp3",
          "A7": "A7.mp3",
          "C8": "C8.mp3"
        },
        release: 3.0,
        curve: 'exponential',
        maxPolyphony: 64,
        baseUrl: SAMPLE_LIBRARY_URL,
        onload: () => {
          this.isLoaded = true;
          resolve();
        }
      }).toDestination();
    });
  }

  async startContext() {
    await Tone.start();
  }

  stop() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    this.pageEndTimes.clear();
  }

  pause() {
    Tone.Transport.pause();
  }

  start() {
    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start();
    }
  }

  setTempo(bpm: number) {
    Tone.Transport.bpm.value = bpm;
  }

  getPageEndTime(pageId: string): number | undefined {
    return this.pageEndTimes.get(pageId);
  }

  private groupNotesByColumn(notes: NoteWithIndex[]): NoteWithIndex[][] {
    if (notes.length === 0) return [];
    
    // Sort by X position first
    const sorted = [...notes].sort((a, b) => a.x - b.x);
    
    const columns: NoteWithIndex[][] = [];
    let currentColumn: NoteWithIndex[] = [sorted[0]];
    
    const X_THRESHOLD = 0.015; // 1.5% threshold for vertical alignment

    for (let i = 1; i < sorted.length; i++) {
        const note = sorted[i];
        const prevNote = currentColumn[0]; 
        
        if (Math.abs(note.x - prevNote.x) <= X_THRESHOLD) {
            currentColumn.push(note);
        } else {
            columns.push(currentColumn);
            currentColumn = [note];
        }
    }
    columns.push(currentColumn);
    return columns;
  }

  schedulePage(
    page: SheetPage, 
    startTime: number, 
    onNotePlay: (pageId: string, systemIdx: number, noteIdx: number) => void
  ): number {
    if (!this.sampler || !this.isLoaded || !page.data) return startTime;

    const systems = page.data.systems;
    let currentTime = startTime;

    systems.forEach((system, sysIdx) => {
        const notesWithIndex: NoteWithIndex[] = system.notes.map((n, i) => ({ ...n, originalIndex: i }));
        const columns = this.groupNotesByColumn(notesWithIndex);
        
        columns.forEach((column, colIdx) => {
            // --- Rhythm Calculation Strategy ---
            // 1. Audio Duration: Minimum declared duration in the column (e.g., 4n, 8n)
            const validAudioDurations: number[] = [];
            column.forEach(n => {
                try {
                    const sec = Tone.Time(n.duration || "4n").toSeconds();
                    if (sec > 0.01) validAudioDurations.push(sec);
                } catch(e) {
                     validAudioDurations.push(Tone.Time("4n").toSeconds()); 
                }
            });
            const minAudioDuration = validAudioDurations.length > 0 ? Math.min(...validAudioDurations) : Tone.Time("8n").toSeconds();

            // 2. Visual Duration (The "Conductor" logic)
            // Calculate distance to the NEXT column to determine if we should move faster.
            // If the bass note says "1n" (whole note) but the next chord is 2% of the width away, 
            // we clearly shouldn't wait for the whole note.
            let visualCap = Infinity;
            const nextColumn = columns[colIdx + 1];
            
            if (nextColumn) {
                const currentX = column[0].x;
                const nextX = nextColumn[0].x;
                const deltaX = Math.max(0.001, nextX - currentX);
                
                // Estimate: 1 full width (1.0) approx 4 measures of 4/4 = 16 beats.
                // 1 Beat in seconds = 60 / BPM.
                const bpm = Tone.Transport.bpm.value || 100;
                const secondsPerBeat = 60 / bpm;
                
                // Multiplier 20 means we assume the page is roughly 20 beats wide.
                // This is a heuristic to convert X-distance to Time.
                // We add a small multiplier (1.2) to allow breathing room, preventing rushing.
                const estimatedVisualSeconds = deltaX * 20 * secondsPerBeat * 1.2;
                
                visualCap = estimatedVisualSeconds;
            }

            // The Step Duration is the Minimum of Audio and Visual.
            // This effectively "uncaps" pauses. If visual distance is short, we move on.
            // We clamp it to a minimum of 0.1s to prevent machine-gun fire glitches.
            let stepDuration = Math.min(minAudioDuration, visualCap);
            stepDuration = Math.max(0.1, stepDuration); // Minimum step time

            // --- Scheduling ---
            Tone.Transport.schedule((time) => {
                // Play Notes
                column.forEach(note => {
                    let pitch = note.pitch ? String(note.pitch).trim().toUpperCase() : 'REST';
                    pitch = pitch.replace('♭', 'b').replace('♯', '#');
                    const isRest = pitch === 'REST' || !pitch.match(/^[A-G][#b]?[0-8]$/);

                    if (!isRest) {
                        try {
                            const noteDuration = Tone.Time(note.duration).toSeconds();
                            // Legato: Play for at least the step duration + overlap
                            const playDuration = Math.max(noteDuration, stepDuration) + 0.4;
                            this.sampler?.triggerAttackRelease(pitch, playDuration, time);
                        } catch (e) {}
                    }
                });

                // Update UI
                Tone.Draw.schedule(() => {
                   if (column.length > 0) {
                       const representativeIndex = column[0].originalIndex;
                       onNotePlay(page.id, sysIdx, representativeIndex);
                   }
                }, time);

            }, currentTime);

            // Advance Time
            currentTime += stepDuration;
        });
    });

    this.pageEndTimes.set(page.id, currentTime);
    return currentTime;
  }
  
  playNote(pitch: string) {
      if (this.sampler && this.isLoaded && pitch && pitch.toUpperCase() !== 'REST') {
          try {
            this.sampler.triggerAttackRelease(pitch, "2n");
          } catch(e) {}
      }
  }
}

export const audioService = new AudioService();