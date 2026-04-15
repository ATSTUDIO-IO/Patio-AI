import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { href: "/admin", label: "Visão Geral", icon: "📊" },
  { href: "/admin/lojas", label: "Lojas", icon: "🏪" },
  { href: "/admin/inteligencia", label: "Inteligência", icon: "🧠" },
  { href: "/admin/billing", label: "Billing", icon: "💰" },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, clearAuth } = useAuth();

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <aside className="w-56 flex flex-col border-r border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-2 px-4 py-5 border-b border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-sm font-bold">A</div>
          <div>
            <p className="text-xs font-bold text-white">PátioAI</p>
            <p className="text-xs text-gray-400">Admin</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/admin" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-violet-900/60 text-violet-300"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="text-xs text-gray-500 truncate mb-2">{user?.email}</div>
          <button
            onClick={clearAuth}
            className="w-full text-left text-xs text-gray-400 hover:text-red-400 transition-colors py-1"
          >
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-gray-950">
        {children}
      </main>
    </div>
  );
}

export function AdminPageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-8 py-6 border-b border-gray-800">
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
}
