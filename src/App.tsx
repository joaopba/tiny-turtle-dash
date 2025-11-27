import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import OpmeScanner from "./pages/OpmeScanner";
import OpmeRegistration from "./pages/OpmeRegistration";
import LinkedOpmeView from "./pages/LinkedOpmeView";
import Login from "./pages/Login"; // Mantém Login para acesso direto se necessário
import Layout from "./components/Layout";
// import { SessionContextProvider } from "./components/SessionContextProvider"; // Temporariamente removido
// import ProtectedRoute from "./components/ProtectedRoute"; // Temporariamente removido

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        {/* Temporariamente ignorando SessionContextProvider e ProtectedRoute para depuração */}
        <Routes>
          <Route path="/login" element={<Login />} /> {/* Login ainda acessível */}
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/opme-scanner" element={<OpmeScanner />} />
            <Route path="/opme-registration" element={<OpmeRegistration />} />
            <Route path="/linked-opme-view" element={<LinkedOpmeView />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;