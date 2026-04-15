import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useRegisterLoja, useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import type { UserInfo } from "@/hooks/use-auth";
import type { MeResponse } from "@workspace/api-client-react";

export default function PainelCadastro() {
  const [, setLocation] = useLocation();
  const { setAuth } = useAuth();
  const [form, setForm] = useState({
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    telefone: "",
    cidade: "",
    plano: "starter" as "starter" | "pro" | "full",
    email: "",
    senha: "",
  });
  const [erro, setErro] = useState<string | null>(null);

  const registerMutation = useRegisterLoja();
  const loginMutation = useLogin();

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await registerMutation.mutateAsync({
        data: {
          razao_social: form.razao_social,
          nome_fantasia: form.nome_fantasia,
          cnpj: form.cnpj,
          telefone: form.telefone || undefined,
          cidade: form.cidade || undefined,
          email: form.email,
          senha: form.senha,
        },
      });
      const loginResp = await loginMutation.mutateAsync({ data: { email: form.email, senha: form.senha } });
      const meResp = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${loginResp.token}` } });
      const meData: MeResponse = await meResp.json();

      const user: UserInfo = {
        id: meData.usuario.id,
        nome: meData.usuario.nome,
        email: meData.usuario.email,
        perfil: meData.usuario.perfil as UserInfo["perfil"],
        loja_id: meData.usuario.loja_id ?? null,
        loja: meData.loja ? { id: meData.loja.id, nome_fantasia: meData.loja.nome_fantasia, plano: meData.loja.plano } : undefined,
      };
      setAuth(loginResp.token, user);
      setLocation("/painel");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao cadastrar";
      setErro(msg.replace(/HTTP \d+: /, ""));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 to-indigo-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">P</div>
          <h1 className="text-2xl font-bold text-white">Pátio AI</h1>
          <p className="text-white/50 text-sm mt-1">Cadastro de Nova Loja</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-xl">
          <h2 className="text-gray-900 font-semibold text-lg mb-5">Criar conta</h2>

          {erro && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{erro}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Nome Fantasia</label>
                <input type="text" value={form.nome_fantasia} onChange={set("nome_fantasia")} required placeholder="Auto Center Silva" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Razão Social</label>
                <input type="text" value={form.razao_social} onChange={set("razao_social")} required placeholder="Silva & Cia Ltda" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">CNPJ</label>
                <input type="text" value={form.cnpj} onChange={set("cnpj")} placeholder="00.000.000/0001-00" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Telefone</label>
                <input type="tel" value={form.telefone} onChange={set("telefone")} placeholder="(11) 99999-9999" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Cidade</label>
                <input type="text" value={form.cidade} onChange={set("cidade")} placeholder="São Paulo, SP" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Plano</label>
                <select value={form.plano} onChange={set("plano")} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="full">Full</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1">E-mail</label>
                <input type="email" value={form.email} onChange={set("email")} required placeholder="dono@loja.com" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1">Senha</label>
                <input type="password" value={form.senha} onChange={set("senha")} required minLength={6} placeholder="Mínimo 6 caracteres" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 space-y-1">
              <p>• Starter: até 30 veículos — R$ 30/veículo/mês</p>
              <p>• Pro: até 100 veículos — R$ 50/veículo/mês</p>
              <p>• Full: ilimitado — R$ 75/veículo/mês</p>
            </div>

            <button
              type="submit"
              disabled={registerMutation.isPending || loginMutation.isPending}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-60"
            >
              {registerMutation.isPending ? "Criando conta..." : "Criar conta e entrar"}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-5">
            Já tem conta?{" "}
            <Link href="/painel/login" className="text-blue-600 font-medium hover:underline">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
