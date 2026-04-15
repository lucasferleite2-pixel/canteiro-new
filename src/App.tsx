import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Obras from "@/pages/Obras";
import DiarioObra from "@/pages/DiarioObra";
import Contratos from "@/pages/Contratos";
import Financeiro from "@/pages/Financeiro";
import Licitacoes from "@/pages/Licitacoes";
import Alertas from "@/pages/Alertas";
import Usuarios from "@/pages/Usuarios";
import EmpresaConfig from "@/pages/EmpresaConfig";
import AuditoriaRdo from "@/pages/AuditoriaRdo";
import Comparativo from "@/pages/Comparativo";
import PlanejamentoFases from "@/pages/PlanejamentoFases";
import Auth from "@/pages/Auth";
import CompanySetup from "@/pages/CompanySetup";
import NotFound from "./pages/NotFound";
import VerificarDocumento from "@/pages/VerificarDocumento";
import Cronograma from "@/pages/Cronograma";
import Tarefas from "@/pages/Tarefas";
import BibliotecaProdutos from "@/pages/BibliotecaProdutos";
import GestaoArquivos from "@/pages/GestaoArquivos";
import OrcamentoObra from "@/pages/OrcamentoObra";
import Medicoes from "@/pages/Medicoes";
import GestaoCompras from "@/pages/GestaoCompras";
import CrmVendas from "@/pages/CrmVendas";
import PortalCliente from "@/pages/PortalCliente";
import PortalClientePublico from "@/pages/PortalClientePublico";
import Relatorios from "@/pages/Relatorios";
import ImportarDados from "@/pages/ImportarDados";
import FluxoCaixa from "@/pages/FluxoCaixa";
import ContasBancarias from "@/pages/ContasBancarias";
import Campo from "@/pages/Campo";
import Sinapi from "@/pages/Sinapi";
import Composicoes from "@/pages/Composicoes";
import Estoque from "@/pages/Estoque";
import EstoqueMovimentacoes from "@/pages/EstoqueMovimentacoes";
import EstoqueNovaMovimentacao from "@/pages/EstoqueNovaMovimentacao";
import ProdutosEstoque from "@/pages/ProdutosEstoque";
import Depositos from "@/pages/Depositos";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedAppLayout() {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  );
}

function ProtectedCompanySetup() {
  return (
    <ProtectedRoute>
      <CompanySetup />
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
  <TooltipProvider>
    <Sonner />
    <BrowserRouter>
      <AuthProvider>
        <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/empresa" element={<ProtectedCompanySetup />} />
            <Route path="/portal/:token" element={<PortalClientePublico />} />
            <Route element={<ProtectedAppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/obras" element={<Obras />} />
              <Route path="/diario" element={<DiarioObra />} />
              <Route path="/contratos" element={<Contratos />} />
              <Route path="/financeiro" element={<Financeiro />} />
              <Route path="/licitacoes" element={<Licitacoes />} />
              <Route path="/alertas" element={<Alertas />} />
              <Route path="/usuarios" element={<Usuarios />} />
              <Route path="/empresa/config" element={<EmpresaConfig />} />
              <Route path="/auditoria" element={<AuditoriaRdo />} />
              <Route path="/comparativo" element={<Comparativo />} />
              <Route path="/planejamento" element={<PlanejamentoFases />} />
              <Route path="/cronograma" element={<Cronograma />} />
              <Route path="/tarefas" element={<Tarefas />} />
              <Route path="/biblioteca" element={<BibliotecaProdutos />} />
              <Route path="/arquivos" element={<GestaoArquivos />} />
              <Route path="/orcamento" element={<OrcamentoObra />} />
              <Route path="/medicoes" element={<Medicoes />} />
              <Route path="/compras" element={<GestaoCompras />} />
              <Route path="/crm" element={<CrmVendas />} />
              <Route path="/portal-config" element={<PortalCliente />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/importar-dados" element={<ImportarDados />} />
              <Route path="/fluxo-caixa" element={<FluxoCaixa />} />
              <Route path="/contas-bancarias" element={<ContasBancarias />} />
              <Route path="/sinapi" element={<Sinapi />} />
              <Route path="/composicoes" element={<Composicoes />} />
              <Route path="/estoque" element={<Estoque />} />
              <Route path="/estoque/movimentacoes" element={<EstoqueMovimentacoes />} />
              <Route path="/estoque/nova" element={<EstoqueNovaMovimentacao />} />
              <Route path="/estoque/produtos" element={<ProdutosEstoque />} />
              <Route path="/estoque/depositos" element={<Depositos />} />
            </Route>
            <Route path="/campo" element={<Campo />} />
            <Route path="/verificar/:documentId" element={<VerificarDocumento />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
