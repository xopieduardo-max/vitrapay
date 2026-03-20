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
import { X } from "lucide-react";

const DISMISSED_KEY = "vitrapay_dismissed_popups";

function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
  } catch {
    return [];
  }
}

export function PlatformPopup() {
  const [open, setOpen] = useState(false);
  const [currentPopup, setCurrentPopup] = useState<any>(null);

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
    if (!popups.length) return;
    const dismissed = getDismissed();
    const toShow = popups.find(
      (p: any) => !(p.show_once && dismissed.includes(p.id))
    );
    if (toShow) {
      setCurrentPopup(toShow);
      setOpen(true);
    }
  }, [popups]);

  const handleClose = () => {
    if (currentPopup?.show_once) {
      const dismissed = getDismissed();
      dismissed.push(currentPopup.id);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
    }
    setOpen(false);
  };

  if (!currentPopup) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
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
