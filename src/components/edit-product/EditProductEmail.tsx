import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Monitor, Smartphone, RefreshCw } from "lucide-react";

interface EditProductEmailProps {
  productTitle: string;
  productType: string;
  productId: string;
}

function buildPreviewHtml(productTitle: string, productType: string, productId: string): string {
  const isCourse = productType === "course" || productType === "lms";
  const accessLink = isCourse
    ? `https://www.vitrapay.com.br/learn/${productId}`
    : `https://www.vitrapay.com.br/minha-conta`;
  const accessText = isCourse ? "Começar Meu Curso Agora" : "Acessar Meus Produtos";

  const courseWelcome = isCourse ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0faf0;border-left:4px solid #22c55e;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <tr><td style="padding:16px 20px;">
        <p style="font-size:15px;color:#1a1a1a;margin:0 0 8px;font-weight:bold;">&#127891; Boas-vindas ao seu novo curso!</p>
        <p style="font-size:14px;color:#444;margin:0;line-height:1.6;">
          Você agora tem acesso completo ao curso <strong>${productTitle}</strong>.
          Avance no seu ritmo, marque as aulas como concluídas e ao final ganhe seu certificado de conclusão.
        </p>
      </td></tr>
    </table>` : '';

  const credentialsSection = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border:2px solid #f5c518;border-radius:12px;margin:0 0 24px;">
      <tr><td style="padding:20px;">
        <p style="font-size:14px;color:#1a1a1a;margin:0 0 4px;font-weight:bold;">&#128273; Sua conta foi criada automaticamente!</p>
        <p style="font-size:14px;color:#333;margin:0 0 12px;line-height:1.5;">
          Use os dados abaixo para acessar seus produtos a qualquer momento:
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;">
          <tr><td style="padding:12px 16px;">
            <p style="font-size:13px;color:#888;margin:0 0 2px;">E-mail</p>
            <p style="font-size:15px;color:#1a1a1a;margin:0 0 10px;font-weight:bold;">comprador@email.com</p>
            <p style="font-size:13px;color:#888;margin:0 0 2px;">Senha</p>
            <p style="font-size:15px;color:#1a1a1a;margin:0;font-weight:bold;">Os 6 primeiros dígitos do seu CPF</p>
          </td></tr>
        </table>
        <p style="font-size:12px;color:#666;margin:10px 0 0;line-height:1.4;">
          &#9888;&#65039; Recomendamos que você troque sua senha após o primeiro acesso.
        </p>
      </td></tr>
    </table>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:100%;">
        <tr><td style="padding:28px 30px 0;text-align:left;">
          <span style="font-size:20px;font-weight:bold;color:#f5c518;">VitraPay</span>
        </td></tr>
        <tr><td style="background:#f5c518;padding:32px 30px;text-align:center;">
          <h1 style="margin:0 0 8px;color:#1a1a1a;font-size:24px;font-weight:bold;">Compra Confirmada!</h1>
          <p style="margin:0;color:#333;font-size:15px;">Seu pagamento foi processado com sucesso</p>
        </td></tr>
        <tr><td style="padding:30px;">
          <p style="font-size:16px;color:#333;margin:0 0 20px;line-height:1.6;">
            Olá <strong>João Silva</strong>,
          </p>
          <p style="font-size:16px;color:#333;margin:0 0 16px;line-height:1.6;">
            Seu pagamento foi confirmado com sucesso! Agradecemos pela sua compra.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:12px;margin:0 0 24px;">
            <tr><td style="padding:16px 20px;">
              <p style="font-size:13px;color:#888;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">Produto adquirido</p>
              <p style="font-size:18px;color:#0a0a0a;margin:0;font-weight:bold;">${productTitle}</p>
            </td></tr>
          </table>
          ${credentialsSection}
          ${courseWelcome}
          <p style="font-size:16px;color:#333;margin:0 0 24px;line-height:1.6;">
            ${isCourse ? 'Clique abaixo para começar sua jornada de aprendizado:' : 'Você pode acessar seus produtos a qualquer momento clicando no botão abaixo:'}
          </p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${accessLink}" style="display:inline-block;background:#f5c518;color:#1a1a1a;font-weight:bold;font-size:16px;padding:16px 36px;border-radius:12px;text-decoration:none;">
              ${accessText}
            </a>
          </td></tr></table>
          <p style="font-size:14px;color:#666;margin:28px 0 0;line-height:1.5;">
            Se tiver qualquer dúvida, responda este e-mail que nossa equipe irá te ajudar.
          </p>
          <p style="font-size:14px;color:#666;margin:12px 0 0;line-height:1.5;">
            Obrigado por confiar na VitraPay!
          </p>
        </td></tr>
        <tr><td style="background:#f5f5f5;padding:24px 30px;text-align:center;">
          <p style="margin:0;color:#999;font-size:12px;">Equipe VitraPay · vitrapay.com.br</p>
          <p style="margin:8px 0 0;color:#bbb;font-size:11px;">Este e-mail foi enviado porque você realizou uma compra em nossa plataforma.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default function EditProductEmail({ productTitle, productType, productId }: EditProductEmailProps) {
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [showCredentials, setShowCredentials] = useState(true);

  const html = buildPreviewHtml(productTitle, productType, productId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base">Preview do Email de Confirmação</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                É assim que o comprador receberá o email após a compra ser confirmada.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Enviado automaticamente
              </Badge>
              <div className="flex rounded-md border border-border overflow-hidden">
                <Button
                  variant={viewMode === "desktop" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-none border-0 h-8 gap-1.5"
                  onClick={() => setViewMode("desktop")}
                >
                  <Monitor className="h-3.5 w-3.5" /> Desktop
                </Button>
                <Button
                  variant={viewMode === "mobile" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-none border-0 h-8 gap-1.5 border-l border-border"
                  onClick={() => setViewMode("mobile")}
                >
                  <Smartphone className="h-3.5 w-3.5" /> Mobile
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1 min-w-[180px]">
              <p className="font-medium text-foreground text-xs uppercase tracking-wide mb-2">Dados de exemplo</p>
              <p><span className="text-muted-foreground">Nome:</span> João Silva</p>
              <p><span className="text-muted-foreground">Email:</span> comprador@email.com</p>
              <p><span className="text-muted-foreground">Produto:</span> {productTitle}</p>
              <p><span className="text-muted-foreground">Senha inicial:</span> 6 dígitos do CPF</p>
            </div>
            <p className="text-xs text-muted-foreground flex-1">
              O email é enviado automaticamente quando o pagamento é confirmado pelo gateway.
              Para compras via PIX, o envio ocorre em segundos após a confirmação.
              Para cartão, após a aprovação da operadora.
            </p>
          </div>
        </CardContent>
      </Card>

      <div
        className="border border-border rounded-xl overflow-hidden bg-muted/30"
        style={{ maxWidth: viewMode === "mobile" ? 420 : "100%", margin: "0 auto" }}
      >
        <div className="bg-muted/60 px-3 py-2 flex items-center gap-1.5 border-b border-border">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
          <div className="flex-1 mx-3 bg-background rounded text-[0.6rem] text-muted-foreground px-2 py-0.5 text-center">
            noreply@vitrapay.com.br
          </div>
        </div>
        <iframe
          key={`${viewMode}-${productTitle}`}
          srcDoc={html}
          title="Email Preview"
          className="w-full border-0"
          style={{ height: 700 }}
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
