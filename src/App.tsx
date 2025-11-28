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
import Login from "./pages/Login";
import Layout from "./components/Layout";
import { SessionContextProvider } from "./components/SessionContextProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleProtectedRoute from "./components/RoleProtectedRoute";
import { ThemeProvider } from "next-themes";
import ErrorBoundary from "./components/ErrorBoundary";
import Account from "./pages/Account";
import UserManagement from "./pages/UserManagement"; // Importar a nova página

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionContextProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/opme-scanner" element={<OpmeScanner />} />
                <Route path="/linked-opme-view" element={<LinkedOpmeView />} />
                <Route path="/account" element={<Account />} />
                
                {/* Rotas exclusivas para Gestores */}
                <Route element={<RoleProtectedRoute allowedRoles={['GESTOR']} />}>
                  <Route path="/opme-registration" element={<OpmeRegistration />} />
                  <Route path="/user-management" element={<UserManagement />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;