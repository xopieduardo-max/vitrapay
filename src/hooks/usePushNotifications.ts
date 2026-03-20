import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const VAPID_PUBLIC_KEY =
  "BKpiiCIgYV0XdT4UBSvqOTHfDocE2bl1mn58jQfT-wfXJ6HaB4fK22kA9Ji86Pc3F0WTKawG0aFyy5uLzYQ_feo";

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
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      checkExistingSubscription();
    }
  }, []);

  async function checkExistingSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {
      // Service worker not ready yet
    }
  }

  async function subscribe() {
    if (!user || !isSupported) return;

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        toast({
          title: "Permissão negada",
          description: "Ative as notificações nas configurações do navegador.",
          variant: "destructive",
        });
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subJson = subscription.toJSON();
      const keys = subJson.keys!;

      const { error } = await supabase.from("push_subscriptions" as any).upsert(
        {
          user_id: user.id,
          endpoint: subJson.endpoint!,
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
        { onConflict: "user_id,endpoint" }
      );

      if (error) throw error;

      setIsSubscribed(true);
      toast({ title: "Notificações ativadas! 🔔", description: "Você receberá alertas de vendas no celular." });
    } catch (e: any) {
      console.error("Push subscription error:", e);
      toast({
        title: "Erro ao ativar notificações",
        description: e.message,
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
          .from("push_subscriptions" as any)
          .delete()
          .eq("user_id", user?.id)
          .eq("endpoint", subscription.endpoint);
      }
      setIsSubscribed(false);
      toast({ title: "Notificações desativadas" });
    } catch (e: any) {
      console.error("Push unsubscribe error:", e);
    }
  }

  return { isSubscribed, isSupported, permission, subscribe, unsubscribe };
}
