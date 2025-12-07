import * as Tone from 'https://esm.sh/tone@14.7.77';
import { SheetPage, ParsedNote } from '../types';
import { SAMPLE_LIBRARY_URL } from '../constants';

// Helper type to track original indices during sorting/grouping
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
        release: 3.0, // Long release for natural piano sustain
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
    Tone.Transport.cancel(); // Clear scheduled events
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

  /**
   * Groups notes into vertical columns (chords/simultaneous events) based on X position.
   */
  private groupNotesByColumn(notes: NoteWithIndex[]): NoteWithIndex[][] {
    if (notes.length === 0) return [];
    
    // Sort by X position first
    const sorted = [...notes].sort((a, b) => a.x - b.x);
    
    const columns: NoteWithIndex[][] = [];
    let currentColumn: NoteWithIndex[] = [sorted[0]];
    
    // Threshold for "same vertical position". 
    const X_THRESHOLD = 0.035; 

    for (let i = 1; i < sorted.length; i++) {
        const note = sorted[i];
        const prevNote = currentColumn[0]; // Compare with anchor of the column
        
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

  /**
   * Schedules notes for a specific page.
   * @param page The sheet page data
   * @param startTime The absolute Transport time to start playing this page
   * @param onNotePlay Callback for UI updates
   * @returns The end time of this page
   */
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
        
        columns.forEach(column => {
            // 1. Calculate Duration for this Step
            const validDurations: number[] = [];
            column.forEach(n => {
                try {
                    const sec = Tone.Time(n.duration || "4n").toSeconds();
                    if (sec > 0.05) validDurations.push(sec);
                } catch(e) {
                     validDurations.push(0.5); 
                }
            });
            
            const stepDuration = validDurations.length > 0 ? Math.min(...validDurations) : Tone.Time("8n").toSeconds();

            // 2. Play Notes
            column.forEach(note => {
                const pitch = note.pitch ? String(note.pitch).toUpperCase() : 'REST';
                const isRest = pitch === 'REST' || pitch === 'NAN' || pitch === '' || pitch === 'NULL';

                if (!isRest) {
                    try {
                        // Legato fix: Add a small buffer (0.1s) to the duration so notes overlap slightly
                        // instead of cutting off exactly when the next one starts.
                        // Tone.js handles the polyphony gracefully.
                        const playDuration = Tone.Time(note.duration).toSeconds() + 0.2;
                        
                        this.sampler?.triggerAttackRelease(
                            note.pitch, 
                            playDuration, 
                            currentTime
                        );
                    } catch (e) {
                        console.warn(`Skipping invalid note: ${pitch}`, e);
                    }
                }
            });

            // 3. Schedule Visual Callback
            if (column.length > 0) {
                const representativeIndex = column[0].originalIndex;
                Tone.Transport.schedule((time) => {
                    Tone.Draw.schedule(() => {
                        onNotePlay(page.id, sysIdx, representativeIndex);
                    }, time);
                }, currentTime);
            }

            // 4. Advance Time
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
          } catch(e) {
            console.warn("Play note failed", e);
          }
      }
  }
}

export const audioService = new AudioService();