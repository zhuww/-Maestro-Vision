import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SheetAnalysis, ParsedSystem, ParsedNote } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define the response schema strictly
const noteSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    pitch: { type: Type.STRING, description: "The scientific pitch notation (e.g., C4, G#5). For rests, use 'REST'." },
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
  const modelId = 'gemini-3-pro-preview'; // Using Pro for better spatial reasoning

  try {
    const result = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg', // Assuming converted to jpeg or png before sending
              data: base64Image
            }
          },
          {
            text: `Analyze this sheet music image. 
            Transcription Goal: Playable Piano Performance.
            
            1. Identify "Systems". A System is a line of music played across the page. For piano, a System usually consists of TWO staves (Treble and Bass) connected by a brace. 
            CRITICAL: Treat the Grand Staff (both Treble and Bass staves together) as a SINGLE System. Do not split them.
            
            2. Extract Notes.
            For each System, list ALL notes from BOTH the Treble and Bass staves.
            IMPORTANT: Maintain vertical alignment. Notes that are vertically aligned (played together) must have the same or very similar 'x' coordinate.
            
            3. Pitch & Duration.
            - Pitch: Scientific notation (C4, F#3). Use 'REST' for rests.
            - Duration: Tone.js notation (4n, 8n, 2n, 1n).
            - X: Normalized 0.0 to 1.0 (left to right).
            
            Output JSON matching the schema.
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: sheetAnalysisSchema,
        systemInstruction: "You are an expert music theorist and pianist. Your goal is to transcribe sheet music into a structured format for a computer to play."
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