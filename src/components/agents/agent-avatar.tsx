"use client";

import { Camera, Loader2, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { saveAgentAvatarAction } from "@/app/actions/agents";
import { toSquareDataUrl } from "@/lib/image-resize";
import { cn } from "@/lib/utils";

const hueOf = (id: string) => [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 360, 7);
const initialsOf = (name: string) => name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/** Foto do agente ou, sem foto, as iniciais sobre um tom derivado do nome. */
export function AgentAvatar({ id, name, emoji, src, className, textClassName }: { id: string; name: string; emoji?: string; src: string | null; className?: string; textClassName?: string }) {
  const hue = hueOf(id);
  return (
    <span className={cn("relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl ring-1 ring-border", className)} style={{ background: `linear-gradient(140deg, hsl(${hue} 70% 55% / .28), hsl(${(hue + 40) % 360} 70% 45% / .12))` }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className={cn("text-[15px] font-semibold tracking-tight text-fg/80", textClassName)} aria-hidden>{initialsOf(name) || emoji}</span>
      )}
    </span>
  );
}

/** Foto grande da ficha: clicar troca a imagem (recortada e reduzida no navegador). */
export function AgentAvatarEditor({ id, name, emoji, src }: { id: string; name: string; emoji: string; src: string | null }) {
  const input = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState(src);
  const [pending, start] = React.useTransition();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return void toast.error("Escolha um arquivo de imagem.");
    let dataUrl: string;
    try { dataUrl = await toSquareDataUrl(file, 512); } catch { return void toast.error("Não consegui ler essa imagem."); }
    const before = preview;
    setPreview(dataUrl);
    start(async () => {
      const r = await saveAgentAvatarAction(id, dataUrl);
      if (r.ok) toast.success(`Foto de ${name} atualizada`);
      else { setPreview(before); toast.error(r.error); }
    });
  };
  const remove = () => {
    const before = preview;
    setPreview(null);
    start(async () => {
      const r = await saveAgentAvatarAction(id, null);
      if (r.ok) toast.success("Foto removida");
      else { setPreview(before); toast.error(r.error); }
    });
  };

  return (
    <div className="group relative shrink-0">
      <button type="button" onClick={() => input.current?.click()} disabled={pending} aria-label={preview ? `Trocar a foto de ${name}` : `Adicionar foto de ${name}`}
        className="relative block rounded-[28px] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
        <AgentAvatar id={id} name={name} emoji={emoji} src={preview} className="size-28 rounded-[28px] sm:size-36" textClassName="text-[34px] sm:text-[42px]" />
        <span className={cn("absolute inset-0 grid place-items-center rounded-[28px] bg-black/45 text-white opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100", pending && "opacity-100")}>
          {pending ? <Loader2 className="size-6 animate-spin" /> : <span className="flex flex-col items-center gap-1 text-[11.5px] font-medium"><Camera className="size-5" />{preview ? "Trocar foto" : "Adicionar foto"}</span>}
        </span>
      </button>
      {preview && !pending && (
        <button type="button" onClick={remove} aria-label="Remover foto" title="Remover foto"
          className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full border border-border bg-surface text-muted opacity-0 shadow transition hover:text-danger group-hover:opacity-100 focus-visible:opacity-100">
          <Trash2 className="size-3.5" />
        </button>
      )}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
