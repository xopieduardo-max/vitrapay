import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceHash, getDeviceLabel, getClientIp } from "@/lib/deviceFingerprint";

/**
 * Registra o dispositivo atual após login e dispara alerta por e-mail
 * se for um dispositivo desconhecido. Não bloqueia a UI.
 */
export function useDeviceTracking(userId: string | undefined) {
  const trackedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    if (trackedRef.current === userId) return;
    trackedRef.current = userId;

    let cancelled = false;
    (async () => {
      try {
        const [hash, ip] = await Promise.all([getDeviceHash(), getClientIp()]);
        if (cancelled) return;
        const label = getDeviceLabel();

        const { data, error } = await supabase.rpc("register_login_attempt", {
          _device_hash: hash,
          _ip: ip,
          _user_agent: navigator.userAgent.slice(0, 500),
          _device_label: label,
        });
        if (error || cancelled) return;

        const row = Array.isArray(data) ? data[0] : data;
        if (row?.is_new_device) {
          supabase.functions
            .invoke("notify-new-device", {
              body: { device_label: label, ip },
            })
            .catch(() => {});
        }
      } catch {
        // silencioso — não afeta UX
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}
