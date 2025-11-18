

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        // remove data url prefix e.g. "data:audio/webm;base64,"
        resolve(base64data.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
};

const withTimeout = <T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> => {
    const timeout = new Promise<T>((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error(errorMessage));
      }, ms);
    });
  
    return Promise.race([
      promise,
      timeout,
    ]);
};

export const transcribeAudio = async (
  audioBlob: Blob,
  mimeType: string,
  prompt: string
): Promise<string> => {
  try {
    const base64Audio = await blobToBase64(audioBlob);

    const audioPart = {
      inlineData: {
        mimeType: mimeType.split(';')[0],
        data: base64Audio,
      },
    };
    const textPart = {
      text: prompt,
    };

    const contents = { parts: [audioPart, textPart] };

    try {
        const transcriptionPromise = ai.models.generateContent({
            model: 'gemini-flash-lite-latest',
            contents,
        });
        const response: GenerateContentResponse = await withTimeout(
            transcriptionPromise,
            60000, // 60 seconds
            'Transcription request timed out after 60 seconds.'
        );
        return response.text ?? '';
    } catch (error) {
        console.error("Error during initial transcription attempt:", error);
        if (error instanceof Error && error.message.includes('timed out')) {
            console.log('Initial transcription timed out. Retrying with gemini-2.5-pro...');
            const retryPromise = ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents,
            });
            // Longer timeout for the more powerful model
            const retryResponse: GenerateContentResponse = await withTimeout(
                retryPromise,
                120000, // 120 seconds
                'Transcription retry request timed out after 120 seconds.'
            );
            return retryResponse.text ?? '';
        }
        // Re-throw if it's not a timeout error
        throw error;
    }
  } catch (error) {
    console.error("Error calling Gemini API for transcription:", error);
    if (error instanceof Error) {
        throw new Error(`Error transcribing audio: ${error.message}`);
    }
    throw new Error("An unknown error occurred during transcription.");
  }
};  


export const formatNotes = async (
  transcription: string,
  customInstruction: string,
  model: string
): Promise<string> => {
  if (!transcription.trim()) {
    throw new Error("Transcription is empty.");
  }
  if (!customInstruction.trim()) {
    throw new Error("Custom instruction is empty.");
  }

  const prompt = `
${customInstruction}

Here is the meeting transcription:
---
${transcription}
---
`;

  try {
    const formatPromise = ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    
    const response: GenerateContentResponse = await withTimeout(
        formatPromise,
        120000, // 120 seconds
        'Formatting notes request timed out after 120 seconds.'
    );
    
    return response.text ?? '';
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        return `Error formatting notes: ${error.message}. Please check the console for more details.`;
    }
    return "An unknown error occurred while formatting notes.";
  }
};