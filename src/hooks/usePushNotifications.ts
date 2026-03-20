import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const VAPID_PUBLIC_KEY =
  "BMl6o6EhTPzsw80f47Dxs3_GqfrtFV0L8dHuhKTpiqfc_RL7cMbt0ahYuMwBesOIYPieW-UCihniGf7hJ-_iOvQ";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    const hasSW = "serviceWorker" in navigator;
    const hasPush = "PushManager" in window;
    const hasNotif = "Notification" in window;
    const supported = hasSW && hasPush && hasNotif;
    
    console.log("[Push] Support check:", { hasSW, hasPush, hasNotif, supported });
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      console.log("[Push] Current permission:", Notification.permission);
      checkExistingSubscription();
    }
  }, []);

  async function checkExistingSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      console.log("[Push] SW ready, scope:", registration.scope);
      const subscription = await registration.pushManager.getSubscription();
      console.log("[Push] Existing subscription:", subscription ? "YES" : "NO");
      setIsSubscribed(!!subscription);
    } catch (e) {
      console.error("[Push] checkExistingSubscription error:", e);
    }
  }

  async function subscribe() {
    if (!user || !isSupported) {
      console.log("[Push] Cannot subscribe:", { user: !!user, isSupported });
      return;
    }

    try {
      console.log("[Push] Requesting permission...");
      const perm = await Notification.requestPermission();
      setPermission(perm);
      console.log("[Push] Permission result:", perm);

      if (perm !== "granted") {
        toast({
          title: "Permissão negada",
          description: "Ative as notificações nas configurações do navegador.",
          variant: "destructive",
        });
        return;
      }

      console.log("[Push] Waiting for SW ready...");
      const registration = await navigator.serviceWorker.ready;
      console.log("[Push] SW ready. Subscribing to push...");
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      console.log("[Push] Push subscription created:", subscription.endpoint.slice(0, 60));

      const subJson = subscription.toJSON();
      const keys = subJson.keys!;
      
      console.log("[Push] Saving to database for user:", user.id);
      console.log("[Push] Endpoint:", subJson.endpoint?.slice(0, 60));
      console.log("[Push] Has p256dh:", !!keys.p256dh, "Has auth:", !!keys.auth);

      // First try to delete any existing subscription for this user+endpoint
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("endpoint", subJson.endpoint!);

      // Then insert fresh
      const { data, error } = await supabase
        .from("push_subscriptions")
        .insert({
          user_id: user.id,
          endpoint: subJson.endpoint!,
          p256dh: keys.p256dh!,
          auth: keys.auth!,
        })
        .select();

      if (error) {
        console.error("[Push] Database save error:", JSON.stringify(error));
        throw error;
      }

      console.log("[Push] Saved successfully:", data);
      setIsSubscribed(true);
      toast({ title: "Notificações ativadas! 🔔", description: "Você receberá alertas de vendas no celular." });
    } catch (e: any) {
      console.error("[Push] Subscribe error:", e);
      toast({
        title: "Erro ao ativar notificações",
        description: e.message || String(e),
        variant: "destructive",
      });
    }
  }

  async function unsubscribe() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user?.id)
          .eq("endpoint", subscription.endpoint);
      }
      setIsSubscribed(false);
      toast({ title: "Notificações desativadas" });
    } catch (e: any) {
      console.error("[Push] Unsubscribe error:", e);
    }
  }

  return { isSubscribed, isSupported, permission, subscribe, unsubscribe };
}
