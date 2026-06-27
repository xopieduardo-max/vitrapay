import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  saleId: string;
  productId: string;
  productTitle: string;
  onSaved?: () => void;
}

export function ReviewDialog({ open, onOpenChange, saleId, productId, productTitle, onSaved }: Props) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRating(0); setComment(""); setExistingId(null);
    supabase.from("product_reviews").select("id, rating, comment").eq("sale_id", saleId).maybeSingle().then(({ data }) => {
      if (data) { setRating(data.rating); setComment(data.comment ?? ""); setExistingId(data.id); }
    });
  }, [open, saleId]);

  const save = async () => {
    if (!user || rating < 1) { toast.error("Escolha uma nota."); return; }
    setLoading(true);
    const payload = { user_id: user.id, sale_id: saleId, product_id: productId, rating, comment: comment.trim() || null };
    const { error } = existingId
      ? await supabase.from("product_reviews").update({ rating, comment: payload.comment }).eq("id", existingId)
      : await supabase.from("product_reviews").insert(payload);
    setLoading(false);
    if (error) { toast.error("Erro ao salvar avaliação."); return; }
    toast.success(existingId ? "Avaliação atualizada!" : "Obrigado pela avaliação!");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Avaliar produto</DialogTitle>
          <DialogDescription className="line-clamp-2">{productTitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`h-9 w-9 ${(hover || rating) >= n ? "fill-primary text-primary" : "text-muted-foreground"}`}
                  strokeWidth={1.5}
                />
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Conte como foi sua experiência (opcional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={loading || rating < 1}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {existingId ? "Atualizar" : "Enviar avaliação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
