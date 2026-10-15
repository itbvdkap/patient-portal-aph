import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

function createNextConfig(phase: string): NextConfig {
  return {
    poweredByHeader: false,
    allowedDevOrigins: ["192.168.2.8"],
    // Keep the dev server cache separate from `next build`.
    // Otherwise running a production build while localhost:3001 is open can
    // overwrite dev CSS/JS manifests and make pages render as unstyled HTML.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    async headers() {
      return ["/admin/:path*", "/api/admin/:path*"].map(source => ({ source, headers: [
        { key: "Cache-Control", value: "no-store, private" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ] }));
    },
  };
}

export default createNextConfig;
