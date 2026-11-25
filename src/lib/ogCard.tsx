import { ImageResponse } from "next/og";
import { LEXI_BADGE_DATA_URL } from "@/lib/ogBadgeData";

export const OG_CARD_SIZE = {
  width: 1200,
  height: 630,
} as const;

type FontWeight = 500 | 600 | 700 | 800;

interface LoadedFont {
  name: string;
  data: ArrayBuffer;
  weight: FontWeight;
  style: "normal";
}

const INTER_FONT_URLS: ReadonlyArray<{ weight: FontWeight; url: string }> = [
  {
    weight: 500,
    url: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZhrib2Au-0.ttf",
  },
  {
    weight: 600,
    url: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZhrib2Au-0.ttf",
  },
  {
    weight: 700,
    url: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZhrib2Au-0.ttf",
  },
  {
    weight: 800,
    url: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuDyYMZhrib2Au-0.ttf",
  },
];

async function loadInterFonts(): Promise<LoadedFont[] | undefined> {
  try {
    const settled = await Promise.all(
      INTER_FONT_URLS.map(async ({ weight, url }) => {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return null;
        return {
          name: "Inter",
          data: await res.arrayBuffer(),
          weight,
          style: "normal" as const,
        };
      })
    );
    const loaded = settled.filter((f): f is LoadedFont => f !== null);
    return loaded.length > 0 ? loaded : undefined;
  } catch {
    return undefined;
  }
}

const FEATURE_PILLS = [
  {
    label: "A1–C2 Adaptive Vocabulary",
    dot: "#0A84FF",
    bg: "rgba(10, 132, 255, 0.14)",
    border: "rgba(10, 132, 255, 0.40)",
    text: "#CFE6FF",
  },
  {
    label: "4-Skill IELTS Training",
    dot: "#30D158",
    bg: "rgba(48, 209, 88, 0.14)",
    border: "rgba(48, 209, 88, 0.40)",
    text: "#C9F7D5",
  },
  {
    label: "Real-Time Grammar & Phrasing",
    dot: "#818CF8",
    bg: "rgba(94, 92, 230, 0.18)",
    border: "rgba(129, 140, 248, 0.42)",
    text: "#E0E7FF",
  },
] as const;

const IELTS_SKILLS = [
  {
    skill: "Reading",
    detail: "Academic & Passage Drills",
    badge: "Band 8.0",
    accent: "#0A84FF",
  },
  {
    skill: "Writing",
    detail: "Task 1 & 2 Phrasing",
    badge: "Band 7.5+",
    accent: "#818CF8",
  },
  {
    skill: "Listening",
    detail: "US / UK Audio Comprehension",
    badge: "Band 8.5",
    accent: "#30D158",
  },
  {
    skill: "Speaking",
    detail: "Cue Cards & Lexical Range",
    badge: "C1–C2",
    accent: "#FF9F0A",
  },
] as const;

/**
 * Generates the 1200x630 Edge/Worker-compatible LexiVault social share image.
 */
