import { useState } from "react";
import { Bell, Check, ShoppingCart, MessageSquare, Info, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "sale" | "comment" | "system" | "approval";
  is_read: boolean;
  created_at: string;
}

export function NotificationCenter() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch notifications - assume a 'notifications' table exists or use mock for now
  // In a real scenario, this would be a real table in Supabase
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching notifications:", error);
        return [];
      }
      return data as unknown as Notification[];
    },
    enabled: !!user,
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase
        .from("notifications" as any)
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Tudo lido! ✨");
    }
  });

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "sale": return <ShoppingCart className="h-4 w-4 text-neon-green" />;
      case "comment": return <MessageSquare className="h-4 w-4 text-neon-purple" />;
      case "approval": return <ShieldCheck className="h-4 w-4 text-neon-cyan" />;
      default: return <Info className="h-4 w-4 text-neon-pink" />;
    }
  };

  const getTypeStyle = (type: Notification["type"]) => {
    switch (type) {
      case "sale": return "border-neon-green/30 shadow-neon-green/5";
      case "comment": return "border-neon-purple/30 shadow-neon-purple/5";
      case "approval": return "border-neon-cyan/30 shadow-neon-cyan/5";
      default: return "border-neon-pink/30 shadow-neon-pink/5";
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative hover:bg-white/5 transition-all group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className={`h-5 w-5 transition-transform group-hover:scale-110 ${unreadCount > 0 ? "text-neon-purple animate-pulse" : "text-muted-foreground"}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-neon-purple text-[10px] font-black text-white shadow-lg shadow-neon-purple/40">
            {unreadCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10, x: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10, x: -10 }}
              className="absolute right-0 mt-4 w-80 sm:w-96 z-50 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0c]/90 backdrop-blur-2xl shadow-2xl"
            >
              <div className="relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-neon-purple via-neon-cyan to-neon-pink" />
                
                <div className="p-4 flex items-center justify-between border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black uppercase tracking-widest text-white italic">Centro de Transmissão</h3>
                    {unreadCount > 0 && (
                      <Badge variant="outline" className="text-[10px] border-neon-purple/40 text-neon-purple bg-neon-purple/5">
                        {unreadCount} NOVOS
                      </Badge>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-white"
                      onClick={() => markAllAsRead.mutate()}
                    >
                      Limpar Tudo
                    </Button>
                  )}
                </div>

                <ScrollArea className="h-[400px]">
                  <div className="p-4 space-y-3">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                        <Bell className="h-8 w-8 mb-2 text-muted-foreground" />
                        <p className="text-xs font-black uppercase tracking-widest">Silêncio Absoluto</p>
                        <p className="text-[10px] mt-1 text-muted-foreground">Você está totalmente atualizado.</p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`relative p-3 rounded-xl border bg-white/5 transition-all hover:bg-white/10 group cursor-default ${getTypeStyle(notification.type)} ${!notification.is_read ? "border-l-4" : ""}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-1 p-2 rounded-lg bg-black/40 border border-white/5 group-hover:border-white/10 transition-colors">
                              {getIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between">
                                <h4 className={`text-xs font-black uppercase tracking-tight truncate ${!notification.is_read ? "text-white" : "text-muted-foreground"}`}>
                                  {notification.title}
                                </h4>
                                <span className="text-[9px] font-mono text-muted-foreground/60 whitespace-nowrap ml-2">
                                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                                {notification.message}
                              </p>
                            </div>
                          </div>
                          {!notification.is_read && (
                            <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-neon-purple animate-ping" />
                          )}
                        </motion.div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                <div className="p-3 bg-black/40 border-t border-white/5 text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 italic">
                    Nexus Intelligence System v2.0
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
