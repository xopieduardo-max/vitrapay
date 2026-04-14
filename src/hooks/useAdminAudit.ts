import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback } from "react";

export type AdminAction =
  | "user_suspended"
  | "user_reactivated"
  | "user_fee_updated"
  | "withdrawal_approved"
  | "withdrawal_rejected"
  | "withdrawal_pix_sent"
  | "platform_settings_saved"
  | "product_unpublished"
  | "push_notification_sent"
  | "banner_created"
  | "banner_deleted"
  | "community_approved"
  | "community_rejected";

export function useAdminAudit() {
  const { user } = useAuth();

  const logAction = useCallback(
    async (
      action: AdminAction,
      targetType?: string,
      targetId?: string,
      details?: Record<string, unknown>
    ) => {
      if (!user) return;
      try {
        await supabase.from("admin_audit_log").insert({
          admin_id: user.id,
          action,
          target_type: targetType ?? null,
          target_id: targetId ?? null,
          details: details ?? null,
        });
      } catch (e) {
        // Non-blocking — never throw
        console.error("Admin audit log error:", e);
      }
    },
    [user]
  );

  return { logAction };
}
