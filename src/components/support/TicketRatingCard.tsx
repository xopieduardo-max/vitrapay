import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  ticketId: string;
  currentRating?: number | null;
  currentComment?: string | null;
  compact?: boolean;
}

export function TicketRatingCard({ ticketId, currentRating, currentComment, compact }: Props) {
  const qc = useQueryClient();
  const [rating, setRating] = useState<number>(currentRating || 0);
  const [hover, setHover] = useState<number>(0);
  const [comment, setComment] = useState<string>(currentComment || "");
  const [saving, setSaving] = useState(false);

  const alreadyRated = !!currentRating;

  const submit = async () => {
    if (!rating) {
      toast.error("Toque em uma estrela para avaliar.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("support_tickets")
      .update({ rating, rating_comment: comment.trim() || null })
      .eq("id", ticketId);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível registrar a avaliação.");
      return;
    }
    toast.success("Obrigado pela sua avaliação!");
    qc.invalidateQueries({ queryKey: ["support-tickets-mine"] });
    qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
  };

  if (alreadyRated) {
    return (
      <div className={`rounded-xl border border-border bg-muted/30 ${compact ? "p-3" : "p-4"} text-center space-y-1.5`}>
        <div className="flex items-center justify-center gap-1 text-primary">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-xs font-medium">Você avaliou este atendimento</span>
        </div>
        <div className="flex items-center justify-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={`h-4 w-4 ${n <= (currentRating || 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`}
            />
          ))}
        </div>
        {currentComment && (
          <p className="text-xs text-muted-foreground italic max-w-md mx-auto">"{currentComment}"</p>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent ${compact ? "p-3" : "p-4"} space-y-3`}>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold">Como foi o atendimento?</p>
        <p className="text-xs text-muted-foreground">Sua opinião nos ajuda a melhorar.</p>
      </div>
      <div className="flex items-center justify-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            className="p-1 transition-transform hover:scale-110"
            aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
          >
            <Star
              className={`h-7 w-7 transition-colors ${
                n <= (hover || rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"
              }`}
            />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Deixe um comentário (opcional)..."
            rows={2}
            maxLength={500}
            className="resize-none text-sm"
            lang="pt-BR"
            spellCheck
          />
          <Button onClick={submit} disabled={saving} className="w-full" size="sm">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Enviar avaliação
          </Button>
        </>
      )}
    </div>
  );
}
