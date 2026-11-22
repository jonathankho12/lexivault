import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["msedge-tts", "ws"],
};

initOpenNextCloudflareForDev();

export default nextConfig;
