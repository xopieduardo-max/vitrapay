import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useSalesNotifications() {
  const { user } = useAuth();
  const [newSalesCount, setNewSalesCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("sales-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sales",
          filter: `producer_id=eq.${user.id}`,
        },
        (payload: any) => {
          const amount = payload.new?.amount || 0;
          const method = payload.new?.payment_provider || "pix";
          const fmt = `R$ ${(amount / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

          toast.success(`Nova venda de ${fmt}!`, {
            description: `Pagamento via ${method === "pix" ? "Pix" : method === "card" ? "Cartão" : "Boleto"}`,
          });

          setNewSalesCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const clearCount = () => setNewSalesCount(0);

  return { newSalesCount, clearCount };
}