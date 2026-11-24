import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveRuntimeEnvVar } from "@/lib/gemini";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
};

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const supabaseUrl =
      (await resolveRuntimeEnvVar("NEXT_PUBLIC_SUPABASE_URL")) ||
      (await resolveRuntimeEnvVar("SUPABASE_URL"));
    const supabaseAnonKey =
      (await resolveRuntimeEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY")) ||
      (await resolveRuntimeEnvVar("SUPABASE_ANON_KEY"));

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[LexiVault][api/health] Supabase environment variables are not configured.");
      return NextResponse.json(
        {
          status: "degraded",
          supabase: "error",
          timestamp,
        },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          fetch: (input, init) =>
            fetch(input, { ...init, signal: controller.signal }),
        },
      });

      // Lightweight read-only query against public.words to keep Postgres active
      const { error } = await supabase
        .from("words")
        .select("id", { count: "exact", head: true })
        .limit(1);

      if (error) {
        console.error("[LexiVault][api/health] Supabase ping failed:", error.message);
        return NextResponse.json(
          {
            status: "degraded",
            supabase: "error",
            timestamp,
          },
          { status: 503, headers: NO_STORE_HEADERS }
        );
      }

      return NextResponse.json(
        {
          status: "ok",
          supabase: "ok",
          timestamp,
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.error(
      "[LexiVault][api/health] Unexpected error:",
      err instanceof Error ? err.message : "Health check failed"
    );
    return NextResponse.json(
      {
        status: "degraded",
        supabase: "error",
        timestamp,
      },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }
}
