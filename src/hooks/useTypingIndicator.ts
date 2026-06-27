import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight realtime typing indicator using Supabase broadcast.
 * - No DB writes; everything is ephemeral.
 * - Each side calls `notifyTyping()` while the user types.
 * - `isOtherTyping` becomes true when the other side is currently typing,
 *   and clears automatically after 3s of silence.
 */
export function useTypingIndicator(opts: {
  ticketId: string | null | undefined;
  isAdmin: boolean;
  enabled?: boolean;
}) {
  const { ticketId, isAdmin, enabled = true } = opts;
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    if (!ticketId || !enabled) return;
    const channel = supabase.channel(`support-typing:${ticketId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        const fromAdmin = !!(payload.payload as any)?.isAdmin;
        // Only react to events coming from the OTHER side.
        if (fromAdmin === isAdmin) return;
        setIsOtherTyping(true);
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
        clearTimerRef.current = setTimeout(() => setIsOtherTyping(false), 3000);
      })
      .on("broadcast", { event: "stop" }, (payload) => {
        const fromAdmin = !!(payload.payload as any)?.isAdmin;
        if (fromAdmin === isAdmin) return;
        setIsOtherTyping(false);
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsOtherTyping(false);
    };
  }, [ticketId, isAdmin, enabled]);

  const notifyTyping = useCallback(() => {
    const ch = channelRef.current;
    if (!ch) return;
    const now = Date.now();
    // Throttle to once per ~1.2s.
    if (now - lastSentRef.current < 1200) return;
    lastSentRef.current = now;
    ch.send({ type: "broadcast", event: "typing", payload: { isAdmin } });
  }, [isAdmin]);

  const notifyStop = useCallback(() => {
    const ch = channelRef.current;
    if (!ch) return;
    lastSentRef.current = 0;
    ch.send({ type: "broadcast", event: "stop", payload: { isAdmin } });
  }, [isAdmin]);

  return { isOtherTyping, notifyTyping, notifyStop };
}
