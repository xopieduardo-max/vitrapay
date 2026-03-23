import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SaleNotification {
  id: string;
  title: string;
  description: string;
  time: Date;
}

export function useSalesNotifications() {
  const { user } = useAuth();
  const [newSalesCount, setNewSalesCount] = useState(0);
  const [notifications, setNotifications] = useState<SaleNotification[]>([]);
  const notifIdRef = useRef(0);

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
        async (payload: any) => {
          const amount = payload.new?.amount || 0;
          const method = payload.new?.payment_provider || "pix";
          const fmt = `R$ ${(amount / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
          const methodLabel = method === "pix" ? "Pix" : method === "card" ? "Cartão de Crédito" : "Boleto";

          const title = `Venda Aprovada! 🚀`;
          const description = `Pagamento via ${methodLabel} • Valor: ${fmt}`;

          toast.success(title, { description });

          notifIdRef.current++;
          const notif: SaleNotification = {
            id: `notif-${notifIdRef.current}-${Date.now()}`,
            title,
            description,
            time: new Date(),
          };

          setNotifications((prev) => [notif, ...prev].slice(0, 50));
          setNewSalesCount((prev) => prev + 1);

          // Trigger push notification via edge function
          try {
            await supabase.functions.invoke("send-push", {
              body: {
                producer_id: user.id,
                title: `Venda Aprovada! 🚀`,
                body: `Pagamento via ${methodLabel} • Valor: ${fmt}`,
                url: "/sales",
              },
            });
          } catch (e) {
            console.error("Push notification error:", e);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sales",
          filter: `producer_id=eq.${user.id}`,
        },
        async (payload: any) => {
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;

          // Only notify on refund transitions
          if (newStatus === "refunded" && oldStatus !== "refunded") {
            const amount = payload.new?.amount || 0;
            const method = payload.new?.payment_provider || "pix";
            const fmt = `R$ ${(amount / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
            const methodLabel = method === "pix" ? "Pix" : method === "card" ? "Cartão de Crédito" : "Boleto";
            const paymentId = payload.new?.payment_id || "";

            const title = `Venda Estornada ⚠️`;
            const description = `${methodLabel} • ${fmt} • ID: ${paymentId.slice(0, 12)}`;

            toast.error(title, { description, duration: 8000 });

            notifIdRef.current++;
            const notif: SaleNotification = {
              id: `notif-${notifIdRef.current}-${Date.now()}`,
              title,
              description,
              time: new Date(),
            };

            setNotifications((prev) => [notif, ...prev].slice(0, 50));
            setNewSalesCount((prev) => prev + 1);

            // Push notification for refund
            try {
              await supabase.functions.invoke("send-push", {
                body: {
                  producer_id: user.id,
                  title: `Venda Estornada ⚠️`,
                  body: `${methodLabel} • Valor: ${fmt} • ID: ${paymentId.slice(0, 12)}`,
                  url: "/sales",
                },
              });
            } catch (e) {
              console.error("Push notification error:", e);
            }
          }
        }
      )
      .subscribe();

    // Listen for pending payments (checkout initiated)
    const pendingChannel = supabase
      .channel("pending-payments-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pending_payments",
        },
        async (payload: any) => {
          const productId = payload.new?.product_id;
          if (!productId) return;

          const { data: product } = await supabase
            .from("products")
            .select("producer_id, title")
            .eq("id", productId)
            .single();

          if (!product || product.producer_id !== user.id) return;

          const amount = payload.new?.amount || 0;
          const fmtVal = `R$ ${(amount / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

          const title = "Checkout Iniciado! 🛒";
          const description = `${product.title} • ${fmtVal}`;

          toast.info(title, { description });

          notifIdRef.current++;
          const notif: SaleNotification = {
            id: `notif-${notifIdRef.current}-${Date.now()}`,
            title,
            description,
            time: new Date(),
          };

          setNotifications((prev) => [notif, ...prev].slice(0, 50));
          setNewSalesCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(pendingChannel);
    };
  }, [user]);

  const clearCount = () => setNewSalesCount(0);

  return { newSalesCount, notifications, clearCount };
}
