"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BookmarkPlus, Check, Loader2, Sparkles } from "lucide-react";
import { AudioButton } from "@/components/ui/AudioButton";
import { useLanguage } from "@/context/LanguageContext";
import { useLexiVault } from "@/context/LexiVaultContext";
import { TAP_SCALE } from "@/lib/motion";
import { cn, findLocalDuplicateWord, formatCefrBadgeClass } from "@/lib/utils";
import type { IeltsVocabItem } from "@/types/ielts";

export function SaveToVaultButton({
  term,
  sourceTag = "ielts",
  compact = false,
  className,
}: {
  term: string;
  sourceTag?: string;
  compact?: boolean;
  className?: string;
}) {
  const { words, addWordViaAI } = useLexiVault();
  const { lang } = useLanguage();
  const isEn = lang === "en";
  const isRu = lang === "ru";
  const pick = (en: string, id: string, ru: string) =>
    isEn ? en : isRu ? ru : id;

  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const cleanTerm = term.trim();
  const alreadyInVault = useMemo(() => {
    if (!cleanTerm) return false;
    return Boolean(findLocalDuplicateWord(cleanTerm, words));
  }, [words, cleanTerm]);

  const saved = alreadyInVault || justSaved;

  const handleSave = async () => {
    if (!cleanTerm || saving || saved) return;
    setSaving(true);
    try {
      const res = await addWordViaAI(cleanTerm, sourceTag);
      if (res.ok || res.duplicate) {
        setJustSaved(true);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!cleanTerm) return null;

  return (
    <motion.button
      type="button"
      whileTap={saved ? undefined : TAP_SCALE}
      disabled={saving || saved}
      onClick={() => void handleSave()}
      title={
        saved
          ? pick(
              "Already saved in your Vault",
              "Sudah tersimpan di Vault",
              "Уже в словаре"
            )
          : pick(
              `Save "${cleanTerm}" to Vault`,
              `Simpan "${cleanTerm}" ke Vault`,
              `Сохранить «${cleanTerm}» в словарь`
            )
      }
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold transition-colors shrink-0",
        compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
        saved
          ? "bg-[#30D158]/18 border-[#30D158]/40 text-[#7CF099] cursor-default"
          : "bg-[#0A84FF]/15 border-[#0A84FF]/35 text-[#70BCFF] hover:bg-[#0A84FF]/25 cursor-pointer disabled:opacity-60",
        className
      )}
    >
      {saving ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : saved ? (
        <Check className="h-3 w-3" />
      ) : (
        <BookmarkPlus className="h-3 w-3" />
      )}
      <span>
        {saving
          ? pick("Saving...", "Menyimpan...", "Сохраняю...")
          : saved
            ? pick("Saved ✓", "Tersimpan ✓", "Сохранено ✓")
            : pick("+ Save to Vault", "+ Simpan ke Vault", "+ В словарь")}
      </span>
    </motion.button>
  );
}

export function IeltsVocabStrip({
  items,
  title,
  sourceTag = "ielts",
}: {
  items: IeltsVocabItem[];
  title?: string;
  sourceTag?: string;
}) {
  const { lang } = useLanguage();
  const isEn = lang === "en";
  const isRu = lang === "ru";
  const pick = (en: string, id: string, ru: string) =>
    isEn ? en : isRu ? ru : id;

  const uniqueItems = useMemo(() => {
    const seen = new Set<string>();
    const out: IeltsVocabItem[] = [];
    for (const item of items) {
      const clean = item.term?.trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...item, term: clean });
    }
    return out;
  }, [items]);

  if (uniqueItems.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/[0.09] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#70BCFF]" />
          <p className="text-xs font-semibold uppercase tracking-wider text-[#D1D1D6]">
            {title ||
              pick(
                "Upgraded Vocabulary & Collocations",
                "Kosakata & Kolokasi Upgrade",
                "Лексика и сочетания для апгрейда"
              )}
          </p>
        </div>
        <span className="text-[11px] text-[#8E8E93]">
          {pick(
            "1-click save to Vault",
            "1-klik simpan ke Vault",
            "В 1 клик в словарь"
          )}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {uniqueItems.map((item) => (
          <div
            key={item.term}
            className="flex items-start justify-between gap-2.5 rounded-2xl bg-black/25 border border-white/[0.07] p-3"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs sm:text-sm font-semibold text-white">
                  {item.term}
                </span>
                {item.cefr && (
                  <span
                    className={cn(
                      "rounded-full border px-1.5 py-0.2 text-[10px] font-bold",
                      formatCefrBadgeClass(item.cefr)
                    )}
                  >
                    {item.cefr}
                  </span>
                )}
                {item.category && (
                  <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-[#8E8E93] capitalize">
                    {item.category}
                  </span>
                )}
              </div>
              {item.note && (
                <p className="text-[11px] text-[#AEAEB2] leading-snug">
                  {item.note}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <AudioButton text={item.term} size="sm" />
              <SaveToVaultButton
                term={item.term}
                sourceTag={sourceTag}
                compact
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
