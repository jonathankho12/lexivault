"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eraser,
  History,
  Loader2,
  Sparkles,
  SpellCheck,
  Trash2,
  Wand2,
} from "lucide-react";
import { IOS_EASE, IOS_SPRING, TAP_SCALE } from "@/lib/motion";
import { playGlassClick } from "@/lib/soundEffects";
import { cn } from "@/lib/utils";
import type {
  GrammarCheckContext,
  GrammarCheckResult,
  GrammarCheckVerdict,
} from "@/types/lexivault";

const MAX_CHARS = 600;
const MAX_RECENT_CHECKS = 10;
const RECENT_CHECKS_STORAGE_KEY = "lexivault_grammar_recent_checks_v1";

interface RecentGrammarCheck {
  id: string;
  text: string;
  context: GrammarCheckContext;
  result: GrammarCheckResult;
  checkedAt: string;
}

const CONTEXT_OPTIONS: Array<{
  id: GrammarCheckContext;
  label: string;
  hint: string;
}> = [
  { id: "auto", label: "Auto", hint: "Smart register detection" },
  { id: "casual", label: "Casual", hint: "Everyday conversation" },
  { id: "academic", label: "Academic / IELTS", hint: "Formal & scholarly" },
  { id: "work", label: "Work", hint: "Professional & email" },
];

const QUICK_SAMPLES: Array<{
  label: string;
  text: string;
  context: GrammarCheckContext;
}> = [
  {
    label: "Fragment fix",
    text: "Because I was stuck in heavy traffic on my way to the office.",
    context: "work",
  },
  {
    label: "Academic polish",
    text: "Nowadays, many people thinks technology make life more easy.",
    context: "academic",
  },
  {
    label: "Natural phrasing",
    text: "I am looking forward to meet you next Monday for discuss the project.",
    context: "work",
  },
];

const VERDICT_META: Record<
  GrammarCheckVerdict,
  {
    badgeClass: string;
    cardBorderClass: string;
    dotClass: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  correct: {
    badgeClass:
      "bg-[#30D158]/15 border-[#30D158]/40 text-[#6EE798]",
    cardBorderClass: "border-[#30D158]/25",
    dotClass: "bg-[#30D158]",
    icon: CheckCircle2,
  },
  fragment: {
    badgeClass:
      "bg-[#FF9F0A]/15 border-[#FF9F0A]/40 text-[#FFD18C]",
    cardBorderClass: "border-[#FF9F0A]/25",
    dotClass: "bg-[#FF9F0A]",
    icon: AlertTriangle,
  },
  unnatural: {
    badgeClass:
      "bg-[#5E5CE6]/20 border-[#8E8AFF]/40 text-[#C2C0FF]",
    cardBorderClass: "border-[#8E8AFF]/25",
    dotClass: "bg-[#8E8AFF]",
    icon: Wand2,
  },
  incorrect: {
    badgeClass:
      "bg-[#FF453A]/15 border-[#FF453A]/40 text-[#FF8982]",
    cardBorderClass: "border-[#FF453A]/25",
    dotClass: "bg-[#FF453A]",
    icon: AlertCircle,
  },
};

function getContextLabel(ctx: GrammarCheckContext): string {
  return CONTEXT_OPTIONS.find((opt) => opt.id === ctx)?.label ?? "Auto";
}

function formatRelativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function loadRecentChecksFromStorage(): RecentGrammarCheck[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_CHECKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentGrammarCheck =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as RecentGrammarCheck).id === "string" &&
          typeof (item as RecentGrammarCheck).text === "string" &&
          typeof (item as RecentGrammarCheck).context === "string" &&
          Boolean((item as RecentGrammarCheck).result) &&
          typeof (item as RecentGrammarCheck).result.correctedText === "string"
      )
      .slice(0, MAX_RECENT_CHECKS);
  } catch {
    return [];
  }
}

