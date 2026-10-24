import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
export function AgentAccessLink({ label = "Configurar acessos" }: { label?: string }) {
 return <Button size="sm" asChild><Link href="/integracoes/mcp"><Plus />{label}</Link></Button>;
}
