"use client";

export function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        backgroundColor: "#000000",
        backgroundImage: [
          "radial-gradient(60% 45% at 15% 5%, rgba(10, 132, 255, 0.14) 0%, rgba(10, 132, 255, 0.03) 45%, transparent 72%)",
          "radial-gradient(55% 45% at 88% 35%, rgba(94, 92, 230, 0.12) 0%, rgba(94, 92, 230, 0.02) 48%, transparent 74%)",
          "radial-gradient(50% 40% at 45% 95%, rgba(48, 209, 88, 0.06) 0%, transparent 68%)",
          "linear-gradient(180deg, #07070B 0%, #030306 55%, #000000 100%)",
        ].join(", "),
      }}
    />
  );
}