function saveRecentChecksToStorage(items: RecentGrammarCheck[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RECENT_CHECKS_STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_RECENT_CHECKS))
    );
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall back to execCommand below
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function GrammarCheckerView() {
  const [text, setText] = useState("");
  const [context, setContext] = useState<GrammarCheckContext>("auto");
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GrammarCheckResult | null>(null);
  const [checkedContext, setCheckedContext] =
    useState<GrammarCheckContext>("auto");
  const [recentChecks, setRecentChecks] = useState<RecentGrammarCheck[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRecentChecks(loadRecentChecksFromStorage());
    return () => {
      abortRef.current?.abort();
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopy = useCallback(async (key: string, value: string) => {
    if (!value) return;
    playGlassClick();
    const ok = await copyTextToClipboard(value);
    if (!ok) return;
    setCopiedKey(key);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1800);
  }, []);

  const pushRecentCheck = useCallback(
    (
      checkedText: string,
      ctx: GrammarCheckContext,
      checkedResult: GrammarCheckResult
    ) => {
      const normalizedKey = `${ctx}::${checkedText.toLowerCase()}`;
      const newEntry: RecentGrammarCheck = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: checkedText,
        context: ctx,
        result: checkedResult,
        checkedAt: new Date().toISOString(),
      };

      setRecentChecks((prev) => {
        const filtered = prev.filter(
          (item) => `${item.context}::${item.text.toLowerCase()}` !== normalizedKey
        );
        const next = [newEntry, ...filtered].slice(0, MAX_RECENT_CHECKS);
        saveRecentChecksToStorage(next);
        return next;
      });
    },
    []
  );

  const handleCheck = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || isChecking) return;

    playGlassClick();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsChecking(true);
    setError(null);

    try {
      const response = await fetch("/api/grammar-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          text: trimmed.slice(0, MAX_CHARS),
          context,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<
        GrammarCheckResult
      > & { error?: string };

      if (!response.ok) {
        throw new Error(
          payload.error || "Unable to analyze grammar right now. Please try again."
        );
      }

      const normalized: GrammarCheckResult = {
        verdict: payload.verdict ?? "correct",
        verdictLabel: payload.verdictLabel || "Checked",
        correctedText: payload.correctedText || trimmed,
        explanation: payload.explanation || "Evaluation complete.",
        issues: Array.isArray(payload.issues) ? payload.issues : [],
        alternatives: Array.isArray(payload.alternatives)
          ? payload.alternatives
          : [],
      };

      setResult(normalized);
      setCheckedContext(context);
      pushRecentCheck(trimmed, context, normalized);
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while checking grammar."
      );
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsChecking(false);
    }
  }, [context, isChecking, pushRecentCheck, text]);

  const handleClear = useCallback(() => {
    playGlassClick();
    abortRef.current?.abort();
    abortRef.current = null;
    setText("");
    setError(null);
    setResult(null);
    setIsChecking(false);
  }, []);

  const handleRestoreRecent = useCallback((entry: RecentGrammarCheck) => {
    playGlassClick();
    abortRef.current?.abort();
    abortRef.current = null;
    setIsChecking(false);
    setError(null);
    setText(entry.text);
    setContext(entry.context);
    setCheckedContext(entry.context);
    setResult(entry.result);
  }, []);

  const handleClearHistory = useCallback(() => {
    playGlassClick();
    setRecentChecks([]);
    saveRecentChecksToStorage([]);
  }, []);

  const charCount = text.length;
  const charCounterClass =
    charCount >= MAX_CHARS
      ? "text-[#FF8982]"
      : charCount >= 520
        ? "text-[#FFD18C]"
        : "text-[#8E8E93]";

  const verdictMeta = result ? VERDICT_META[result.verdict] : null;
  const VerdictIcon = verdictMeta?.icon ?? CheckCircle2;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF]/15 border border-[#0A84FF]/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#70BCFF] mb-2">
            <SpellCheck className="h-3.5 w-3.5" />
            <span>AI Grammar &amp; Phrasing Checker</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Grammar &amp; Phrasing
          </h2>
          <p className="mt-1 text-sm text-[#8E8E93] max-w-2xl">
            Paste any sentence, phrase, or short paragraph to catch grammar errors, sentence fragments, and awkward wording—with 3 context-aware native rewrites.
          </p>
        </div>
      </header>

      {/* Composer Card */}
      <section className="liquid-glass rounded-3xl p-4 sm:p-6 space-y-4">
        {/* Context Pill Selector */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">
            Target Context
          </span>
          <div
            role="radiogroup"
            aria-label="Target Context"
            className="flex flex-wrap gap-1.5"
          >
            {CONTEXT_OPTIONS.map((opt) => {
              const active = context === opt.id;
              return (
                <motion.button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  whileTap={TAP_SCALE}
                  onClick={() => {
                    playGlassClick();
                    setContext(opt.id);
                  }}
                  title={opt.hint}
                  className={cn(
                    "relative rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer select-none border",
                    active
                      ? "bg-[#0A84FF]/22 border-[#0A84FF]/55 text-white shadow-[0_0_20px_rgba(10,132,255,0.2)]"
                      : "bg-white/[0.04] border-white/[0.09] text-[#8E8E93] hover:text-[#F5F5F7] hover:bg-white/[0.08]"
                  )}
                >
                  {opt.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Textarea */}
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                void handleCheck();
              }
            }}
            maxLength={MAX_CHARS}
            rows={4}
            placeholder="Write or paste an English sentence, phrase, or short paragraph to check..."
            aria-label="English text to check"
            className="w-full resize-y min-h-[124px] max-h-[280px] rounded-2xl bg-black/40 border border-white/[0.1] px-4 py-3.5 pb-9 text-sm sm:text-[15px] leading-relaxed text-[#F5F5F7] placeholder:text-[#636366] focus:outline-none focus:border-[#0A84FF]/65 focus:ring-2 focus:ring-[#0A84FF]/20 transition-all"
          />
          <div className="pointer-events-none absolute bottom-3 right-3.5 flex items-center gap-2">
            <span
              className={cn(
                "text-[11px] font-semibold tabular-nums",
                charCounterClass
              )}
            >
              {charCount}/{MAX_CHARS}
            </span>
          </div>
        </div>

        {/* Quick sample suggestions when empty */}
        {!text && !result && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[#8E8E93] mr-1">Try:</span>
            {QUICK_SAMPLES.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => {
                  playGlassClick();
                  setText(sample.text);
                  setContext(sample.context);
                  setError(null);
                }}
                className="rounded-full bg-white/[0.04] border border-white/[0.08] px-2.5 py-1 text-[11px] font-medium text-[#D1D1D6] hover:bg-white/[0.09] hover:text-white transition-colors cursor-pointer"
              >
                {sample.label}
              </button>
            ))}
          </div>
        )}

        {/* Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <div className="flex items-center gap-2 text-[11px] text-[#8E8E93]">
            <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 font-mono text-[10px] text-[#D1D1D6]">
              Ctrl + Enter
            </span>
            <span className="hidden sm:inline">to check immediately</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={handleClear}
              disabled={!text && !result && !error && !isChecking}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.1] px-4 py-2 text-xs font-semibold text-[#D1D1D6] hover:bg-white/[0.11] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <Eraser className="h-3.5 w-3.5" />
              <span>Clear</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={TAP_SCALE}
              onClick={() => void handleCheck()}
              disabled={!text.trim() || isChecking}
              className="inline-flex items-center gap-2 rounded-full bg-[#0A84FF] px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-[0_8px_24px_rgba(10,132,255,0.35)] hover:bg-[#1A8EFF] disabled:opacity-45 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              {isChecking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Check Grammar</span>
                </>
              )}
            </motion.button>
          </div>
        </div>
      </section>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: IOS_EASE }}
          className="flex items-start justify-between gap-3 rounded-2xl border border-[#FF453A]/35 bg-[#FF453A]/10 px-4 py-3.5 text-sm text-[#FF8982]"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void handleCheck()}
            disabled={!text.trim() || isChecking}
            className="shrink-0 rounded-full bg-[#FF453A]/20 border border-[#FF453A]/40 px-3 py-1 text-xs font-semibold text-white hover:bg-[#FF453A]/30 cursor-pointer"
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* Loading Skeleton */}
      {isChecking && (
        <section className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-36 rounded-full bg-white/[0.08] shimmer-glass" />
            <div className="h-5 w-20 rounded-full bg-white/[0.06] shimmer-glass" />
          </div>
          <div className="h-4 w-5/6 rounded-lg bg-white/[0.07] shimmer-glass" />
          <div className="h-20 w-full rounded-2xl bg-white/[0.06] shimmer-glass" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className="h-28 rounded-2xl bg-white/[0.05] shimmer-glass"
              />
            ))}
          </div>
        </section>
      )}

      {/* Result Card */}
      {result && !isChecking && verdictMeta && (
        <motion.section
          key={`${result.verdict}-${result.correctedText}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={IOS_SPRING}
          className={cn(
            "liquid-glass-elevated rounded-3xl p-5 sm:p-6 space-y-5 border",
            verdictMeta.cardBorderClass
          )}
        >
          {/* Verdict Header & Explanation */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold",
                    verdictMeta.badgeClass
                  )}
                >
                  <VerdictIcon className="h-3.5 w-3.5" />
                  <span>{result.verdictLabel}</span>
                </span>
                <span className="rounded-full bg-white/[0.06] border border-white/[0.1] px-2.5 py-0.5 text-[11px] font-medium text-[#D1D1D6]">
                  Context: {getContextLabel(checkedContext)}
                </span>
              </div>
            </div>
            <p className="text-sm sm:text-[15px] leading-relaxed text-[#E5E5EA]">
              {result.explanation}
            </p>
          </div>

          {/* Corrected Version + Compact Issues List */}
          <div className="rounded-2xl bg-white/[0.045] border border-white/[0.1] p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                Corrected Version
              </span>
              <motion.button
                type="button"
                whileTap={TAP_SCALE}
                onClick={() =>
                  void handleCopy("corrected", result.correctedText)
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors cursor-pointer",
                  copiedKey === "corrected"
                    ? "bg-[#30D158]/20 border-[#30D158]/45 text-[#6EE798]"
                    : "bg-white/[0.06] border-white/[0.12] text-[#F5F5F7] hover:bg-white/[0.12]"
                )}
              >
                {copiedKey === "corrected" ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </motion.button>
            </div>

            <p className="text-base sm:text-lg font-medium leading-relaxed text-white select-text">
              {result.correctedText}
            </p>

            {result.issues.length > 0 ? (
              <div className="pt-2.5 border-t border-white/[0.08] space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                  Key Fixes ({result.issues.length})
                </p>
                <ul className="space-y-1.5">
                  {result.issues.map((issue, idx) => (
                    <li
                      key={`${issue.original}-${idx}`}
                      className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 rounded-xl bg-black/25 border border-white/[0.06] px-3 py-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <span className="line-through text-[#FF8982]/90 font-medium">
                          {issue.original}
                        </span>
                        <ArrowRight className="h-3 w-3 text-[#8E8E93]" />
                        <span className="text-[#6EE798] font-semibold">
                          {issue.correction}
                        </span>
                      </div>
                      <span className="text-[#A1A1A6] leading-snug">
                        {issue.reason}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="pt-2 border-t border-white/[0.08] flex items-center gap-1.5 text-xs text-[#6EE798]">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>No specific grammar fixes needed.</span>
              </div>
            )}
          </div>

          {/* 3 Context-Aware Rewrites */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">
                Context-Aware Rewrites
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {result.alternatives.slice(0, 3).map((alt, idx) => {
                const copyId = `alt-${idx}`;
                const isCopied = copiedKey === copyId;
                return (
                  <div
                    key={`${alt.context}-${idx}`}
                    className="flex flex-col justify-between gap-3 rounded-2xl bg-white/[0.04] border border-white/[0.09] p-4 hover:border-white/[0.16] transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center rounded-full bg-[#0A84FF]/15 border border-[#0A84FF]/30 px-2.5 py-0.5 text-[11px] font-semibold text-[#70BCFF]">
                          {alt.context}
                        </span>
                        <motion.button
                          type="button"
                          whileTap={TAP_SCALE}
                          onClick={() => void handleCopy(copyId, alt.example)}
                          aria-label={`Copy ${alt.context} rewrite`}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer",
                            isCopied
                              ? "bg-[#30D158]/20 border-[#30D158]/45 text-[#6EE798]"
                              : "bg-white/[0.05] border-white/[0.1] text-[#D1D1D6] hover:bg-white/[0.12] hover:text-white"
                          )}
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3 w-3" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </motion.button>
                      </div>
                      <p className="text-sm font-medium leading-relaxed text-[#F5F5F7] select-text">
                        {alt.example}
                      </p>
                    </div>
                    <p className="text-xs leading-relaxed text-[#8E8E93] pt-2 border-t border-white/[0.06]">
                      {alt.note}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.section>
      )}

      {/* Recent Checks (last 10 in localStorage) */}
      <section className="liquid-glass rounded-3xl p-4 sm:p-6 space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-[#0A84FF]" />
            <h3 className="text-sm font-semibold text-white">Recent Checks</h3>
            {recentChecks.length > 0 && (
              <span className="rounded-full bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 text-[10px] font-semibold text-[#8E8E93] tabular-nums">
                {recentChecks.length}/{MAX_RECENT_CHECKS}
              </span>
            )}
          </div>
          {recentChecks.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/[0.08] px-2.5 py-1 text-[11px] font-medium text-[#8E8E93] hover:text-[#FF8982] hover:border-[#FF453A]/30 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
              <span>Clear history</span>
            </button>
          )}
        </div>

        {recentChecks.length === 0 ? (
          <p className="text-xs text-[#8E8E93] py-2">
            Your last 10 grammar checks will appear here for quick review.
          </p>
        ) : (
          <div className="space-y-2">
            {recentChecks.map((entry) => {
              const meta =
                VERDICT_META[entry.result.verdict] ?? VERDICT_META.correct;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => handleRestoreRecent(entry)}
                  className="w-full text-left rounded-2xl bg-white/[0.035] border border-white/[0.07] px-3.5 py-3 hover:bg-white/[0.07] hover:border-white/[0.14] transition-colors cursor-pointer group"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          meta.dotClass
                        )}
                      />
                      <span className="text-[11px] font-semibold text-[#D1D1D6]">
                        {entry.result.verdictLabel}
                      </span>
                      <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-[#8E8E93]">
                        {getContextLabel(entry.context)}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#8E8E93]">
                      <Clock className="h-3 w-3" />
                      <span>{formatRelativeTime(entry.checkedAt)}</span>
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#F5F5F7] line-clamp-1 group-hover:text-white">
                    {entry.text}
                  </p>
                  {entry.result.correctedText &&
                    entry.result.correctedText !== entry.text && (
                      <p className="mt-0.5 text-xs text-[#8E8E93] line-clamp-1">
                        → {entry.result.correctedText}
                      </p>
                    )}
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
