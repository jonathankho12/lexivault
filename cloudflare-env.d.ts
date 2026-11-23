export interface CloudflareAiBinding {
  run(
    model: string,
    inputs: {
      messages?: Array<{
        role: "system" | "user" | "assistant";
        content: string;
      }>;
      prompt?: string;
      max_tokens?: number;
      temperature?: number;
      response_format?: {
        type: "json_object" | "json_schema";
        json_schema?: Record<string, unknown>;
      };
    }
  ): Promise<unknown>;
}

declare global {
  interface CloudflareEnv {
    AI?: CloudflareAiBinding;
    GEMINI_API_KEY?: string;
    GOOGLE_GENERATIVE_AI_API_KEY?: string;
    GOOGLE_API_KEY?: string;
    GEMINI_MODEL?: string;
    GEMINI_FLASH_MODEL?: string;
    GEMINI_PRO_MODEL?: string;
    GEMINI_FALLBACK_MODELS?: string;
    GEMINI_TTS_MODEL?: string;
    GROQ_API_KEY?: string;
    GROQ_MODEL?: string;
    NEXT_PUBLIC_SUPABASE_URL?: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
  }
}
