"use client";

import { ImageIcon } from "lucide-react";
import * as React from "react";
import type { Cover } from "@/server/settings";
import { CoverPicker } from "./cover-picker";

export function Hero({ cover, title, subtitle, tone }: { cover: Cover; title: string; subtitle: string; tone?: "warning" }) {
  const [state, setState] = React.useState<"loading" | "ok" | "failed">("loading");
  const [picker, setPicker] = React.useState(false);
  const img = React.useRef<HTMLImageElement>(null);
  React.useEffect(() => {
    const el = img.current;
    if (!el) return;
    if (el.complete) setState(el.naturalWidth > 0 ? "ok" : "failed");
    else setState("loading");
  }, [cover.url]);
  return (
    <section className="relative h-[420px] w-full overflow-hidden sm:h-[460px]">
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 30% 20%, color-mix(in oklab, var(--accent) 35%, ${cover.color ?? "#111"}), ${cover.color ?? "#0b0b0d"} 70%)` }} />
      {state !== "failed" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={img}
          src={cover.url}
          alt=""
          className={`absolute inset-0 size-full object-cover transition-opacity duration-700 ${state === "ok" ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setState("ok")}
          onError={() => setState("failed")}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-bg via-bg/60 to-transparent" />
      <div className="relative mx-auto flex h-full max-w-5xl flex-col items-center justify-center px-5 pb-24 text-center">
        <h1 className="text-balance text-[30px] font-bold leading-tight tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.5)] sm:text-[42px]">{title}</h1>
        <p className={`mt-2 text-[14.5px] drop-shadow ${tone === "warning" ? "text-amber-200" : "text-white/80"}`}>{subtitle}</p>
      </div>
      <div className="absolute bottom-28 right-4 hidden items-center gap-3 sm:flex">
        {cover.author && (
          <a href={`${cover.authorUrl ?? "https://unsplash.com"}?utm_source=orbita&utm_medium=referral`} target="_blank" rel="noreferrer" className="text-[11.5px] text-white/60 hover:text-white">
            Foto de {cover.author} no Unsplash
          </a>
        )}
        <button onClick={() => setPicker(true)} className="glass flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[12.5px] text-white/90 hover:text-white">
          <ImageIcon className="size-3.5" /> Trocar capa
        </button>
      </div>
      <button onClick={() => setPicker(true)} className="glass absolute bottom-28 right-4 grid size-8 place-items-center rounded-lg border border-white/10 text-white sm:hidden" aria-label="Trocar capa">
        <ImageIcon className="size-4" />
      </button>
      <CoverPicker open={picker} onOpenChange={setPicker} current={cover.url} />
    </section>
  );
}
