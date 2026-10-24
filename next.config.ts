import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.ORBITA_DIST_DIR || ".next",
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
