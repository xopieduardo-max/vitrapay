import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, Table2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExportButtonProps {
  data: Record<string, any>[];
  columns: { key: string; label: string }[];
  filename?: string;
}

export function ExportButton({ data, columns, filename = "relatorio" }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const exportCSV = () => {
    setExporting(true);
    try {
      const header = columns.map((c) => c.label).join(",");
      const rows = data.map((row) =>
        columns.map((c) => {
          const val = row[c.key];
          if (val === null || val === undefined) return "";
          const str = String(val);
          return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(",")
      );
      const csv = [header, ...rows].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV exportado com sucesso!" });
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const exportJSON = () => {
    setExporting(true);
    try {
      const exportData = data.map((row) => {
        const obj: Record<string, any> = {};
        columns.forEach((c) => { obj[c.label] = row[c.key]; });
        return obj;
      });
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "JSON exportado com sucesso!" });
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  if (data.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={exporting}>
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportCSV} className="gap-2">
          <Table2 className="h-4 w-4" /> Exportar CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportJSON} className="gap-2">
          <FileText className="h-4 w-4" /> Exportar JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
