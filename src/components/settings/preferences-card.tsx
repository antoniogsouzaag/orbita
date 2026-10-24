"use client";

import { toSquareDataUrl } from "@/lib/image-resize";
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
              const url = await toSquareDataUrl(file);
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