export async function createSocialCardImage(): Promise<ImageResponse> {
  const fonts = await loadInterFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(135deg, #050811 0%, #090E1C 52%, #070C17 100%)",
          color: "#F5F5F7",
          fontFamily: fonts ? "Inter, sans-serif" : "sans-serif",
          padding: "46px 54px",
        }}
      >
        {/* Ambient radial glows */}
        <div
          style={{
            position: "absolute",
            top: "-150px",
            left: "-110px",
            width: "560px",
            height: "560px",
            borderRadius: "9999px",
            background:
              "radial-gradient(circle, rgba(10,132,255,0.22) 0%, rgba(10,132,255,0) 68%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-180px",
            right: "-90px",
            width: "560px",
            height: "560px",
            borderRadius: "9999px",
            background:
              "radial-gradient(circle, rgba(94,92,230,0.24) 0%, rgba(48,209,88,0.08) 45%, rgba(0,0,0,0) 72%)",
            display: "flex",
          }}
        />

        {/* Subtle outer frame */}
        <div
          style={{
            position: "absolute",
            top: "18px",
            right: "18px",
            bottom: "18px",
            left: "18px",
            borderRadius: "28px",
            border: "1px solid rgba(255,255,255,0.09)",
            display: "flex",
          }}
        />

        {/* Main 2-column content */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "38px",
          }}
        >
          {/* Left column: Wordmark, Headline, Feature Pills, CTA */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: "695px",
              height: "100%",
              paddingTop: "6px",
              paddingBottom: "6px",
            }}
          >
            {/* Brand Header */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: "18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "72px",
                  height: "72px",
                  borderRadius: "20px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  boxShadow: "0 12px 32px rgba(10, 132, 255, 0.25)",
                  overflow: "hidden",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={LEXI_BADGE_DATA_URL}
                  alt="LexiVault"
                  width={62}
                  height={62}
                  style={{ objectFit: "contain" }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "42px",
                      fontWeight: 800,
                      letterSpacing: "-0.03em",
                      color: "#FFFFFF",
                      lineHeight: 1,
                    }}
                  >
                    LexiVault
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                      borderRadius: "9999px",
                      background: "rgba(48, 209, 88, 0.14)",
                      border: "1px solid rgba(48, 209, 88, 0.36)",
                      padding: "6px 13px",
                      fontSize: "13px",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      color: "#7CF099",
                    }}
                  >
                    <span
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "9999px",
                        background: "#30D158",
                      }}
                    />
                    <span>CEFR A1–C2 · BAND PREP</span>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: 500,
                    color: "#98A2B3",
                  }}
                >
                  Adaptive English & IELTS Mastery
                </span>
              </div>
            </div>

            {/* Outcome Headline & Subcopy */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  fontSize: "47px",
                  fontWeight: 800,
                  lineHeight: 1.12,
                  letterSpacing: "-0.03em",
                  color: "#FFFFFF",
                }}
              >
                <span>Master English & IELTS</span>
                <span style={{ color: "#70BCFF" }}>Fluency from A1 to C2</span>
              </div>
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: 500,
                  lineHeight: 1.45,
                  color: "#A1A8B8",
                  maxWidth: "640px",
                }}
              >
                Elevate your English with targeted vocabulary drills, real-time
                grammar feedback, and 4-skill IELTS prep.
              </span>
            </div>

            {/* 3 Clean Feature Pills */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              {FEATURE_PILLS.map((pill) => (
                <div
                  key={pill.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    borderRadius: "9999px",
                    background: pill.bg,
                    border: `1px solid ${pill.border}`,
                    padding: "9px 15px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: pill.text,
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "9999px",
                      background: pill.dot,
                    }}
                  />
                  <span>{pill.label}</span>
                </div>
              ))}
            </div>

            {/* Subtle Conversion CTA Badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  borderRadius: "9999px",
                  background:
                    "linear-gradient(90deg, rgba(10,132,255,0.22) 0%, rgba(94,92,230,0.24) 100%)",
                  border: "1px solid rgba(112, 188, 255, 0.45)",
                  padding: "11px 20px",
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#FFFFFF",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "9999px",
                    background: "#0A84FF",
                  }}
                />
                <span>Start Training Free → lexivault.my.id</span>
              </div>
            </div>
          </div>

          {/* Right column: Band-Score & 4-Skill Mastery Glass Card */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: "355px",
              height: "100%",
              borderRadius: "28px",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)",
              border: "1px solid rgba(255,255,255,0.14)",
              padding: "26px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
            }}
          >
            {/* Card top */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: "#8E96A8",
                  }}
                >
                  BAND PROGRESSION
                </span>
                <div
                  style={{
                    display: "flex",
                    borderRadius: "9999px",
                    background: "rgba(10,132,255,0.18)",
                    border: "1px solid rgba(10,132,255,0.42)",
                    padding: "4px 10px",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#8AC7FF",
                  }}
                >
                  A1 → C2
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "baseline",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    fontSize: "38px",
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    color: "#FFFFFF",
                  }}
                >
                  Band 7.5 → 8.5
                </span>
              </div>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#9EA6B8",
                }}
              >
                Structured 4-skill IELTS & daily lexical retention
              </span>
            </div>

            {/* 4-Skill Rows */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {IELTS_SKILLS.map((item) => (
                <div
                  key={item.skill}
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderRadius: "16px",
                    background: "rgba(8, 12, 24, 0.65)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    padding: "12px 14px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "9999px",
                        background: item.accent,
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "15px",
                          fontWeight: 700,
                          color: "#FFFFFF",
                        }}
                      >
                        {item.skill}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 500,
                          color: "#8E96A8",
                        }}
                      >
                        {item.detail}
                      </span>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: item.accent,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.09)",
                      borderRadius: "9999px",
                      padding: "4px 9px",
                    }}
                  >
                    {item.badge}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer inside card */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "12px",
                borderTop: "1px solid rgba(255,255,255,0.09)",
                fontSize: "12px",
                fontWeight: 600,
                color: "#9EA6B8",
              }}
            >
              <span>SM-2 Flashcards</span>
              <span>•</span>
              <span>Grammar Check</span>
              <span>•</span>
              <span>EN / ID</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_CARD_SIZE,
      ...(fonts ? { fonts } : {}),
    }
  );
}
