"use client";

import { motion } from "framer-motion";
import { LexiLogo } from "@/components/ui/LexiLogo";
import { useLanguage } from "@/context/LanguageContext";
import { TAP_SCALE } from "@/lib/motion";
import { playGlassClick } from "@/lib/soundEffects";
import { cn } from "@/lib/utils";

const GITHUB_URL = "https://github.com/jonathankho12";
const LINKEDIN_URL = "https://www.linkedin.com/in/abeljonathankho";
const EMAIL_ADDRESS = "abeljonathankho@gmail.com";
const MAILTO_URL = `mailto:${EMAIL_ADDRESS}`;

export function GitHubSvgIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("h-4 w-4 shrink-0", className)}
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}

export function LinkedInSvgIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("h-4 w-4 shrink-0", className)}
    >
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77Z" />
    </svg>
  );
}

export function MailSvgIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("h-4 w-4 shrink-0", className)}
    >
      <rect width="20" height="16" x="2" y="4" rx="3" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

export function AuthDeveloperFooter() {
  const { t } = useLanguage();

  return (
    <footer className="pt-1 text-center">
      <div className="inline-flex flex-wrap items-center justify-center gap-2.5 text-xs text-[#8E8E93]">
        <span className="font-medium text-white/75">
          {t.developer.builtBy}
        </span>

        <div className="inline-flex items-center gap-1.5">
          <motion.a
            whileTap={TAP_SCALE}
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => playGlassClick()}
            aria-label={t.developer.github}
            title={t.developer.github}
            className="transform-gpu flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.12] text-white/70 hover:text-white hover:bg-white/[0.12] hover:border-white/[0.24] hover:shadow-[0_0_14px_rgba(10,132,255,0.28)] transition-all"
          >
            <GitHubSvgIcon className="h-3.5 w-3.5" />
          </motion.a>

          <motion.a
            whileTap={TAP_SCALE}
            href={LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => playGlassClick()}
            aria-label={t.developer.linkedin}
            title={t.developer.linkedin}
            className="transform-gpu flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.12] text-white/70 hover:text-white hover:bg-white/[0.12] hover:border-white/[0.24] hover:shadow-[0_0_14px_rgba(10,132,255,0.28)] transition-all"
          >
            <LinkedInSvgIcon className="h-3.5 w-3.5" />
          </motion.a>

          <a
            href={MAILTO_URL}
            onClick={() => playGlassClick()}
            aria-label={t.developer.email}
            title={EMAIL_ADDRESS}
            className="transform-gpu flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.12] text-white/70 hover:text-white hover:bg-white/[0.12] hover:border-white/[0.24] hover:shadow-[0_0_14px_rgba(10,132,255,0.28)] active:scale-[0.95] transition-all"
          >
            <MailSvgIcon className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}

export function SettingsDeveloperCard() {
  const { t } = useLanguage();

  return (
    <section className="space-y-2">
      <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
        {t.developer.sectionTitle}
      </h3>

      <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0A84FF]/25 to-[#5E5CE6]/25 border border-white/[0.15] text-xs font-bold tracking-wide text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
              AJ
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {t.developer.name}
              </p>
              <p className="text-xs text-[#8E8E93] truncate">
                {t.developer.roleSubtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Miniature Rottweiler "Lexi" Mascot Tribute */}
        <div className="group flex items-center gap-2.5 rounded-xl bg-white/[0.035] border border-white/[0.08] px-3 py-2.5">
          <LexiLogo size="sm" showHoverShimmer />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white">
                {t.developer.mascotName}
              </span>
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-[#38BDF8] shadow-[0_0_6px_rgba(56,189,248,0.85)]"
              />
              <span className="text-[10px] font-medium text-[#8E8E93] truncate">
                {t.developer.mascotStatus}
              </span>
            </div>
            <p className="text-[11px] text-[#A7B4FF]/85 truncate">
              {t.auth.lexiInspiration}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <motion.a
            whileTap={TAP_SCALE}
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => playGlassClick()}
            className="transform-gpu inline-flex items-center justify-center gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.11] px-3 py-2 text-xs font-semibold text-white/75 hover:text-white hover:bg-white/[0.12] hover:border-white/[0.22] transition-all"
          >
            <GitHubSvgIcon className="h-3.5 w-3.5" />
            <span>{t.developer.github}</span>
          </motion.a>

          <motion.a
            whileTap={TAP_SCALE}
            href={LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => playGlassClick()}
            className="transform-gpu inline-flex items-center justify-center gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.11] px-3 py-2 text-xs font-semibold text-white/75 hover:text-white hover:bg-white/[0.12] hover:border-white/[0.22] transition-all"
          >
            <LinkedInSvgIcon className="h-3.5 w-3.5" />
            <span>{t.developer.linkedin}</span>
          </motion.a>

          <a
            href={MAILTO_URL}
            onClick={() => playGlassClick()}
            title={EMAIL_ADDRESS}
            className="transform-gpu inline-flex items-center justify-center gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.11] px-3 py-2 text-xs font-semibold text-white/75 hover:text-white hover:bg-white/[0.12] hover:border-white/[0.22] active:scale-[0.97] transition-all"
          >
            <MailSvgIcon className="h-3.5 w-3.5" />
            <span>{t.developer.email}</span>
          </a>
        </div>
      </div>
    </section>
  );
}
