"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export function FlagIdIcon({ className }: { className?: string }) {
  const clipId = useId();
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cn("h-4 w-4 rounded-full shrink-0 shadow-sm", className)}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="8" cy="8" r="8" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="16" height="8" y="0" fill="#E70011" />
        <rect width="16" height="8" y="8" fill="#FFFFFF" />
      </g>
      <circle
        cx="8"
        cy="8"
        r="7.6"
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="0.8"
      />
    </svg>
  );
}

export function FlagEnIcon({ className }: { className?: string }) {
  const clipId = useId();
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cn("h-4 w-4 rounded-full shrink-0 shadow-sm", className)}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="8" cy="8" r="8" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="16" height="16" fill="#012169" />
        <path d="M0 0 L16 16 M16 0 L0 16" stroke="#FFFFFF" strokeWidth="2.8" />
        <path d="M0 0 L16 16 M16 0 L0 16" stroke="#C8102E" strokeWidth="1.4" />
        <path d="M8 0 V16 M0 8 H16" stroke="#FFFFFF" strokeWidth="4.4" />
        <path d="M8 0 V16 M0 8 H16" stroke="#C8102E" strokeWidth="2.5" />
      </g>
      <circle
        cx="8"
        cy="8"
        r="7.6"
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="0.8"
      />
    </svg>
  );
}

export function FlagRuIcon({ className }: { className?: string }) {
  const clipId = useId();
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cn("h-4 w-4 rounded-full shrink-0 shadow-sm", className)}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="8" cy="8" r="8" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="16" height="5.34" y="0" fill="#FFFFFF" />
        <rect width="16" height="5.34" y="5.33" fill="#0039A6" />
        <rect width="16" height="5.34" y="10.66" fill="#D52B1E" />
      </g>
      <circle
        cx="8"
        cy="8"
        r="7.6"
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="0.8"
      />
    </svg>
  );
}
