"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      {children}
      <Toaster position="bottom-center" offset={96} toastOptions={{ className: "!rounded-xl !border !border-border-strong !bg-surface-2 !text-fg !text-[13px]" }} />
    </ThemeProvider>
  );
}
