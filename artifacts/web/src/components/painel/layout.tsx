import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLogout } from "@workspace/api-client-react";
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
  { href: "/painel/fatura", label: "Fatura", icon: "💰", donoOnly: true },
  { href: "/painel/configuracoes", label: "Configurações", icon: "⚙️", donoOnly: true },
];

export function PainelLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, clearAuth } = useAuth();
  const qc = useQueryClient();
  const logoutMutation = useLogout();

  const isDono = user?.perfil === "dono" || user?.perfil === "admin_patioai";

  const handleLogout = async () => {
    try { await logoutMutation.mutateAsync(); } catch { }
    clearAuth();
    qc.clear();
    window.location.href = "/painel/login";
  };

  const visibleItems = NAV_ITEMS.filter((item) => !item.donoOnly || isDono);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col fixed h-full z-10">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-sm font-bold">P</div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-none">Pátio AI</p>
              <p className="text-gray-400 text-xs truncate max-w-[120px]">{user?.loja?.nome_fantasia ?? "Painel"}</p>
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
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-gray-900 truncate">{user?.nome}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            <span className="inline-block mt-1 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded capitalize">{user?.perfil}</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
