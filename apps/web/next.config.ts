import path from "node:path";
import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";

// Un solo `.env.local` alla radice del monorepo serve Next, Vitest e Playwright.
// forceReload (4° argomento) è necessario: Next chiama già `loadEnvConfig` su
// apps/web prima di eseguire questo file e ne mette in cache il risultato (vuoto,
// perché lì non c'è `.env.local`); senza forceReload la nostra chiamata sulla
// radice restituirebbe quella cache invece di leggere i file veri.
loadEnvConfig(
  path.resolve(__dirname, "../.."),
  process.env.NODE_ENV === "development",
  console,
  true,
);

const nextConfig: NextConfig = {
  // Il package espone sorgenti TypeScript: Next deve compilarli.
  transpilePackages: ["@omnicanvas/realtime", "@omnicanvas/canvas", "@omnicanvas/ai"],
};

export default nextConfig;
