import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = localFont({ src: "./fonts/inter-latin.woff2", variable: "--font-inter", weight: "100 900", style: "normal", display: "swap" });
const mono = localFont({ src: "./fonts/jetbrains-mono-latin.woff2", variable: "--font-mono", weight: "100 800", style: "normal", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Órbita", template: "%s · Órbita" },
  description: "Central operacional pessoal e da AG LABS.",
  applicationName: "Órbita",
  appleWebApp: { capable: true, title: "Órbita", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#08080a" },
    { media: "(prefers-color-scheme: light)", color: "#f5f5f3" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

async function appearance() {
  try {
    const { getSettings } = await import("@/server/settings");
    const s = await getSettings();
    return { accent: s.accent };
  } catch {
    return { accent: "cyan" };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const a = await appearance();
  return (
    <html lang="pt-BR" data-accent={a.accent} className={`${inter.variable} ${mono.variable} antialiased`} suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
