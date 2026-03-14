import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

interface Props {
  form: Record<string, any>;
  updateField: (field: string, value: any) => void;
}

export default function EditProductSettings({ form, updateField }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div>
          <Label className="text-xs">Título do produto</Label>
          <Input value={form.title || ""} onChange={(e) => updateField("title", e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Descrição</Label>
          <Textarea value={form.description || ""} onChange={(e) => updateField("description", e.target.value)} rows={4} className="mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Preço (R$)</Label>
            <Input type="number" step="0.01" value={form.price || ""} onChange={(e) => updateField("price", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <select
              value={form.type || "download"}
              onChange={(e) => updateField("type", e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="download">Download</option>
              <option value="lms">Área de Membros</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-xs">Comissão de afiliado: {form.affiliate_commission || 0}%</Label>
          <Slider
            value={[form.affiliate_commission || 0]}
            onValueChange={([v]) => updateField("affiliate_commission", v)}
            max={80}
            step={5}
            className="mt-3"
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <Label className="text-sm font-medium">Publicado</Label>
            <p className="text-[0.65rem] text-muted-foreground">Visível nas Oportunidades</p>
          </div>
          <Switch checked={form.is_published || false} onCheckedChange={(v) => updateField("is_published", v)} />
        </div>
      </div>
    </div>
  );
}
