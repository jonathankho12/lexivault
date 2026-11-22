"use client";

import React, { useId } from "react";
import { cn } from "@/lib/utils";

export type LexiLogoSize = "xs" | "sm" | "md" | "lg" | "hero";

export interface LexiLogoProps {
  size?: LexiLogoSize;
  showHoverShimmer?: boolean;
  showAmbientGlow?: boolean;
  className?: string;
  title?: string;
}

const SIZE_CLASSES: Record<LexiLogoSize, string> = {
  xs: "h-7 w-7 rounded-[8px]",
  sm: "h-8 w-8 rounded-[10px]",
  md: "h-10 w-10 rounded-[12px]",
  lg: "h-[52px] w-[52px] rounded-[15px]",
  hero: "h-[88px] w-[88px] sm:h-24 sm:w-24 rounded-[24px] sm:rounded-[26px]",
};

/**
 * Expressive, friendly 2D-stylized vector mascot ("Lexi" the Rottweiler) in a playful
 * 3/4 view with warm eyes, cheerful smile, pink tongue, bold dark outlines, and flat
 * shading inside a dark navy iOS Liquid Glass squircle.
 */
export function LexiLogo({
  size = "md",
  showHoverShimmer = false,
  showAmbientGlow = false,
  className,
  title = "LexiVault",
}: LexiLogoProps) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, "");

  const ids = {
    squircleClip: `${uid}-sq`,
    navyBg: `${uid}-navy`,
    navyHalo: `${uid}-halo`,
    rimLight: `${uid}-rim`,
    topSpecular: `${uid}-topSpec`,
    glassSheen: `${uid}-sheen`,
  };

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center transform-gpu",
        className
      )}
    >
      {showAmbientGlow && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-4 rounded-[34px] bg-[radial-gradient(circle,rgba(56,189,248,0.28)_0%,rgba(99,102,241,0.22)_46%,rgba(0,0,0,0)_74%)] blur-xl transform-gpu"
        />
      )}

      <div
        className={cn(
          "lexi-logo-surface relative overflow-hidden transform-gpu",
          SIZE_CLASSES[size],
          showAmbientGlow
            ? "shadow-[0_18px_42px_rgba(0,0,0,0.78),0_0_26px_rgba(56,189,248,0.24),inset_0_1px_1px_rgba(255,255,255,0.28)]"
            : "shadow-[0_6px_18px_rgba(0,0,0,0.48),0_0_14px_rgba(56,189,248,0.16),inset_0_1px_0.5px_rgba(255,255,255,0.22)]"
        )}
      >
        <svg
          viewBox="0 0 512 512"
          fill="none"
          role="img"
          aria-label={title}
          className="h-full w-full block"
        >
          <defs>
            <clipPath id={ids.squircleClip}>
              <rect x="0" y="0" width="512" height="512" rx="116" />
            </clipPath>

            <linearGradient id={ids.navyBg} x1="48" y1="16" x2="464" y2="496" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="52%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#091020" />
            </linearGradient>

            <radialGradient id={ids.navyHalo} cx="50%" cy="46%" r="54%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.28" />
              <stop offset="56%" stopColor="#1E293B" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
            </radialGradient>

            <linearGradient id={ids.rimLight} x1="16" y1="16" x2="496" y2="496" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.88" />
              <stop offset="35%" stopColor="#38BDF8" stopOpacity="0.65" />
              <stop offset="70%" stopColor="#818CF8" stopOpacity="0.72" />
              <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.82" />
            </linearGradient>

            <linearGradient id={ids.topSpecular} x1="112" y1="14" x2="400" y2="14" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>

            <linearGradient id={ids.glassSheen} x1="256" y1="0" x2="256" y2="195" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.15" />
              <stop offset="50%" stopColor="#93C5FD" stopOpacity="0.035" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
          </defs>

          <g clipPath={`url(#${ids.squircleClip})`}>
            {/* Rich Dark Navy Backdrop & Soft Contrast Halo */}
            <rect x="0" y="0" width="512" height="512" fill={`url(#${ids.navyBg})`} />
            <rect x="0" y="0" width="512" height="512" fill={`url(#${ids.navyHalo})`} />
            <circle cx="256" cy="252" r="188" fill="#263652" fillOpacity="0.3" />

            {/* === SMOOTH ROUNDED NECK & CHEST WITH SYMMETRIC TAN MARKINGS === */}
            <path
              d="M 164 342 C 128 386, 102 444, 92 516 L 414 516 C 402 442, 372 384, 334 342 Z"
              fill="#1E2534"
              stroke="#080C15"
              strokeWidth="12"
              strokeLinejoin="round"
            />
            {/* Flat Cel-Shading on Shoulders */}
            <path
              d="M 168 358 C 140 402, 120 452, 110 512 L 158 512 C 164 456, 174 404, 192 362 Z"
              fill="#2B364C"
            />
            <path
              d="M 326 356 C 352 400, 376 452, 386 512 L 404 512 C 392 444, 366 390, 332 348 Z"
              fill="#131824"
            />

            {/* Warm Symmetric Mahogany-Tan Chest Blazes */}
            <path
              d="M 178 408 C 202 396, 238 410, 250 442 C 254 464, 244 488, 224 494 C 194 490, 172 464, 168 434 C 166 420, 170 412, 178 408 Z"
              fill="#EE913E"
            />
            <path
              d="M 172 444 C 184 470, 210 484, 238 480 C 232 492, 218 496, 200 492 C 178 482, 168 462, 172 444 Z"
              fill="#CC6C22"
            />

            <path
              d="M 332 404 C 308 394, 274 410, 266 442 C 262 464, 274 488, 294 492 C 322 488, 344 462, 346 432 C 348 418, 342 408, 332 404 Z"
              fill="#EE913E"
            />
            <path
              d="M 344 442 C 334 468, 310 482, 282 478 C 288 490, 302 494, 318 490 C 338 480, 348 460, 344 442 Z"
              fill="#CC6C22"
            />

            {/* Clean Cast Shadow Under Jaw */}
            <path
              d="M 164 362 Q 258 424 342 358 Q 262 394 164 362 Z"
              fill="#090D16"
              fillOpacity="0.65"
            />

            {/* === PLAYFUL SLIGHTLY RIGHT-TILTED HEAD GROUP (3/4 VIEW) === */}
            <g transform="rotate(4.5 256 250)">
              {/* Far-Right Soft Triangular Ear (Behind Head in 3/4 View) */}
              <path
                d="M 314 122 C 350 118, 384 138, 396 178 C 402 204, 396 238, 380 248 C 366 256, 350 238, 340 212 Z"
                fill="#131926"
                stroke="#080C15"
                strokeWidth="12"
                strokeLinejoin="round"
              />
              <path
                d="M 326 134 C 354 134, 376 154, 384 184 C 374 168, 354 156, 330 150 Z"
                fill="#273248"
              />

              {/* Main Rounded Expressive Rottweiler Head */}
              <path
                d="M 244 96 C 306 94, 352 128, 360 188 C 368 238, 366 288, 346 330 C 326 372, 296 394, 258 396 C 212 398, 170 374, 148 330 C 128 288, 128 232, 142 182 C 156 128, 194 98, 244 96 Z"
                fill="#1E2534"
                stroke="#080C15"
                strokeWidth="12"
                strokeLinejoin="round"
              />

              {/* Modern Flat Shading on Head (Glossy Crown + Left Jaw Shade) */}
              <path
                d="M 184 132 C 214 108, 278 106, 314 128 C 284 142, 224 144, 184 132 Z"
                fill="#303D55"
              />
              <path
                d="M 144 238 C 146 300, 176 358, 232 386 C 186 380, 152 348, 138 300 C 132 276, 136 254, 144 238 Z"
                fill="#131926"
              />

              {/* Seamless Warm Tan Cheeks + Snout + Chin Marking */}
              <path
                d="M 164 254 C 188 248, 214 264, 226 276 C 240 264, 256 258, 270 258 C 286 258, 300 264, 312 274 C 322 260, 336 250, 348 254 C 358 262, 358 296, 344 328 C 334 348, 316 364, 298 374 C 286 382, 274 386, 260 386 C 242 386, 224 380, 210 368 C 188 358, 166 336, 156 304 C 150 282, 154 260, 164 254 Z"
                fill="#F2994A"
              />
              {/* Flat Warm Mahogany Shading Along Cheek & Chin Rim */}
              <path
                d="M 160 296 C 170 330, 194 356, 226 372 C 254 384, 294 382, 326 350 C 340 336, 350 314, 354 292 C 348 332, 322 368, 286 382 C 256 392, 220 382, 190 358 C 168 340, 156 318, 160 296 Z"
                fill="#D17024"
              />
              {/* Soft Upper Cheek & Muzzle Specular Highlights */}
              <ellipse cx="188" cy="284" rx="16" ry="9" transform="rotate(18 188 284)" fill="#FFC082" fillOpacity="0.52" />
              <ellipse cx="238" cy="296" rx="15" ry="8.5" transform="rotate(-10 238 296)" fill="#FFC082" fillOpacity="0.46" />
              <ellipse cx="304" cy="294" rx="12" ry="7.5" transform="rotate(12 304 294)" fill="#FFC082" fillOpacity="0.4" />

              {/* Glossy Black Nasal Bridge */}
              <path
                d="M 234 214 C 248 210, 276 210, 288 214 L 288 266 C 276 260, 256 260, 244 266 Z"
                fill="#1E2534"
              />
              <path
                d="M 248 218 C 256 216, 264 216, 272 218 L 270 254 L 250 254 Z"
                fill="#2C374E"
              />

              {/* Expressive Round Orange/Tan Eyebrows */}
              <ellipse
                cx="204"
                cy="172"
                rx="23"
                ry="13"
                transform="rotate(-14 204 172)"
                fill="#F2994A"
                stroke="#080C15"
                strokeWidth="6"
              />
              <ellipse
                cx="202"
                cy="168"
                rx="12"
                ry="4.5"
                transform="rotate(-14 202 168)"
                fill="#FFC585"
                fillOpacity="0.7"
              />

              <ellipse
                cx="306"
                cy="170"
                rx="21"
                ry="12.5"
                transform="rotate(14 306 170)"
                fill="#F2994A"
                stroke="#080C15"
                strokeWidth="6"
              />
              <ellipse
                cx="304"
                cy="166"
                rx="10.5"
                ry="4.2"
                transform="rotate(14 304 166)"
                fill="#FFC585"
                fillOpacity="0.7"
              />

              {/* Big Round Warm Eyes with Double Sparkle Highlights (Looking Straight Forward) */}
              <ellipse cx="208" cy="224" rx="25" ry="27" fill="#0B0E17" stroke="#080B12" strokeWidth="5.5" />
              <path d="M 192 236 A 19 19 0 0 0 224 236 A 22 18 0 0 1 192 236 Z" fill="#94471B" />
              <circle cx="208" cy="223" r="14" fill="#05060A" />
              <circle cx="199" cy="213" r="8.6" fill="#FFFFFF" />
              <circle cx="218" cy="234" r="4.2" fill="#FFFFFF" fillOpacity="0.92" />

              <ellipse cx="304" cy="222" rx="22.5" ry="26" fill="#0B0E17" stroke="#080B12" strokeWidth="5.5" />
              <path d="M 290 234 A 17 17 0 0 0 318 234 A 20 17 0 0 1 290 234 Z" fill="#94471B" />
              <circle cx="304" cy="221" r="12.8" fill="#05060A" />
              <circle cx="296" cy="212" r="7.8" fill="#FFFFFF" />
              <circle cx="313" cy="232" r="3.8" fill="#FFFFFF" fillOpacity="0.92" />

              {/* Joyful Natural Open Smile + Cute Pink Tongue Peeking Out */}
              <path
                d="M 216 316 Q 244 330 268 314 Q 292 330 316 314 C 312 354, 292 368, 266 368 C 240 368, 220 352, 216 316 Z"
                fill="#4C1127"
                stroke="#080C15"
                strokeWidth="8"
                strokeLinejoin="round"
              />

              {/* Soft Pink Tongue with Flat Cel-Shade & Crease */}
              <path
                d="M 244 334 C 242 368, 256 384, 274 382 C 292 380, 298 360, 292 332 C 278 326, 258 326, 244 334 Z"
                fill="#FF7CA8"
                stroke="#080C15"
                strokeWidth="8"
                strokeLinejoin="round"
              />
              <path
                d="M 248 358 C 254 374, 268 380, 282 374 C 290 370, 294 358, 292 346 C 284 366, 262 370, 248 358 Z"
                fill="#E55386"
              />
              <path
                d="M 268 334 Q 270 352 269 364"
                stroke="#B83264"
                strokeWidth="4.2"
                strokeLinecap="round"
              />
              <ellipse cx="258" cy="346" rx="5.5" ry="3.2" transform="rotate(-18 258 346)" fill="#FFC8DC" fillOpacity="0.85" />

              {/* Clean Cheerful Upper Smile Line */}
              <path d="M 268 292 L 268 314" stroke="#080C15" strokeWidth="8" strokeLinecap="round" />
              <path
                d="M 210 310 Q 240 334 268 314 Q 296 334 322 308"
                stroke="#080C15"
                strokeWidth="8.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Cute Glossy Rounded Nose (Shifted Right for 3/4 Angle) */}
              <path
                d="M 268 254 C 288 254, 300 262, 298 276 C 296 288, 280 298, 268 298 C 256 298, 240 288, 238 276 C 236 262, 248 254, 268 254 Z"
                fill="#151C2B"
                stroke="#080C15"
                strokeWidth="8.5"
                strokeLinejoin="round"
              />
              <ellipse cx="264" cy="266" rx="16" ry="6" fill="#475569" />
              <ellipse cx="258" cy="264" rx="7" ry="2.8" fill="#E2E8F0" fillOpacity="0.82" />
              <ellipse cx="254" cy="279" rx="5.5" ry="3.8" transform="rotate(-18 254 279)" fill="#06080F" />
              <ellipse cx="282" cy="279" rx="5.5" ry="3.8" transform="rotate(18 282 279)" fill="#06080F" />

              {/* Near-Left Soft Triangular Drooping Rottweiler Ear (Foreground) */}
              <path
                d="M 168 128 C 132 126, 98 148, 92 192 C 88 226, 94 266, 114 278 C 128 286, 148 262, 160 226 C 170 198, 174 160, 168 128 Z"
                fill="#1E2534"
                stroke="#080C15"
                strokeWidth="12"
                strokeLinejoin="round"
              />
              <path
                d="M 162 146 C 142 164, 128 202, 124 246 C 122 260, 124 270, 118 274 C 134 272, 148 246, 158 216 C 166 190, 168 164, 162 146 Z"
                fill="#131926"
              />
              <path
                d="M 154 140 C 126 144, 106 168, 104 206 C 110 180, 128 158, 154 148 Z"
                fill="#334155"
              />
            </g>

            {/* === iOS DARK LIQUID GLASS SHEEN & ELEGANT RIM LIGHT === */}
            <path
              d="M 0 116 C 0 52, 52 0, 116 0 H 396 C 460 0, 512 52, 512 116 V 156 C 412 196, 100 196, 0 156 Z"
              fill={`url(#${ids.glassSheen})`}
            />
            <path
              d="M 116 14 H 396"
              stroke={`url(#${ids.topSpecular})`}
              strokeWidth="4"
              strokeLinecap="round"
            />
            <rect
              x="4"
              y="4"
              width="504"
              height="504"
              rx="112"
              stroke={`url(#${ids.rimLight})`}
              strokeWidth="5"
              strokeOpacity="0.84"
            />
            <rect
              x="10"
              y="10"
              width="492"
              height="492"
              rx="106"
              stroke="#FFFFFF"
              strokeOpacity="0.16"
              strokeWidth="1.8"
            />
          </g>
        </svg>

        {showHoverShimmer && (
          <span
            aria-hidden="true"
            className="lexi-logo-sheen pointer-events-none absolute inset-y-0 -left-1/2 w-2/3 bg-gradient-to-r from-transparent via-white/30 to-transparent transform-gpu will-change-transform"
          />
        )}
      </div>
    </div>
  );
}
