import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Knowledge from "./pages/Knowledge";
import Providers from "./pages/Providers";
import Settings from "./pages/Settings";
import AuditLog from "./pages/AuditLog";
import PromptsLibrary from "./pages/PromptsLibrary";
import Plugins from "./pages/Plugins";
import Maintenance from "./pages/Maintenance";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <div className="dark">
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/knowledge" element={<Knowledge />} />
              <Route path="/providers" element={<Providers />} />
              <Route path="/prompts" element={<PromptsLibrary />} />
              <Route path="/plugins" element={<Plugins />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="/audit" element={<AuditLog />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;