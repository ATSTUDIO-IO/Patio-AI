import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import type { UserInfo } from "@/hooks/use-auth";
import type { MeResponse } from "@workspace/api-client-react";
import { safeAuthReturnTo } from "@/lib/auth-navigation";

export default function PainelLogin() {
  const [, setLocation] = useLocation();
  const { setAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);
  const search = new URLSearchParams(window.location.search);
  const expired = search.get("reason") === "session-expired";
  const returnTo = safeAuthReturnTo(search.get("returnTo"));

  const loginMutation = useLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEntering(true);
    try {
      const resp = await loginMutation.mutateAsync({ data: { email, senha } });
      const meResp = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${resp.token}` } });
      if (!meResp.ok) {
        throw new Error(meResp.status === 401
          ? "Não foi possível validar a nova sessão. Entre novamente."
          : "Não foi possível carregar sua conta. Tente novamente.");
      }
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
        plano_config: meData.plano_config ?? null,
      };
      setAuth(resp.token, user);
      const allowedReturn = returnTo && (user.perfil === "admin_patioai" || !returnTo.startsWith("/admin"));
      setLocation(allowedReturn ? returnTo : user.perfil === "admin_patioai" ? "/admin" : "/painel");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao fazer login";
      setErro(msg.replace(/HTTP \d+: /, ""));
    } finally {
      setEntering(false);
    }
  };

  return (
    <div className="min-h-screen bg-login-gradient flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/favicon.svg" alt="PátioAI" className="w-14 h-14 rounded-2xl shadow-lg mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-sidebar-foreground">Pátio AI</h1>
          <p className="text-sidebar-foreground/50 text-sm mt-1">Painel do Lojista</p>
        </div>

        <div className="bg-card rounded-2xl p-6 shadow-2xl border border-border">
          <h2 className="text-foreground font-semibold text-lg mb-5">Entrar na conta</h2>

          {expired && <div role="status" className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-900 text-sm">
            Sua sessão expirou ou foi encerrada. Entre novamente para continuar.
            {returnTo?.startsWith("/painel/veiculos/") && " Entre na mesma conta para retomar o rascunho salvo nesta aba."}
          </div>}
          {erro && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {erro}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">E-mail</label>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                className="w-full border border-input rounded-xl px-3 py-2.5 text-sm text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Senha</label>
              <input
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full border border-input rounded-xl px-3 py-2.5 text-sm text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={entering}
              className="w-full py-3 rounded-xl btn-primary font-semibold text-sm"
            >
              {entering ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="text-center text-muted-foreground text-sm mt-5">
            Ainda não tem conta?{" "}
            <Link href="/painel/cadastro" className="text-accent font-medium hover:underline">Cadastrar loja</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
