import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_PREFIX = "vitrapay_seen_popups";

function getStorageKey(userId?: string) {
  return `${STORAGE_PREFIX}:${userId ?? "guest"}`;
}

function getSeenPopups(storageKey: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "[]");
  } catch {
    return [];
  }
}

function markPopupAsSeen(storageKey: string, popupId: string) {
  const seen = getSeenPopups(storageKey);
  if (!seen.includes(popupId)) {
    localStorage.setItem(storageKey, JSON.stringify([...seen, popupId]));
  }
}

export function PlatformPopup() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [currentPopup, setCurrentPopup] = useState<any>(null);
  const storageKey = getStorageKey(user?.id);

  const { data: popups = [] } = useQuery({
    queryKey: ["platform-popups"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_popups")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  useEffect(() => {
    if (loading) return;
    if (!popups.length) {
      setCurrentPopup(null);
      setOpen(false);
      return;
    }

    const seen = getSeenPopups(storageKey);
    const toShow = popups.find((popup: any) => !seen.includes(popup.id));

    if (!toShow) {
      setCurrentPopup(null);
      setOpen(false);
      return;
    }

    markPopupAsSeen(storageKey, toShow.id);
    setCurrentPopup((prev: any) => (prev?.id === toShow.id ? prev : toShow));
    setOpen(true);
  }, [loading, popups, storageKey]);

  const handleClose = () => {
    if (currentPopup?.show_once) {
      markPopupAsSeen(storageKey, currentPopup.id);
    }
    setOpen(false);
  };

  if (!currentPopup) return null;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{currentPopup.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {currentPopup.image_url && (
            <img
              src={currentPopup.image_url}
              alt=""
              className="w-full rounded-lg object-cover max-h-48"
            />
          )}
          {currentPopup.content && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {currentPopup.content}
            </p>
          )}
          <Button
            className="w-full"
            onClick={() => {
              if (currentPopup.button_url) {
                window.open(currentPopup.button_url, "_blank");
              }
              handleClose();
            }}
          >
            {currentPopup.button_text || "Entendi"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
