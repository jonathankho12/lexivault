"use client";

import React, { useEffect, useRef, useState } from "react";
import type { LexiMood } from "@/lib/lexi";
import { cn } from "@/lib/utils";

export type LexiAvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type LexiReactionType = "pet" | "treat" | "super";

export interface LexiAvatarProps {
  mood?: LexiMood;
  size?: LexiAvatarSize;
  animated?: boolean;
  className?: string;
  label?: string;
  interactive?: boolean;
  onInteract?: () => void;
  onHoldPet?: () => void;
  reaction?: LexiReactionType | null;
  reactionNonce?: number;
  bondLevel?: number;
  streakGuard?: boolean;
}

const SIZE_CLASSES: Record<LexiAvatarSize, string> = {
  xs: "h-9 w-9",
  sm: "h-11 w-11",
  md: "h-14 w-14",
  lg: "h-20 w-20",
  xl: "h-24 w-24",
};

const MOOD_BACKDROP: Record<
  LexiMood,
  { ring: string; glow: string; tagAccent: string }
> = {
  sleepy: {
    ring: "border-[#70BCFF]/25 bg-[#0A84FF]/[0.08]",
    glow: "rgba(10, 132, 255, 0.14)",
    tagAccent: "#5BA4E6",
  },
  alert: {
    ring: "border-[#0A84FF]/35 bg-[#0A84FF]/[0.12]",
    glow: "rgba(10, 132, 255, 0.22)",
    tagAccent: "#0A84FF",
  },
  happy: {
    ring: "border-[#30D158]/40 bg-[#30D158]/[0.13]",
    glow: "rgba(48, 209, 88, 0.24)",
    tagAccent: "#30D158",
  },
  restless: {
    ring: "border-[#FF9F0A]/40 bg-[#FF9F0A]/[0.13]",
    glow: "rgba(255, 159, 10, 0.24)",
    tagAccent: "#FF9F0A",
  },
};

/**
 * Minimalist flat-vector Rottweiler guardian avatar ("Lexi") with 4 distinct
 * expressions and 60fps GPU-composited micro-animations (transform + opacity only).
 */
