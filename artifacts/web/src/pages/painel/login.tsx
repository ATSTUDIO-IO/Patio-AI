import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import type { UserInfo } from "@/hooks/use-auth";
import type { MeResponse } from "@workspace/api-client-react";

export default function PainelLogin() {
  const [, setLocation] = useLocation();
  const { setAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const loginMutation = useLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      const resp = await loginMutation.mutateAsync({ data: { email, senha } });
      const meResp = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${resp.token}` } });
      const meData: MeResponse = await meResp.json();

      const user: UserInfo = {
        id: meData.usuario.id,
        nome: meData.usuario.nome,
        email: meData.usuario.email,
        perfil: meData.usuario.perfil as UserInfo["perfil"],
        loja_id: meData.usuario.loja_id ?? null,
        loja: meData.loja ? {
          id: meData.loja.id,
          nome_fantasia: meData.loja.nome_fantasia,
          plano: meData.loja.plano,
        } : undefined,
      };
      setAuth(resp.token, user);
      setLocation(user.perfil === "admin_patioai" ? "/admin" : "/painel");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao fazer login";
      setErro(msg.replace(/HTTP \d+: /, ""));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 to-indigo-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">P</div>
          <h1 className="text-2xl font-bold text-white">Pátio AI</h1>
          <p className="text-white/50 text-sm mt-1">Painel do Lojista</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-xl">
          <h2 className="text-gray-900 font-semibold text-lg mb-5">Entrar na conta</h2>

          {erro && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {erro}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-60"
            >
              {loginMutation.isPending ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-5">
            Ainda não tem conta?{" "}
            <Link href="/painel/cadastro" className="text-blue-600 font-medium hover:underline">Cadastrar loja</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
