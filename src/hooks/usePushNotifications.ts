import { useEffect, useState, useRef } from "react";
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
  const autoSubAttempted = useRef(false);

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

  // Auto-subscribe when user is logged in and push is supported
  useEffect(() => {
    if (!user || !isSupported || autoSubAttempted.current) return;
    if (isSubscribed) return; // Already subscribed

    // Only auto-subscribe if permission is already granted or default (will prompt)
    // If denied, we can't do anything
    if (Notification.permission === "denied") return;

    // If already granted, silently subscribe without prompting
    if (Notification.permission === "granted") {
      autoSubAttempted.current = true;
      console.log("[Push] Auto-subscribing (permission already granted)...");
      silentSubscribe();
    } else {
      // Permission is "default" - auto-prompt the user once
      autoSubAttempted.current = true;
      console.log("[Push] Auto-prompting for push permission...");
      subscribe(true);
    }
  }, [user, isSupported, isSubscribed]);

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

  // Subscribe without showing toasts (for auto-subscribe)
  async function silentSubscribe() {
    if (!user) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      console.log("[Push] Auto-subscribed:", subscription.endpoint.slice(0, 60));

      const subJson = subscription.toJSON();
      const keys = subJson.keys!;

      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("endpoint", subJson.endpoint!);

      const { error } = await supabase
        .from("push_subscriptions")
        .insert({
          user_id: user.id,
          endpoint: subJson.endpoint!,
          p256dh: keys.p256dh!,
          auth: keys.auth!,
        });

      if (error) {
        console.error("[Push] Auto-subscribe DB error:", error);
        return;
      }

      console.log("[Push] Auto-subscribed and saved successfully");
      setIsSubscribed(true);
    } catch (e) {
      console.error("[Push] Silent subscribe error:", e);
    }
  }

  async function subscribe(isAuto = false) {
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
        if (!isAuto) {
          toast({
            title: "Permissão negada",
            description: "Ative as notificações nas configurações do navegador.",
            variant: "destructive",
          });
        }
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

      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("endpoint", subJson.endpoint!);

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
      
      if (!isAuto) {
        toast({ title: "Notificações ativadas! 🔔", description: "Você receberá alertas de vendas no celular." });
      }
    } catch (e: any) {
      console.error("[Push] Subscribe error:", e);
      if (!isAuto) {
        toast({
          title: "Erro ao ativar notificações",
          description: e.message || String(e),
          variant: "destructive",
        });
      }
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

  return { isSubscribed, isSupported, permission, subscribe: () => subscribe(false), unsubscribe };
}
