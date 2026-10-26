import Image from "next/image";
import Link from "next/link";
import { BUSINESS_UNITS, MODEL_INFO } from "@/lib/business-models";

/** Acessos estáticos: disponíveis antes das consultas de indicadores e documentação. */
export function BusinessLinks() {
  return (
    <nav aria-label="Negócios do ecossistema" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {BUSINESS_UNITS.map((unit) => (
        <Link
          key={unit.id}
          href={`/empresa/negocios/${unit.id}`}
          prefetch={false}
          className="card group flex min-w-0 items-center gap-2.5 px-3 py-2.5 transition hover:border-border-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-[#101318] p-1.5">
            <Image src={unit.logo} alt="" width={24} height={24} sizes="24px" className="size-6 object-contain" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-semibold leading-5 group-hover:text-accent">{unit.name}</span>
            <span className="block truncate text-[10.5px] leading-4 text-muted">{MODEL_INFO[unit.model].label}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
