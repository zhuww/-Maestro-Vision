import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SheetAnalysis, ParsedSystem, ParsedNote } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define the response schema strictly
const noteSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    pitch: { type: Type.STRING, description: "Scientific pitch notation (e.g., C4, G#5). For rests, use 'REST'." },
    duration: { type: Type.STRING, description: "Duration in Tone.js notation (e.g., 4n, 8n, 2n, 1n, 16n)." },
    x: { type: Type.NUMBER, description: "The normalized horizontal position (0.0 to 1.0) of the note head within the system width." }
  },
  required: ["pitch", "duration", "x"]
};

const systemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    yTop: { type: Type.NUMBER, description: "Normalized Y coordinate (0-1) of the top of this system (staff)." },
    yBottom: { type: Type.NUMBER, description: "Normalized Y coordinate (0-1) of the bottom of this system (staff)." },
    measureLines: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: "List of normalized X coordinates (0.0 to 1.0) for all vertical bar lines (measure boundaries) in this system."
    },
    notes: { 
      type: Type.ARRAY, 
      items: noteSchema,
      description: "List of notes in this system, ordered chronologically." 
    }
  },
  required: ["yTop", "yBottom", "notes"]
};

const sheetAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    tempo: { type: Type.INTEGER, description: "Estimated tempo in BPM (e.g. 100). Default to 100 if unknown." },
    timeSignature: { type: Type.STRING, description: "Time signature (e.g., 4/4)." },
    systems: { 
      type: Type.ARRAY, 
      items: systemSchema,
      description: "Ordered list of musical systems (staves) from top to bottom."
    }
  },
  required: ["tempo", "timeSignature", "systems"]
};

export async function analyzeSheetMusic(base64Image: string): Promise<SheetAnalysis> {
  const modelId = 'gemini-3-pro-preview'; 

  try {
    const result = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg', 
              data: base64Image
            }
          },
          {
            text: `Analyze this sheet music image. 
            Transcription Goal: Playable Piano Performance.
            
            1. **Systems Identification**: 
               - A "System" includes ALL staves played simultaneously (usually Treble + Bass connected by a brace).
               - DO NOT confuse the bass staff of one system with the treble staff of the next.
               - Separate systems clearly based on vertical whitespace.
            
            2. **Key Signature (CRITICAL)**:
               - Identify the Key Signature at the start of the first staff.
               - **You MUST apply the key signature to ALL notes.**
               - Example: If the key is G Major (1 Sharp), every 'F' note is 'F#'. 
               - Example: If the key is F Major (1 Flat), every 'B' note is 'Bb'.
            
            3. **Note Extraction**:
               - For each System, list all notes from top to bottom, left to right.
               - **Grand Staff Merging**: Mix notes from the treble and bass clefs of the SAME system into a single chronological list sorted by X position.
               - **Vertical Alignment**: Notes that form a chord or are played together MUST have the same (or extremely close) 'x' value.
            
            4. **Pitch & Duration**:
               - Pitch: Scientific notation (C4, F#3). Check octaves carefully (Bass clef is usually C2-C4, Treble C4-C6).
               - Duration: Tone.js notation (4n, 8n, 2n, 1n).
            
            Output JSON matching the schema.
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: sheetAnalysisSchema,
        systemInstruction: "You are an expert music theorist and pianist. Your goal is to transcribe sheet music into a structured format for a computer to play. You pay extreme attention to Key Signatures and vertical alignment."
      }
    });

    if (result && result.text) {
      const parsed = JSON.parse(result.text) as SheetAnalysis;
      return parsed;
    } else {
      throw new Error("No data returned from Gemini.");
    }
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    throw error;
  }
}