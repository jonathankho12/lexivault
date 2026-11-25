"use client";

export function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="ambient-bg pointer-events-none fixed inset-0 -z-10"
    />
  );
}
