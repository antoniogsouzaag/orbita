import { execSync } from "node:child_process";
import type { NextConfig } from "next";

/** Commit do build: variável da plataforma (Coolify, CI) ou o git da pasta; vazio se nenhum souber. */
function buildCommit(): string {
  const isSha = (value: string | undefined): value is string => /^[0-9a-f]{7,40}$/.test(value ?? "");
  for (const value of [process.env.SOURCE_COMMIT, process.env.GITHUB_SHA]) if (isSha(value)) return value;
  try {
    const sha = execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return isSha(sha) ? sha : "";
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  distDir: process.env.ORBITA_DIST_DIR || ".next",
  env: { ORBITA_COMMIT: buildCommit() },
  // App totalmente dinâmico (dados pessoais por requisição): usamos o modelo
  // clássico de cache em vez de Cache Components.
  cacheComponents: false,
  serverExternalPackages: ["@electric-sql/pglite", "node-ical"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  poweredByHeader: false,
  async headers() {
    const security = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=()" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ];
    return [{ source: "/:path*", headers: security }];
  },
  turbopack: {
    rules: {
      "*.css": {
        // CSS Modules precisam manter a extensão e os exports do Turbopack.
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
