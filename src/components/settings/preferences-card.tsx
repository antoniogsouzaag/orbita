"use client";

import { Camera, Settings2, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { saveAvatar, updateSettings } from "@/app/actions/core";
import { Avatar } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";


export function PreferencesCard({ name, focusMinutes, avatar }: { name: string; accent?: string; focusMinutes: number; avatar: string | null }) {
  const [n, setN] = React.useState(name);
  const [f, setF] = React.useState(String(focusMinutes));
  const [pending, start] = React.useTransition();
  return (
    <Card>
      <CardHeader icon={<Settings2 />} title="Preferências" />
      <div className="space-y-4 px-5 pb-5">
        <AvatarField name={name} avatar={avatar} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Seu nome (saudação)"><Input value={n} onChange={(e) => setN(e.target.value)} /></Field>
          <Field label="Minutos padrão do foco"><Input inputMode="numeric" value={f} onChange={(e) => setF(e.target.value)} /></Field>
        </div>
        <Button size="sm" variant="primary" disabled={pending} onClick={() => start(async () => { await updateSettings({ name: n, focusMinutes: Number(f) || 25 }); toast.success("Preferências salvas"); })}>Salvar</Button>
      </div>
    </Card>
  );
}

/** Recorta no centro (quadrado), reduz para 320 px e converte para WebP no próprio navegador. */
async function toAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(320, side);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  const webp = canvas.toDataURL("image/webp", 0.88);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.88);
}

function AvatarField({ name, avatar }: { name: string; avatar: string | null }) {
  const input = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(avatar);
  const [pending, start] = React.useTransition();
  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} src={preview} className="size-16 text-[18px]" />
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => input.current?.click()}>
            <Camera /> {preview ? "Trocar foto" : "Enviar foto"}
          </Button>
          {preview && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await saveAvatar(null); setPreview(null); toast.success("Foto removida"); })}>
              <Trash2 /> Remover
            </Button>
          )}
        </div>
        <p className="text-[12px] text-faint">JPG, PNG, WebP ou HEIC. A imagem é recortada no centro e reduzida antes de enviar.</p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          start(async () => {
            try {
              const url = await toAvatarDataUrl(file);
              const r = await saveAvatar(url);
              if (!r.ok) return void toast.error(r.error);
              setPreview(url);
              toast.success("Foto atualizada");
            } catch {
              toast.error("Não consegui ler esta imagem. Tente JPG ou PNG.");
            }
          });
        }}
      />
    </div>
  );
}
