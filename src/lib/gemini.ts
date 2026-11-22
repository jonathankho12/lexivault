import { GoogleGenAI, type Schema } from "@google/genai";

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim() ?? "";
  return key.length > 0;
}

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

export function getGeminiFlashModel(): string {
  return process.env.GEMINI_FLASH_MODEL?.trim() || "gemini-2.5-flash";
}

export function getGeminiProModel(): string {
  return process.env.GEMINI_PRO_MODEL?.trim() || "gemini-2.5-pro";
}

export async function generateStructuredWithHybridModel<T>({
  tier,
  contents,
  responseSchema,
}: {
  tier: "flash" | "pro";
  contents: string;
  responseSchema: Schema;
}): Promise<{ data: T; modelUsed: string } | null> {
  const ai = getGeminiClient();
  if (!ai) return null;

  const flashModel = getGeminiFlashModel();
  const proModel = getGeminiProModel();
  const candidates =
    tier === "pro" && proModel !== flashModel
      ? [proModel, flashModel]
      : [flashModel];

  for (const model of candidates) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: "application/json",
          responseSchema,
        },
      });
      const text = response.text?.trim() ?? "";
      if (!text) continue;
      const parsed = JSON.parse(text) as T;
      return { data: parsed, modelUsed: model };
    } catch {
      // Automatically fall back from Pro -> Flash on 429 rate limits or availability errors
      continue;
    }
  }

  return null;
}

/**
 * Ensures raw linear 16-bit PCM audio bytes are wrapped in a valid 44-byte RIFF/WAV header.
 */
export function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16
): Buffer {
  if (
    pcmBuffer.length >= 12 &&
    pcmBuffer.toString("ascii", 0, 4) === "RIFF" &&
    pcmBuffer.toString("ascii", 8, 12) === "WAVE"
  ) {
    return pcmBuffer;
  }

  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
  header.writeUInt16LE(1, 20); // AudioFormat = 1 (PCM)
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}
