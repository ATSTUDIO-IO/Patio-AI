import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLogout, useGetFaturaAtual } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  donoOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/painel", label: "Dashboard", icon: "📊" },
  { href: "/painel/veiculos", label: "Veículos", icon: "🚗" },
  { href: "/painel/leads", label: "Leads", icon: "👤" },
  { href: "/painel/conversas", label: "Conversas", icon: "💬" },
  { href: "/painel/relatorio-vendas", label: "Rentabilidade", icon: "📈", donoOnly: true },
  { href: "/painel/fatura", label: "Fatura", icon: "💰", donoOnly: true },
  { href: "/painel/configuracoes", label: "Configurações", icon: "⚙️", donoOnly: true },
];

export function PainelLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, clearAuth } = useAuth();
  const qc = useQueryClient();
  const logoutMutation = useLogout();

  const isDono = user?.perfil === "dono" || user?.perfil === "admin_patioai";
  const { data: fatura } = useGetFaturaAtual();

  const handleLogout = async () => {
    try { await logoutMutation.mutateAsync(); } catch { }
    clearAuth();
    qc.clear();
    window.location.href = "/painel/login";
  };

  const visibleItems = NAV_ITEMS.filter((item) => !item.donoOnly || isDono);

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-60 bg-sidebar border-r border-sidebar-border flex flex-col fixed h-full z-10">
        <div className="p-5 border-b border-sidebar-border/50">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="PátioAI" className="w-8 h-8 rounded-lg shadow" />
            <div>
              <p className="font-bold text-sidebar-foreground text-sm leading-none">Pátio AI</p>
              <p className="text-sidebar-foreground/50 text-xs truncate max-w-[120px]">{user?.loja?.nome_fantasia ?? "Painel"}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {visibleItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/painel" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-primary/20 text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border/50">
          {isDono && fatura && (() => {
            const { conversas_usadas: usadas, conversas_incluidas: incluidas } = fatura;
            const pct = Math.min((usadas / incluidas) * 100, 100);
            const noBuffer = usadas > incluidas;
            const quase = !noBuffer && pct >= 80;
            const barColor = noBuffer ? "bg-destructive" : quase ? "bg-yellow-400" : "bg-sidebar-primary";
            const textColor = noBuffer ? "text-destructive-foreground" : quase ? "text-yellow-300" : "text-sidebar-foreground/80";
            return (
              <div className="mx-3 mb-2 bg-sidebar-accent rounded-lg px-2.5 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-sidebar-foreground/50">Conversas do mês</span>
                  <div className="flex items-center gap-1">
                    {noBuffer && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                      </span>
                    )}
                    <span className={`text-xs font-semibold ${textColor}`}>{usadas}/{incluidas}</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-sidebar-border rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })()}
          {user?.loja?.plano && (
            <div className="mx-3 mb-2 flex items-center justify-between bg-sidebar-accent rounded-lg px-2.5 py-1.5">
              <span className="text-xs text-sidebar-foreground/50">Plano</span>
              <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                user.loja.plano === "full" ? "bg-purple-400/30 text-purple-300" :
                user.loja.plano === "pro" ? "bg-sidebar-primary/30 text-sidebar-primary" :
                "bg-sidebar-border text-sidebar-foreground/70"
              }`}>{user.loja.plano}</span>
            </div>
          )}
          {user?.plano_config && user.loja?.plano !== "full" && (
            <a href="mailto:suporte@patioai.com.br" className="mx-3 mb-2 flex items-center gap-1.5 bg-gradient-to-r from-sidebar-primary to-primary text-sidebar-primary-foreground text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:opacity-90 transition-opacity">
              <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current flex-shrink-0">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
              Fazer upgrade
            </a>
          )}
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.nome}</p>
            <p className="text-xs text-sidebar-foreground/40 truncate">{user?.email}</p>
            <span className="inline-block mt-1 text-xs bg-sidebar-primary/20 text-sidebar-primary px-1.5 py-0.5 rounded capitalize">{user?.perfil}</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/20 rounded-lg transition-colors"
          >
            <span>🚪</span> Sair
          </button>
        </div>
      </aside>

      <main className="ml-60 flex-1 min-h-screen">
        {children}
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
