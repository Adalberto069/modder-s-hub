import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Marketplace from "./pages/Marketplace";
import TutorialDetail from "./pages/TutorialDetail";
import ScriptDetail from "./pages/ScriptDetail";
import ModderProfile from "./pages/ModderProfile";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import ProfileSettings from "./pages/ProfileSettings";
import Tutorials from "./pages/Tutorials";
import Forum from "./pages/Forum";
import Ferramentas from "./pages/Ferramentas";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/script/:id" element={<ScriptDetail />} />
            <Route path="/modder/:userId" element={<ModderProfile />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/profile/settings" element={<ProfileSettings />} />
            <Route path="/tutorials" element={<Tutorials />} />
            <Route path="/tutorial/:id" element={<TutorialDetail />} />
            <Route path="/forum" element={<Forum />} />
            <Route path="/ferramentas" element={<Ferramentas />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
