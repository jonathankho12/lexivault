import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["msedge-tts", "ws"],
};

if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev({
    remoteBindings: Boolean(process.env.CLOUDFLARE_API_TOKEN),
  });
}

export default nextConfig;