export function LexiAvatar({
  mood = "alert",
  size = "md",
  animated = true,
  className,
  label,
  interactive = false,
  onInteract,
  onHoldPet,
  reaction = null,
  reactionNonce = 0,
  bondLevel,
  streakGuard = false,
}: LexiAvatarProps) {
  const [holdHappyGlow, setHoldHappyGlow] = useState(false);
  const holdTimerRef = useRef<number | null>(null);
  const holdReleaseTimerRef = useRef<number | null>(null);
  const holdTriggeredRef = useRef(false);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) {
        window.clearTimeout(holdTimerRef.current);
      }
      if (holdReleaseTimerRef.current !== null) {
        window.clearTimeout(holdReleaseTimerRef.current);
      }
    };
  }, []);

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handlePointerDown = () => {
    if (!interactive) return;
    clearHoldTimer();
    if (holdReleaseTimerRef.current !== null) {
      window.clearTimeout(holdReleaseTimerRef.current);
      holdReleaseTimerRef.current = null;
    }
    holdTriggeredRef.current = false;
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      holdTriggeredRef.current = true;
      setHoldHappyGlow(true);
      onHoldPet?.();
    }, 550);
  };

  const handlePointerEnd = () => {
    if (!interactive) return;
    clearHoldTimer();
    if (holdTriggeredRef.current) {
      if (holdReleaseTimerRef.current !== null) {
        window.clearTimeout(holdReleaseTimerRef.current);
      }
      holdReleaseTimerRef.current = window.setTimeout(() => {
        setHoldHappyGlow(false);
        holdReleaseTimerRef.current = null;
      }, 950);
    }
  };

  const handleButtonClick = () => {
    if (holdTriggeredRef.current) {
      holdTriggeredRef.current = false;
      return;
    }
    onInteract?.();
  };

  const basePalette = MOOD_BACKDROP[mood];
  const palette = holdHappyGlow
    ? {
        ring: "border-[#FFD18C]/55 bg-[#FF9F0A]/[0.14]",
        glow: "rgba(255, 190, 92, 0.34)",
        tagAccent: basePalette.tagAccent,
      }
    : streakGuard
      ? {
          ring: "border-[#FF9F0A]/50 bg-[#FF9F0A]/[0.12]",
          glow: "rgba(255, 159, 10, 0.28)",
          tagAccent: "#FF9F0A",
        }
      : basePalette;

  // Evolve collar & tag visuals by Bond Level (Lv.1 blue -> Lv.2 silver tag -> Lv.3 gold -> Lv.4+ gold + glasses)
  const collarStroke =
    typeof bondLevel === "number"
      ? bondLevel >= 3
        ? "#F59E0B"
        : "#0A84FF"
      : palette.tagAccent;
  const tagFill =
    typeof bondLevel === "number"
      ? bondLevel >= 3
        ? "#FCD34D"
        : bondLevel === 2
          ? "#E2E8F0"
          : "#38BDF8"
      : palette.tagAccent;
  const showBondGlasses = typeof bondLevel === "number" && bondLevel >= 4;

  const rootAnimClass = animated
    ? holdHappyGlow
      ? "lexi-hold-pet"
      : mood === "sleepy"
        ? "lexi-avatar-sleepy"
        : mood === "happy"
          ? "lexi-avatar-happy"
          : mood === "restless"
            ? "lexi-avatar-restless"
            : "lexi-avatar-alert"
    : "";

  const leftEarAnimClass = animated
    ? mood === "alert"
      ? "lexi-ear-alert-left"
      : mood === "happy" || holdHappyGlow
        ? "lexi-ear-happy-left"
        : mood === "restless"
          ? "lexi-ear-restless-left"
          : ""
    : "";

  const rightEarAnimClass = animated
    ? mood === "alert"
      ? "lexi-ear-alert-right"
      : mood === "happy" || holdHappyGlow
        ? "lexi-ear-happy-right"
        : mood === "restless"
          ? "lexi-ear-restless-right"
          : ""
    : "";

  const reactionAnimClass =
    reaction === "super"
      ? "lexi-react-super"
      : reaction === "treat"
        ? "lexi-react-treat"
        : reaction === "pet"
          ? "lexi-react-pet"
          : "";

  const containerClassName = cn(
    "group relative inline-flex shrink-0 items-center justify-center rounded-2xl border select-none transform-gpu overflow-visible transition-[transform,colors,border-color,background-color,box-shadow]",
    palette.ring,
    SIZE_CLASSES[size],
    interactive &&
      "touch-manipulation cursor-pointer hover:scale-[1.04] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent",
    className
  );

  const innerContent = (
    <>
      {/* Soft radial aura behind Lexi */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
      >
        <span
          className={cn(
            "pointer-events-none absolute inset-1 rounded-full transform-gpu",
            animated && (mood === "happy" || holdHappyGlow) && "lexi-happy-aura"
          )}
          style={{
            background: `radial-gradient(circle, ${palette.glow} 0%, transparent 72%)`,
          }}
        />
      </span>

      {/* Floating Pet / Treat / Super Particles */}
      {reaction && (
        <span
          key={`particles-${reaction}-${reactionNonce}`}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 overflow-visible"
        >
          {reaction === "treat" ? (
            <>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className="lexi-particle-1 absolute -top-1 left-0.5 h-3 w-3 text-[#FFD18C]"
              >
                <path
                  d="M8 1.5L9.7 5.8L14 7.5L9.7 9.2L8 13.5L6.3 9.2L2 7.5L6.3 5.8Z"
                  fill="currentColor"
                />
              </svg>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className="lexi-particle-2 absolute -top-2 right-0.5 h-3.5 w-3.5 text-[#FF9F0A]"
              >
                <path
                  d="M4.2 5.2C2.9 5.2 2 6.1 2 7.2C2 8 2.5 8.7 3.2 9C2.5 9.3 2 10 2 10.8C2 11.9 2.9 12.8 4.2 12.8C5.2 12.8 6 12.2 6.3 11.3H9.7C10 12.2 10.8 12.8 11.8 12.8C13.1 12.8 14 11.9 14 10.8C14 10 13.5 9.3 12.8 9C13.5 8.7 14 8 14 7.2C14 6.1 13.1 5.2 11.8 5.2C10.8 5.2 10 5.8 9.7 6.7H6.3C6 5.8 5.2 5.2 4.2 5.2Z"
                  fill="currentColor"
                />
              </svg>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className="lexi-particle-3 absolute top-2 -right-1 h-2.5 w-2.5 text-[#7CF099]"
              >
                <path
                  d="M8 1.5L9.7 5.8L14 7.5L9.7 9.2L8 13.5L6.3 9.2L2 7.5L6.3 5.8Z"
                  fill="currentColor"
                />
              </svg>
            </>
          ) : reaction === "super" ? (
            <>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className="lexi-particle-1 absolute -top-1.5 left-0 h-3.5 w-3.5 text-[#FF5E84]"
              >
                <path
                  d="M8 13.8C8 13.8 2 9.9 2 5.6C2 3.7 3.5 2.2 5.3 2.2C6.5 2.2 7.5 2.8 8 3.8C8.5 2.8 9.5 2.2 10.7 2.2C12.5 2.2 14 3.7 14 5.6C14 9.9 8 13.8 8 13.8Z"
                  fill="currentColor"
                />
              </svg>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className="lexi-particle-2 absolute -top-2.5 left-1/2 -translate-x-1/2 h-3.5 w-3.5 text-[#FFD18C]"
              >
                <path
                  d="M8 1.5L9.7 5.8L14 7.5L9.7 9.2L8 13.5L6.3 9.2L2 7.5L6.3 5.8Z"
                  fill="currentColor"
                />
              </svg>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className="lexi-particle-3 absolute -top-1 right-0 h-3 w-3 text-[#7CF099]"
              >
                <path
                  d="M8 13.8C8 13.8 2 9.9 2 5.6C2 3.7 3.5 2.2 5.3 2.2C6.5 2.2 7.5 2.8 8 3.8C8.5 2.8 9.5 2.2 10.7 2.2C12.5 2.2 14 3.7 14 5.6C14 9.9 8 13.8 8 13.8Z"
                  fill="currentColor"
                />
              </svg>
            </>
          ) : (
            <>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className="lexi-particle-1 absolute -top-1 left-1 h-3 w-3 text-[#FF6B8B]"
              >
                <path
                  d="M8 13.8C8 13.8 2 9.9 2 5.6C2 3.7 3.5 2.2 5.3 2.2C6.5 2.2 7.5 2.8 8 3.8C8.5 2.8 9.5 2.2 10.7 2.2C12.5 2.2 14 3.7 14 5.6C14 9.9 8 13.8 8 13.8Z"
                  fill="currentColor"
                />
              </svg>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className="lexi-particle-2 absolute -top-2 right-1 h-2.5 w-2.5 text-[#FFD18C]"
              >
                <path
                  d="M8 1.5L9.7 5.8L14 7.5L9.7 9.2L8 13.5L6.3 9.2L2 7.5L6.3 5.8Z"
                  fill="currentColor"
                />
              </svg>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className="lexi-particle-3 absolute top-2 -right-0.5 h-2.5 w-2.5 text-[#FF8DA1]"
              >
                <path
                  d="M8 13.8C8 13.8 2 9.9 2 5.6C2 3.7 3.5 2.2 5.3 2.2C6.5 2.2 7.5 2.8 8 3.8C8.5 2.8 9.5 2.2 10.7 2.2C12.5 2.2 14 3.7 14 5.6C14 9.9 8 13.8 8 13.8Z"
                  fill="currentColor"
                />
              </svg>
            </>
          )}
        </span>
      )}

      <span
        key={reactionNonce}
        className={cn(
          "relative z-10 flex h-full w-full items-center justify-center transform-gpu",
          reactionAnimClass
        )}
      >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("h-[88%] w-[88%] transform-gpu", rootAnimClass)}
      >
        {/* Neck & Collar */}
        <path
          d="M32 79 C35 88, 65 88, 68 79 L64 70 L36 70 Z"
          fill="#181A22"
          stroke="#363B4D"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M34 77 C44 82, 56 82, 66 77"
          stroke={collarStroke}
          strokeWidth="3.6"
          strokeLinecap="round"
        />
        {/* Minimalist Vault Diamond Collar Tag */}
        <path
          d="M50 77 L54 81.5 L50 86 L46 81.5 Z"
          fill={tagFill}
          stroke="#111319"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {typeof bondLevel === "number" && bondLevel >= 2 && (
          <path
            d="M50 78.6 L52 81.5 L50 84.4 L48 81.5 Z"
            fill="#FFFFFF"
            opacity={bondLevel >= 3 ? "0.45" : "0.65"}
          />
        )}

        {/* Head + Ears Wrapper (subtle tilt on hover) */}
        <g
          className="lexi-head-tilt transform-gpu"
          style={{ transformOrigin: "50px 52px" }}
        >
          {/* Left Ear */}
          <g
            className={cn("lexi-ear-left transform-gpu", leftEarAnimClass)}
            style={{ transformOrigin: "30px 28px" }}
          >
            <path
              d={
                mood === "sleepy"
                  ? "M29 24 C19 25, 14 35, 16 47 C17 51, 22 50, 25 45 L31 32 Z"
                  : mood === "restless"
                    ? "M29 23 C19 20, 14 29, 17 42 C18 46, 23 45, 26 40 L31 30 Z"
                    : "M29 23 C19 22, 15 32, 17 44 C18 48, 23 47, 26 42 L31 31 Z"
              }
              fill="#1B1E28"
              stroke="#363B4D"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M27 29 C22 31, 19 37, 20 43"
              stroke="#2B3040"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </g>

          {/* Right Ear */}
          <g
            className={cn("lexi-ear-right transform-gpu", rightEarAnimClass)}
            style={{ transformOrigin: "70px 28px" }}
          >
            <path
              d={
                mood === "sleepy"
                  ? "M71 24 C81 25, 86 35, 84 47 C83 51, 78 50, 75 45 L69 32 Z"
                  : mood === "restless"
                    ? "M71 21 C82 16, 87 24, 83 37 C81 41, 77 41, 74 37 L69 29 Z"
                    : "M71 23 C81 22, 85 32, 83 44 C82 48, 77 47, 74 42 L69 31 Z"
              }
              fill="#1B1E28"
              stroke="#363B4D"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M73 29 C78 31, 81 37, 80 43"
              stroke="#2B3040"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </g>

          {/* Head Base (Signature Sleek Rottweiler Silhouette) */}
          <path
            d="M50 18 C66 18, 75 28, 76 44 C77 61, 66 75, 50 75 C34 75, 23 61, 24 44 C25 28, 34 18, 50 18 Z"
            fill="#171921"
            stroke="#3A3F52"
            strokeWidth="2"
          />

          {/* Subtle Forehead Facet Highlight */}
          <path
            d="M39 24 C45 21.5, 55 21.5, 61 24"
            stroke="#282C3A"
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Signature Rottweiler Tan Cheek Markings */}
          <path
            d="M27 52 C29 47, 34 47, 37 52 C38 57, 35 63, 30 62 C27 60, 26 56, 27 52 Z"
            fill="#D48436"
            opacity="0.92"
          />
          <path
            d="M73 52 C71 47, 66 47, 63 52 C62 57, 65 63, 70 62 C73 60, 74 56, 73 52 Z"
            fill="#D48436"
            opacity="0.92"
          />

          {/* Signature Rottweiler Tan Muzzle */}
          <path
            d="M35 54 C35 46, 65 46, 65 54 C66 64, 59 71, 50 71 C41 71, 34 64, 35 54 Z"
            fill="#DA8B3D"
          />
          <path
            d="M39 54 C42 49, 58 49, 61 54"
            stroke="#E9A55E"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.7"
          />

          {/* Signature Tan Eyebrow Pips (Mood-Expressive) */}
          {mood === "sleepy" && (
            <>
              <ellipse
                cx="38"
                cy="37.5"
                rx="4.6"
                ry="2.5"
                transform="rotate(-4 38 37.5)"
                fill="#DF9040"
              />
              <ellipse
                cx="62"
                cy="37.5"
                rx="4.6"
                ry="2.5"
                transform="rotate(4 62 37.5)"
                fill="#DF9040"
              />
            </>
          )}
          {mood === "alert" && (
            <>
              <ellipse
                cx="37.5"
                cy="35.5"
                rx="4.8"
                ry="2.8"
                transform="rotate(-12 37.5 35.5)"
                fill="#E59747"
              />
              <ellipse
                cx="62.5"
                cy="35.5"
                rx="4.8"
                ry="2.8"
                transform="rotate(12 62.5 35.5)"
                fill="#E59747"
              />
            </>
          )}
          {mood === "happy" && (
            <>
              <ellipse
                cx="37.5"
                cy="34.2"
                rx="4.8"
                ry="2.7"
                transform="rotate(-16 37.5 34.2)"
                fill="#EA9D4E"
              />
              <ellipse
                cx="62.5"
                cy="34.2"
                rx="4.8"
                ry="2.7"
                transform="rotate(16 62.5 34.2)"
                fill="#EA9D4E"
              />
            </>
          )}
          {mood === "restless" && (
            <>
              <ellipse
                cx="37.5"
                cy="36"
                rx="4.8"
                ry="2.6"
                transform="rotate(14 37.5 36)"
                fill="#E59747"
              />
              <ellipse
                cx="62.5"
                cy="35"
                rx="4.8"
                ry="2.6"
                transform="rotate(-10 62.5 35)"
                fill="#E59747"
              />
            </>
          )}

          {/* Eyes (4 Distinct Expressions + Hold-to-Pet Cozy Close) */}
          {holdHappyGlow || mood === "happy" ? (
            <>
              <path
                d="M33.5 45 C35.5 40.5, 40.5 40.5, 42.5 45"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M57.5 45 C59.5 40.5, 64.5 40.5, 66.5 45"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </>
          ) : mood === "sleepy" ? (
            <>
              <path
                d="M33.5 44 C35.5 47, 40.5 47, 42.5 44"
                stroke="#E5E7EB"
                strokeWidth="2.3"
                strokeLinecap="round"
              />
              <path
                d="M57.5 44 C59.5 47, 64.5 47, 66.5 44"
                stroke="#E5E7EB"
                strokeWidth="2.3"
                strokeLinecap="round"
              />
            </>
          ) : mood === "alert" ? (
            <g
              className={cn(animated && "lexi-eye-blink transform-gpu")}
              style={{ transformOrigin: "50px 43.5px" }}
            >
              <circle cx="38" cy="43.5" r="4.1" fill="#0B0D12" />
              <circle cx="62" cy="43.5" r="4.1" fill="#0B0D12" />
              <circle cx="38" cy="43.5" r="3.4" fill="#1F2937" />
              <circle cx="62" cy="43.5" r="3.4" fill="#1F2937" />
              <circle cx="39.3" cy="42.1" r="1.4" fill="#FFFFFF" />
              <circle cx="63.3" cy="42.1" r="1.4" fill="#FFFFFF" />
            </g>
          ) : (
            <g
              className={cn(animated && "lexi-eye-blink-slow transform-gpu")}
              style={{ transformOrigin: "50px 43.5px" }}
            >
              <circle cx="38" cy="43.5" r="4.2" fill="#FFFFFF" opacity="0.9" />
              <circle cx="62" cy="43.5" r="4.2" fill="#FFFFFF" opacity="0.9" />
              <circle cx="39.2" cy="43.5" r="2.7" fill="#111319" />
              <circle cx="63.2" cy="43.5" r="2.7" fill="#111319" />
              <circle cx="40.1" cy="42.4" r="1" fill="#FFFFFF" />
              <circle cx="64.1" cy="42.4" r="1" fill="#FFFFFF" />
            </g>
          )}

          {/* Bond Level 4+ Sleek Minimal Glasses */}
          {showBondGlasses && (
            <g aria-hidden="true">
              <path
                d="M25.5 41.4 L30.5 42.6"
                stroke="#E5E7EB"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
              <path
                d="M74.5 41.4 L69.5 42.6"
                stroke="#E5E7EB"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
              <rect
                x="30.5"
                y="38.2"
                width="15"
                height="10.6"
                rx="4"
                fill="rgba(56, 189, 248, 0.08)"
                stroke="#E5E7EB"
                strokeWidth="1.35"
              />
              <rect
                x="54.5"
                y="38.2"
                width="15"
                height="10.6"
                rx="4"
                fill="rgba(56, 189, 248, 0.08)"
                stroke="#E5E7EB"
                strokeWidth="1.35"
              />
              <path
                d="M45.5 42.6 C48 41.4, 52 41.4, 54.5 42.6"
                stroke="#E5E7EB"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
              <path
                d="M32.8 40.2 L35.8 40.2"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.9"
                strokeLinecap="round"
              />
              <path
                d="M56.8 40.2 L59.8 40.2"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.9"
                strokeLinecap="round"
              />
            </g>
          )}

          {/* Warm Soft Blush Glow on Hold-to-Pet */}
          {holdHappyGlow && (
            <g aria-hidden="true" opacity="0.5">
              <ellipse cx="30.5" cy="51.5" rx="3.2" ry="1.8" fill="#FF8DA1" />
              <ellipse cx="69.5" cy="51.5" rx="3.2" ry="1.8" fill="#FF8DA1" />
            </g>
          )}

          {/* Nose */}
          <path
            d="M44 53.5 C44 51, 56 51, 56 53.5 C56 56.5, 52.8 59, 50 59 C47.2 59, 44 56.5, 44 53.5 Z"
            fill="#0D0F14"
          />
          <ellipse cx="48.2" cy="53.6" rx="2.1" ry="0.9" fill="#464D63" />

          {/* Mouth & Chin */}
          {holdHappyGlow || mood === "happy" ? (
            <>
              <path
                d="M43 61.5 C46 65, 54 65, 57 61.5"
                stroke="#171921"
                strokeWidth="2.1"
                strokeLinecap="round"
              />
              <path
                d="M47.2 63.6 C47.2 67.8, 52.8 67.8, 52.8 63.6 Z"
                fill="#F26B82"
                stroke="#171921"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </>
          ) : mood === "restless" ? (
            <path
              d="M44 63.5 C47.5 62, 52.5 62, 56 63.5"
              stroke="#171921"
              strokeWidth="2.1"
              strokeLinecap="round"
            />
          ) : mood === "sleepy" ? (
            <path
              d="M46.5 62.5 C48.5 63.6, 51.5 63.6, 53.5 62.5"
              stroke="#171921"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M44.5 61.5 C47.5 64, 52.5 64, 55.5 61.5"
              stroke="#171921"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
        </g>

        {/* Mood Particle Accents (GPU transform + opacity only) */}
        {animated && mood === "sleepy" && (
          <g aria-hidden="true">
            <g className="lexi-sleep-z-1 transform-gpu">
              <path
                d="M72 28 H76.5 L72 32.5 H76.5"
                stroke="#70BCFF"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
            <g className="lexi-sleep-z-2 transform-gpu">
              <path
                d="M79 19 H84.5 L79 24.5 H84.5"
                stroke="#70BCFF"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
            <g className="lexi-sleep-z-3 transform-gpu">
              <path
                d="M84 11 H90.5 L84 17.5 H90.5"
                stroke="#9CD0FF"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </g>
        )}

        {animated && mood === "happy" && (
          <g aria-hidden="true">
            {/* Minimal 4-point sparkles */}
            <path
              d="M16 18 L17.3 21.2 L20.5 22.5 L17.3 23.8 L16 27 L14.7 23.8 L11.5 22.5 L14.7 21.2 Z"
              fill="#7CF099"
              className="lexi-sparkle-1 transform-gpu"
              style={{ transformOrigin: "16px 22.5px" }}
            />
            <path
              d="M83 14 L84.4 17.6 L88 19 L84.4 20.4 L83 24 L81.6 20.4 L78 19 L81.6 17.6 Z"
              fill="#30D158"
              className="lexi-sparkle-2 transform-gpu"
              style={{ transformOrigin: "83px 19px" }}
            />
            <path
              d="M86 58 L86.9 60.1 L89 61 L86.9 61.9 L86 64 L85.1 61.9 L83 61 L85.1 60.1 Z"
              fill="#FFD18C"
              className="lexi-sparkle-3 transform-gpu"
              style={{ transformOrigin: "86px 61px" }}
            />
          </g>
        )}
      </svg>
      </span>
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={handleButtonClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={label ?? `Lexi the Rottweiler (${mood})`}
        className={containerClassName}
      >
        {innerContent}
      </button>
    );
  }

  return (
    <div
      role="img"
      aria-label={label ?? `Lexi the Rottweiler (${mood})`}
      className={containerClassName}
    >
      {innerContent}
    </div>
  );
}
