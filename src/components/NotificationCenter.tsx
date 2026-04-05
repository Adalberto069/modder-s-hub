import { useState, useEffect } from "react";
import { Bell, Check, ShoppingCart, MessageSquare, Info, ShieldCheck, Trash2, ExternalLink } from "lucide-react";
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
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "sale" | "comment" | "system" | "approval";
  is_read: boolean;
  created_at: string;
  link: string | null;
}

export function NotificationCenter() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return [];
      return (data ?? []) as unknown as Notification[];
    },
    enabled: !!user,
    refetchInterval: 30000, // Poll every 30s for new notifications
  });

  // Realtime subscription for instant notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase
        .from("notifications")
        .update({ is_read: true } as any)
        .eq("user_id", user.id)
        .eq("is_read", false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Tudo lido! ✨");
    },
  });

  const markOneAsRead = useMutation({
    mutationFn: async (notifId: string) => {
      await supabase
        .from("notifications")
        .update({ is_read: true } as any)
        .eq("id", notifId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const deleteNotification = useMutation({
    mutationFn: async (notifId: string) => {
      await supabase
        .from("notifications")
        .delete()
        .eq("id", notifId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markOneAsRead.mutate(notification.id);
    }
    if (notification.link) {
      setIsOpen(false);
      navigate(notification.link);
    }
  };

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "sale": return <ShoppingCart className="h-4 w-4 text-accent" />;
      case "comment": return <MessageSquare className="h-4 w-4 text-primary" />;
      case "approval": return <ShieldCheck className="h-4 w-4 text-accent" />;
      default: return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeStyle = (type: Notification["type"]) => {
    switch (type) {
      case "sale": return "border-accent/30";
      case "comment": return "border-primary/30";
      case "approval": return "border-accent/30";
      default: return "border-muted/30";
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
        <Bell className={`h-5 w-5 transition-transform group-hover:scale-110 ${unreadCount > 0 ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground shadow-lg">
            {unreadCount > 9 ? "9+" : unreadCount}
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
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute right-0 mt-4 w-80 sm:w-96 z-50 overflow-hidden rounded-2xl border border-border bg-card/95 backdrop-blur-2xl shadow-2xl"
            >
              <div className="relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary via-accent to-primary" />

                <div className="p-4 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Notificações</h3>
                    {unreadCount > 0 && (
                      <Badge variant="outline" className="text-[10px] border-primary/40 text-primary bg-primary/5">
                        {unreadCount} {unreadCount === 1 ? "NOVA" : "NOVAS"}
                      </Badge>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground"
                      onClick={() => markAllAsRead.mutate()}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Marcar tudo
                    </Button>
                  )}
                </div>

                <ScrollArea className="h-[400px]">
                  <div className="p-3 space-y-2">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                        <Bell className="h-8 w-8 mb-2 text-muted-foreground" />
                        <p className="text-xs font-bold">Nenhuma notificação</p>
                        <p className="text-[10px] mt-1 text-muted-foreground">Você está atualizado.</p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`relative p-3 rounded-xl border bg-background/50 transition-all hover:bg-background/80 group ${getTypeStyle(notification.type)} ${!notification.is_read ? "border-l-4 bg-primary/5" : ""} ${notification.link ? "cursor-pointer" : "cursor-default"}`}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 p-2 rounded-lg bg-muted/50 border border-border shrink-0">
                              {getIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className={`text-xs font-bold truncate ${!notification.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                                  {notification.title}
                                </h4>
                                <div className="flex items-center gap-1 shrink-0">
                                  {notification.link && (
                                    <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/40" />
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteNotification.mutate(notification.id);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                                {notification.message}
                              </p>
                              <span className="text-[9px] font-mono text-muted-foreground/50">
                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}
                              </span>
                            </div>
                          </div>
                          {!notification.is_read && (
                            <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-primary" />
                          )}
                        </motion.div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                <div className="p-3 bg-muted/20 border-t border-border text-center">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/40">
                    Hidden Mod Notifications
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
