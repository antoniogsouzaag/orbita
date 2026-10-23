import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
