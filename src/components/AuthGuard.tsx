import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export function AuthGuard() {
  const { user, loading } = useAuth();
  const location = useLocation();

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["onboarding-check", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: roles, isLoading: loadingRoles } = useQuery({
    queryKey: ["user-roles-guard", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      return (data || []).map((r) => r.role);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  if (loading || loadingProfile || loadingRoles) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Skip onboarding for buyer-only users (auto-created accounts)
  const isBuyerOnly = roles && roles.length > 0 && roles.every((r) => r === "buyer");

  if (profile && !profile.onboarding_completed && !isBuyerOnly && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
