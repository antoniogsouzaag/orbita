"use client";

import { ThemeProvider } from "next-themes";
import { ConfirmationHost } from "@/components/ui/confirm-action";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      {children}
      <ConfirmationHost />
      <Toaster position="bottom-center" offset={96} toastOptions={{ className: "!rounded-xl !border !border-border-strong !bg-surface-2 !text-fg !text-[13px]" }} />
    </ThemeProvider>
  );
}
