import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

function createNextConfig(phase: string): NextConfig {
  return {
    poweredByHeader: false,
    // Keep the dev server cache separate from `next build`.
    // Otherwise running a production build while localhost:3001 is open can
    // overwrite dev CSS/JS manifests and make pages render as unstyled HTML.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  };
}

export default createNextConfig;
