import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Terminal, Menu, X, User, LogOut, LayoutDashboard, Shield, Settings, Wrench } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const { user, profile, isModder, isAdmin, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Terminal className="h-6 w-6 text-neon-purple" />
          <span className="text-xl font-bold font-mono tracking-tight">
            Mod<span className="text-neon-green">Hub</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/marketplace" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Marketplace
          </Link>
          <Link to="/tutorials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Tutoriais
          </Link>
          <Link to="/forum" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Fórum
          </Link>
          <Link to="/ferramentas" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Ferramentas
          </Link>
          {!user ? (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
                Login
              </Button>
              <Button size="sm" className="neon-glow-purple" onClick={() => navigate("/auth?tab=signup")}>
                Cadastrar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <NotificationBell />
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Avatar className="h-6 w-6">
                    {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
                    <AvatarFallback className="bg-secondary text-[10px]">
                      {(profile?.username ?? "U").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {profile?.display_name ?? profile?.username ?? "Usuário"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {isModder && (
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    <Shield className="mr-2 h-4 w-4" />
                    Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate(`/modder/${user.id}`)}>
                  <User className="mr-2 h-4 w-4" />
                  Meu Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/profile/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background p-4 space-y-3">
          <Link to="/marketplace" className="block text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>
            Marketplace
          </Link>
          <Link to="/tutorials" className="block text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>
            Tutoriais
          </Link>
          <Link to="/forum" className="block text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>
            Fórum
          </Link>
          <Link to="/ferramentas" className="block text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>
            Ferramentas
          </Link>
          {!user ? (
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => { navigate("/auth"); setMobileOpen(false); }}>Login</Button>
              <Button size="sm" className="neon-glow-purple" onClick={() => { navigate("/auth?tab=signup"); setMobileOpen(false); }}>Cadastrar</Button>
            </div>
          ) : (
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center gap-3 pb-2">
                <Avatar className="h-8 w-8">
                  {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
                  <AvatarFallback className="bg-secondary text-xs">
                    {(profile?.username ?? "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{profile?.display_name ?? profile?.username ?? "Usuário"}</span>
              </div>
              <Link to={`/modder/${user.id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>
                <User className="h-4 w-4" /> Meu Perfil
              </Link>
              <Link to="/profile/settings" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>
                <Settings className="h-4 w-4" /> Configurações
              </Link>
              {isModder && (
                <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Link>
              )}
              {isAdmin && (
                <Link to="/admin" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>
                  <Shield className="h-4 w-4" /> Admin
                </Link>
              )}
              <button className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80" onClick={() => { handleSignOut(); setMobileOpen(false); }}>
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
