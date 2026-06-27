import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Total de mensagens de suporte não lidas pelo usuário atual
 * (soma de `unread_for_user` nos tickets dele).
 * Atualiza em tempo real via Realtime.
 */
export function useUnreadSupport() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [pulse, setPulse] = useState(false);

  const { data: unread = 0 } = useQuery({
    queryKey: ["support-unread", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from("support_tickets")
        .select("unread_for_user")
        .eq("user_id", user.id);
      if (error) return 0;
      return (data || []).reduce((sum, t: any) => sum + (t.unread_for_user || 0), 0);
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`support-unread-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const oldUnread = payload.old?.unread_for_user ?? 0;
          const newUnread = payload.new?.unread_for_user ?? 0;
          if (newUnread > oldUnread) {
            setPulse(true);
            setTimeout(() => setPulse(false), 4000);
          }
          qc.invalidateQueries({ queryKey: ["support-unread", user.id] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  return { unread, pulse, hasUnread: unread > 0 };
}
