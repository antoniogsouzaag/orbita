import { Wallet } from "lucide-react";
import { FinancePage } from "@/components/life/finance-page";
import { PageHeader } from "@/components/ui/card";
import { today } from "@/lib/dates";
import { financeHistory, financeMonth } from "@/server/life";

export const metadata = { title: "Finanças" };

export default async function Page({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const ym = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : today().slice(0, 7);
  const [month, history] = await Promise.all([financeMonth(ym), financeHistory(6)]);
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader icon={<Wallet />} title="Finanças" description="Entradas e saídas pessoais do mês." />
      <FinancePage ym={ym} rows={month.rows} income={month.income} expense={month.expense} categories={month.categories} history={history} />
    </div>
  );
}
