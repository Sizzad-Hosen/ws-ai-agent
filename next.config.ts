import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      // Avatar uploads travel through a server action, and the default 1 MB
      // cap rejects an ordinary phone photo before any of our own validation
      // runs. `MAX_AVATAR_BYTES` is the limit that actually reports to the
      // user; this only has to be comfortably above it.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
