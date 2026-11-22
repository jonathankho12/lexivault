"use client";

import React from "react";

export function HighlightedText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          const inner = part.slice(2, -2);
          return (
            <strong
              key={idx}
              className="font-semibold text-[#70BCFF] bg-[#0A84FF]/15 px-1.5 py-0.5 rounded-md border border-[#0A84FF]/25"
            >
              {inner}
            </strong>
          );
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </span>
  );
}
