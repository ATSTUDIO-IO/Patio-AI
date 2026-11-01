import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import AgenteVoz from "@/pages/agente-voz";
import PainelLogin from "@/pages/painel/login";
import PainelCadastro from "@/pages/painel/cadastro";
import PainelDashboard from "@/pages/painel/dashboard";
import PainelVeiculos from "@/pages/painel/veiculos";
import VeiculoForm from "@/pages/painel/veiculo-form";
import VeiculoQR from "@/pages/painel/veiculo-qr";
import VeiculoDetalhe from "@/pages/painel/veiculo-detalhe";
import PainelLeads from "@/pages/painel/leads";
import PainelConversas from "@/pages/painel/conversas";
import PainelFatura from "@/pages/painel/fatura";
import PainelConfiguracoes from "@/pages/painel/configuracoes";
import RelatorioVendas from "@/pages/painel/relatorio-vendas";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminLojaDetail from "@/pages/admin/loja-detail";
import AdminBilling from "@/pages/admin/billing";
import AdminInteligencia from "@/pages/admin/inteligencia";
import { loginRedirect } from "@/lib/auth-navigation";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ProtectedRoute({ component: Component, donoOnly = false }: { component: React.ComponentType; donoOnly?: boolean }) {
  const { isAuthenticated, user, sessionExpired } = useAuth();
  const [path] = useLocation();
  if (!isAuthenticated) return <Redirect to={loginRedirect(path + window.location.search, sessionExpired)} />;
  if (donoOnly && user?.perfil === "vendedor") return <Redirect to="/painel" />;
  return <Component />;
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, user, sessionExpired } = useAuth();
  const [path] = useLocation();
  if (!isAuthenticated) return <Redirect to={loginRedirect(path + window.location.search, sessionExpired)} />;
  if (user?.perfil !== "admin_patioai") return <Redirect to="/painel" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/painel" />} />
      <Route path="/v/:slug" component={AgenteVoz} />
      <Route path="/painel/login" component={PainelLogin} />
      <Route path="/painel/cadastro" component={PainelCadastro} />
      <Route path="/painel" component={() => <ProtectedRoute component={PainelDashboard} />} />
      <Route path="/painel/veiculos" component={() => <ProtectedRoute component={PainelVeiculos} />} />
      <Route path="/painel/veiculos/novo" component={() => <ProtectedRoute component={VeiculoForm} />} />
      <Route path="/painel/veiculos/:id/editar" component={() => <ProtectedRoute component={VeiculoForm} />} />
      <Route path="/painel/veiculos/:id/qr" component={() => <ProtectedRoute component={VeiculoQR} />} />
      <Route path="/painel/veiculos/:id" component={() => <ProtectedRoute component={VeiculoDetalhe} />} />
      <Route path="/painel/leads" component={() => <ProtectedRoute component={PainelLeads} />} />
      <Route path="/painel/conversas" component={() => <ProtectedRoute component={PainelConversas} />} />
      <Route path="/painel/fatura" component={() => <ProtectedRoute component={PainelFatura} donoOnly />} />
      <Route path="/painel/configuracoes" component={() => <ProtectedRoute component={PainelConfiguracoes} donoOnly />} />
      <Route path="/painel/relatorio-vendas" component={() => <ProtectedRoute component={RelatorioVendas} donoOnly />} />
      <Route path="/admin" component={() => <AdminRoute component={AdminDashboard} />} />
      <Route path="/admin/dashboard" component={() => <AdminRoute component={AdminDashboard} />} />
      <Route path="/admin/lojas" component={() => <AdminRoute component={AdminDashboard} />} />
      <Route path="/admin/lojas/:id" component={() => <AdminRoute component={AdminLojaDetail} />} />
      <Route path="/admin/lojistas/:id" component={() => <AdminRoute component={AdminLojaDetail} />} />
      <Route path="/admin/inteligencia" component={() => <AdminRoute component={AdminInteligencia} />} />
      <Route path="/admin/billing" component={() => <AdminRoute component={AdminBilling} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
