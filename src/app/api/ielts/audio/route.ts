import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { getSupabaseClient } from "@/lib/supabase";
import type { IeltsVoiceAccent, ListeningDialogueSegment } from "@/types/ielts";

export const runtime = "nodejs";

const AUDIO_BUCKET = "audio-cache";

const ACCENT_TO_VOICE: Record<IeltsVoiceAccent, string> = {
  GB_M: "en-GB-RyanNeural",
  GB_F: "en-GB-SoniaNeural",
  AU_F: "en-AU-NatashaNeural",
  AU_M: "en-AU-WilliamNeural",
  US_M: "en-US-AndrewMultilingualNeural",
};

function stripLeadingId3(buf: Buffer): Buffer {
  if (buf.length < 10 || buf.toString("ascii", 0, 3) !== "ID3") {
    return buf;
  }
  const tagSize =
    ((buf[6] & 0x7f) << 21) |
    ((buf[7] & 0x7f) << 14) |
    ((buf[8] & 0x7f) << 7) |
    (buf[9] & 0x7f);
  const totalHeader = 10 + tagSize;
  return totalHeader < buf.length ? buf.subarray(totalHeader) : buf;
}

async function synthesizeEdgeSegment(
  text: string,
  accent: IeltsVoiceAccent
): Promise<Buffer> {
  const voiceName = ACCENT_TO_VOICE[accent] ?? ACCENT_TO_VOICE.GB_F;
  const tts = new MsEdgeTTS({
    connectionTimeoutMs: 10000,
    synthesisTimeoutMs: 15000,
  });

  try {
    await tts.setMetadata(
      voiceName,
      OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
    );
    const { audioStream } = tts.toStream(text);

    return await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const timer = setTimeout(() => {
        reject(new Error("IELTS Edge TTS segment timeout"));
      }, 15000);

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
  } finally {
    try {
      tts.close();
    } catch {
      // Ignore socket close errors
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      segments?: ListeningDialogueSegment[];
    };

    const segments = Array.isArray(body.segments)
      ? body.segments
          .filter((s) => s && typeof s.text === "string" && s.text.trim())
          .slice(0, 14)
      : [];

    if (segments.length === 0) {
      return NextResponse.json(
        { error: "Audio segments are required" },
        { status: 400 }
      );
    }

    const hash = createHash("sha256")
      .update(
        JSON.stringify(
          segments.map((s) => ({
            a: s.accent,
            t: s.text.trim().toLowerCase(),
          }))
        )
      )
      .digest("hex")
      .slice(0, 20);
    const cachePath = `ielts-audio-v1-${hash}.mp3`;

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: cachedBlob, error } = await supabase.storage
          .from(AUDIO_BUCKET)
          .download(cachePath);
        if (!error && cachedBlob) {
          const cachedBuf = Buffer.from(await cachedBlob.arrayBuffer());
          return new NextResponse(new Uint8Array(cachedBuf), {
            status: 200,
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "public, max-age=31536000, immutable",
              "X-IELTS-Audio-Source": "supabase-cache",
            },
          });
        }
      } catch {
        // Cache miss, continue to synthesis
      }
    }

    const buffers: Buffer[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const raw = await synthesizeEdgeSegment(seg.text.trim(), seg.accent);
      if (raw.length > 0) {
        buffers.push(i === 0 ? raw : stripLeadingId3(raw));
      }
    }

    const merged = Buffer.concat(buffers);
    if (merged.length === 0) {
      return NextResponse.json(
        { error: "Failed to synthesize audio" },
        { status: 503 }
      );
    }

    if (supabase) {
      try {
        await supabase.storage.from(AUDIO_BUCKET).upload(cachePath, merged, {
          contentType: "audio/mpeg",
          upsert: true,
        });
      } catch {
        // Non-blocking storage upload
      }
    }

    return new NextResponse(new Uint8Array(merged), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-IELTS-Audio-Source": "edge-multi-neural",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate IELTS listening audio" },
      { status: 500 }
    );
  }
}
