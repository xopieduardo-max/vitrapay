import { Bell, TrendingUp, TrendingDown, RotateCcw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

interface Notification {
  id: string;
  title: string;
  description: string;
  time: Date;
}

interface NotificationsDropdownProps {
  count: number;
  notifications: Notification[];
  onClear: () => void;
}

function categoryMeta(category: string, type: string) {
  if (category === "sale") return { icon: TrendingUp, color: "text-green-500", label: "Venda aprovada" };
  if (category === "commission") return { icon: TrendingUp, color: "text-blue-500", label: "Comissão recebida" };
  if (category === "refund" || category === "chargeback" || category === "med")
    return { icon: RotateCcw, color: "text-red-500", label: category === "chargeback" ? "Chargeback" : category === "med" ? "MED Pix" : "Estorno" };
  if (category === "withdrawal") return { icon: Wallet, color: "text-orange-500", label: "Saque" };
  if (type === "debit") return { icon: TrendingDown, color: "text-red-400", label: "Débito" };
  return { icon: TrendingUp, color: "text-muted-foreground", label: "Movimentação" };
}

function timeAgo(date: Date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function NotificationsDropdown({ count, notifications, onClear }: NotificationsDropdownProps) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  const { data: txHistory = [] } = useQuery({
    queryKey: ["notifications-history", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("transactions")
        .select("id, type, category, amount, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!user && open,
    staleTime: 30_000,
  });

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && count > 0) {
      onClear();
    }
  };

  // Merge realtime + historical, deduplicate by id
  const realtimeIds = new Set(notifications.map((n) => n.id));
  const historyItems: Notification[] = txHistory
    .filter((tx) => !realtimeIds.has(tx.id))
    .map((tx) => {
      const meta = categoryMeta(tx.category, tx.type);
      const fmt = `R$ ${(tx.amount / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
      return {
        id: tx.id,
        title: meta.label,
        description: fmt,
        time: new Date(tx.created_at),
        category: tx.category,
        type: tx.type,
      };
    });

  const allNotifications = [
    ...notifications,
    ...historyItems,
  ].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 50);

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" strokeWidth={1.5} />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center rounded-full bg-primary text-[0.6rem] font-bold text-primary-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h4 className="font-semibold text-sm">Notificações</h4>
          <Link to="/finance" className="text-xs text-primary hover:underline" onClick={() => setOpen(false)}>
            Ver extrato
          </Link>
        </div>
        <ScrollArea className="max-h-80">
          {allNotifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma notificação ainda
            </div>
          ) : (
            <div className="divide-y divide-border">
              {allNotifications.map((n: any) => {
                const meta = n.category
                  ? categoryMeta(n.category, n.type || "credit")
                  : { icon: Bell, color: "text-muted-foreground" };
                const Icon = meta.icon;
                return (
                  <div key={n.id} className="p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start gap-2.5">
                      <div className={`mt-0.5 shrink-0 ${meta.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>
                      </div>
                      <span className="text-[0.65rem] text-muted-foreground shrink-0">{timeAgo(n.time)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
