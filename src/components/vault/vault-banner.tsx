import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { vaultHealth } from "@/server/vault";

/** Aviso exibido quando o vault está configurado mas inacessível (ex.: token sem permissão). */
export async function VaultBanner() {
  const h = await vaultHealth();
  if (!h.configured || h.ok) return null;
  return (
    <div role="alert" className="flex gap-3 rounded-xl border border-warning/40 bg-warning/5 p-4 text-[13px]">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
      <div className="space-y-1">
        <p className="font-medium text-fg">Não consegui ler o vault — o inventário e a lista de monitoramento ficam vazios até resolver.</p>
        <p className="text-muted">{h.error}</p>
        <Link href="/integracoes" className="text-[12px] text-accent hover:underline">Ver integrações →</Link>
      </div>
    </div>
  );
}
