import { useState } from "react";
import { AdminLayout, AdminPageHeader } from "./layout";
import { useAuth } from "@/hooks/use-auth";

export default function AdminBilling() {
  const { token } = useAuth();
  const [fechando, setFechando] = useState(false);
  const [resultado, setResultado] = useState<Array<{ loja_id: string; status: string }> | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

  async function fecharBilling() {
    if (!confirm("Confirma o fechamento do ciclo de billing para TODAS as lojas ativas?")) return;
    setFechando(true);
    setErro(null);
    setResultado(null);
    try {
      const resp = await fetch("/api/billing/fechar", {
        method: "POST",
        headers,
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao fechar billing");
      }
      const data = await resp.json();
      setResultado(data.resultados ?? []);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setFechando(false);
    }
  }

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Billing"
        subtitle="Gestão de faturamento da plataforma"
      />

      <div className="p-8 space-y-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white mb-2">Fechar Ciclo Mensal</h2>
          <p className="text-sm text-gray-400 mb-6">
            Gera os registros de fatura do mês atual para todas as lojas ativas.
            Execute uma vez ao final de cada mês.
          </p>

          {erro && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-xl text-red-300 text-sm">
              {erro}
            </div>
          )}

          {resultado && (
            <div className="mb-4 p-4 bg-green-900/20 border border-green-800 rounded-xl">
              <p className="text-green-300 text-sm font-medium mb-2">
                Ciclo fechado com sucesso — {resultado.length} loja(s) processada(s)
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {resultado.map((r) => (
                  <div key={r.loja_id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 font-mono">{r.loja_id.slice(0, 8)}…</span>
                    <span className={r.status === "gerado" ? "text-green-400" : "text-amber-400"}>{r.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={fecharBilling}
            disabled={fechando}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            {fechando ? "Processando..." : "Fechar Ciclo de Billing"}
          </button>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white mb-2">Preços por Plano</h2>
          <div className="grid grid-cols-3 gap-4 mt-4">
            {[
              { plano: "Starter", preco: "R$ 30", limite: "Até 30 veículos", color: "border-gray-700" },
              { plano: "Pro", preco: "R$ 50", limite: "Até 100 veículos", color: "border-blue-800" },
              { plano: "Full", preco: "R$ 75", limite: "Ilimitado", color: "border-violet-800" },
            ].map((p) => (
              <div key={p.plano} className={`border ${p.color} rounded-xl p-4`}>
                <div className="text-white font-semibold">{p.plano}</div>
                <div className="text-2xl font-bold text-white mt-1">{p.preco}<span className="text-sm text-gray-400 font-normal">/veíc/mês</span></div>
                <div className="text-xs text-gray-400 mt-1">{p.limite}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
