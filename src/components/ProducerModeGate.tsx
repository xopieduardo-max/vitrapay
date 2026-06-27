import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Blocks producer-area routes (dashboard, products, sales, finance...) for users
 * that are not producers or that explicitly toggled "Modo Comprador" in the header dropdown.
 * Buyer-only users always get redirected to the buyer home (/home).
 */
export function ProducerModeGate() {
  const { user } = useAuth();

  const { data: roles, isLoading } = useQuery({
    queryKey: ["user-roles-mode-gate", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data || []).map((r) => r.role);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isProducer = roles?.includes("producer") || roles?.includes("admin");
  const viewMode = typeof window !== "undefined" ? localStorage.getItem("viewMode") : null;

  if (!isProducer || viewMode === "buyer") {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
}
