"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div role="alert" className="mx-auto max-w-xl px-5 py-24 text-center">
    <div className="card p-8"><h1 className="text-xl font-semibold">Não foi possível abrir esta tela</h1><p className="mt-2 text-sm text-muted">Tente carregar novamente. Se uma integração estiver indisponível, você pode continuar pelos outros módulos.</p><Button className="mt-6" onClick={reset}><RefreshCw /> Tentar novamente</Button></div>
  </div>;
}
