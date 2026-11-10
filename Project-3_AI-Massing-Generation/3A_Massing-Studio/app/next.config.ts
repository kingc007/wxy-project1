import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The shared engine is TypeScript source linked from outside the app (file:../../shared/massing).
  transpilePackages: ["@wxy/massing"],
  turbopack: {
    // Turbopack does not resolve files outside its root; the linked package lives in Project-3/shared.
    root: path.join(__dirname, "..", ".."),
    // rhino3dm.js requires Node-only "ws"; alias it to an empty module in the browser bundle.
    resolveAlias: { ws: "./src/lib/studio/empty-module.ts" },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
