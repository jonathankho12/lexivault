import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { pcmToWav, resolveGeminiApiKey } from "@/lib/gemini";
import { getSupabaseClient } from "@/lib/supabase";
import { normalizeTermKey } from "@/lib/utils";
import type { AccentType } from "@/types/lexivault";

export const runtime = "nodejs";

const AUDIO_BUCKET = "audio-cache";

const EDGE_VOICES: Record<AccentType, readonly string[]> = {
  US: ["en-US-AndrewMultilingualNeural", "en-US-AriaNeural"],
  UK: ["en-GB-RyanNeural", "en-GB-SoniaNeural"],
};

function parseSampleRate(mimeType?: string): number {
  if (!mimeType) return 24000;
  const match = mimeType.match(/rate=(\d+)/i);
  if (match && match[1]) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed >= 8000 && parsed <= 96000) {
      return parsed;
    }
  }
  return 24000;
}

async function generateGeminiTtsWav(
  text: string,
  accent: AccentType
): Promise<Buffer | null> {
  const apiKey = await resolveGeminiApiKey();
  if (!apiKey) return null;

  const voiceName = accent === "UK" ? "Charon" : "Kore";
  const accentLabel =
    accent === "UK"
      ? "a clear, natural British English (Received Pronunciation) accent"
      : "a clear, natural American English accent";

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Pronounce ONLY the following English text clearly and naturally with ${accentLabel}, without adding any extra words:\n${text}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      }),
    });

    if (!res.ok) return null;

    const json = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { data?: string; mimeType?: string };
          }>;
        };
      }>;
    };

    const part = json.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData?.data
    );
    const base64Data = part?.inlineData?.data;
    if (!base64Data) return null;

    const rawBytes = Buffer.from(base64Data, "base64");
    if (rawBytes.length === 0) return null;

    const sampleRate = parseSampleRate(part?.inlineData?.mimeType);
    return pcmToWav(rawBytes, sampleRate, 1, 16);
  } catch {
    return null;
  }
}

async function synthesizeWithEdgeVoice(
  text: string,
  voiceName: string
): Promise<Buffer | null> {
  const tts = new MsEdgeTTS({
    connectionTimeoutMs: 10000,
    synthesisTimeoutMs: 12000,
  });

  try {
    await tts.setMetadata(
      voiceName,
      OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
    );

    const { audioStream } = tts.toStream(text);

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const timer = setTimeout(() => {
        reject(new Error("Edge TTS synthesis timeout"));
      }, 12000);

      audioStream.on("data", (chunk: Buffer | Uint8Array) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      audioStream.on("end", () => {
        clearTimeout(timer);
        resolve(Buffer.concat(chunks));
      });
      audioStream.on("error", (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    return buffer.length > 0 ? buffer : null;
  } catch {
    return null;
  } finally {
    try {
      tts.close();
    } catch {
      // Ignore socket cleanup errors
    }
  }
}

async function generateEdgeNeuralTtsMp3(
  text: string,
  accent: AccentType
): Promise<Buffer | null> {
  const candidates = EDGE_VOICES[accent];
  for (const voiceName of candidates) {
    const audioBuf = await synthesizeWithEdgeVoice(text, voiceName);
    if (audioBuf && audioBuf.length > 0) {
      return audioBuf;
    }
  }
  return null;
}

async function handleTtsRequest(
  rawText: string,
  rawAccent: string | undefined
): Promise<NextResponse> {
  const text = rawText.trim().slice(0, 260);
  if (!text) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  const accent: AccentType = rawAccent?.toUpperCase() === "UK" ? "UK" : "US";
  const hash = createHash("sha256")
    .update(`${accent}:${normalizeTermKey(text)}`)
    .digest("hex")
    .slice(0, 16);
  const wavPath = `tts-v2-${accent.toLowerCase()}-${hash}.wav`;
  const mp3Path = `tts-v2-${accent.toLowerCase()}-${hash}.mp3`;

  const supabase = getSupabaseClient();

  // 1. Check Supabase Storage Cache first
  if (supabase) {
    for (const candidate of [
      { path: wavPath, mime: "audio/wav" },
      { path: mp3Path, mime: "audio/mpeg" },
    ]) {
      try {
        const { data: cachedBlob, error } = await supabase.storage
          .from(AUDIO_BUCKET)
          .download(candidate.path);

        if (!error && cachedBlob) {
          const buf = Buffer.from(await cachedBlob.arrayBuffer());
          const {
            data: { publicUrl },
          } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(candidate.path);

          return new NextResponse(new Uint8Array(buf), {
            status: 200,
            headers: {
              "Content-Type": candidate.mime,
              "Cache-Control": "public, max-age=31536000, immutable",
              "X-TTS-Source": "supabase-cache",
              "X-Audio-Url": publicUrl,
            },
          });
        }
      } catch {
        // Cache miss, continue
      }
    }
  }

  // 2. Primary: Gemini Neural TTS (when GEMINI_API_KEY is configured)
  const geminiWav = await generateGeminiTtsWav(text, accent);
  if (geminiWav) {
    let publicUrl = "";
    if (supabase) {
      try {
        const { error: uploadErr } = await supabase.storage
          .from(AUDIO_BUCKET)
          .upload(wavPath, geminiWav, {
            contentType: "audio/wav",
            upsert: true,
          });
        if (!uploadErr) {
          publicUrl = supabase.storage
            .from(AUDIO_BUCKET)
            .getPublicUrl(wavPath).data.publicUrl;
        }
      } catch {
        // Ignore upload failure; still serve generated audio directly
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "audio/wav",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-TTS-Source": "gemini-tts",
    };
    if (publicUrl) {
      headers["X-Audio-Url"] = publicUrl;
    }

    return new NextResponse(new Uint8Array(geminiWav), { status: 200, headers });
  }

  // 3. Fallback: Microsoft Edge Neural TTS
  const edgeMp3 = await generateEdgeNeuralTtsMp3(text, accent);
  if (edgeMp3) {
    let publicUrl = "";
    if (supabase) {
      try {
        const { error: uploadErr } = await supabase.storage
          .from(AUDIO_BUCKET)
          .upload(mp3Path, edgeMp3, {
            contentType: "audio/mpeg",
            upsert: true,
          });
        if (!uploadErr) {
          publicUrl = supabase.storage
            .from(AUDIO_BUCKET)
            .getPublicUrl(mp3Path).data.publicUrl;
        }
      } catch {
        // Ignore upload failure
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-TTS-Source": "edge-neural-tts",
    };
    if (publicUrl) {
      headers["X-Audio-Url"] = publicUrl;
    }

    return new NextResponse(new Uint8Array(edgeMp3), { status: 200, headers });
  }

  return NextResponse.json(
    { error: "TTS service temporarily unavailable" },
    { status: 503 }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get("text") ?? "";
  const accent = searchParams.get("accent") ?? "US";
  return handleTtsRequest(text, accent);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      text?: string;
      accent?: string;
    };
    return handleTtsRequest(body.text ?? "", body.accent);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
