import { Link } from "react-router-dom";
import { Zap, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PurchaseTerms() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary glow-primary">
              <Zap className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
            </div>
            <span className="text-xl font-bold tracking-tight">VitraPay</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
          </Button>
        </div>
      </header>

      <main className="container max-w-3xl py-12 md:py-20 space-y-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Termos de Compra</h1>
        <p className="text-sm text-muted-foreground">Última atualização: 23 de março de 2026</p>

        <div className="prose prose-sm prose-invert max-w-none space-y-6 text-muted-foreground [&_h2]:text-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_strong]:text-foreground">

          <h2>1. Objeto</h2>
          <p>Os presentes Termos de Compra regulam a relação entre o <strong>Comprador</strong> e o <strong>Produtor</strong> do produto digital adquirido através da plataforma VitraPay, que atua exclusivamente como intermediadora de pagamentos.</p>

          <h2>2. Processamento do Pagamento</h2>
          <p>A VitraPay é responsável pelo processamento seguro do pagamento. Todos os dados financeiros são tratados com criptografia de ponta a ponta e em conformidade com os padrões PCI-DSS. A VitraPay <strong>não armazena</strong> dados completos de cartão de crédito.</p>

          <h2>3. Métodos de Pagamento</h2>
          <p>A plataforma aceita os seguintes métodos:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>PIX:</strong> Pagamento instantâneo. O acesso ao produto é liberado automaticamente após a confirmação pelo banco;</li>
            <li><strong>Cartão de Crédito:</strong> Pagamento à vista ou parcelado. A liberação do acesso ocorre após a aprovação da operadora;</li>
          </ul>
          <p>Pagamentos via cartão de crédito possuem valor mínimo de R$ 5,00.</p>

          <h2>4. Entrega do Produto Digital</h2>
          <p>Após a confirmação do pagamento, o acesso ao produto digital é concedido automaticamente. O Comprador receberá um e-mail de confirmação com as instruções de acesso. Para produtos do tipo <strong>Área de Membros</strong>, o acesso será disponibilizado mediante login na plataforma.</p>

          <h2>5. Direito de Arrependimento</h2>
          <p>Conforme o artigo 49 do Código de Defesa do Consumidor (Lei nº 8.078/90), o Comprador possui o direito de desistir da compra no prazo de <strong>7 (sete) dias corridos</strong> a contar da data de aquisição ou do recebimento do produto, o que ocorrer por último.</p>
          <p>Para solicitar o reembolso, o Comprador deve entrar em contato diretamente com o Produtor. A VitraPay intermediará o processamento do estorno após a aprovação do Produtor ou mediante determinação legal.</p>

          <h2>6. Responsabilidade do Produtor</h2>
          <p>O <strong>Produtor</strong> é o único responsável por:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>A qualidade, veracidade e adequação do conteúdo do produto digital;</li>
            <li>O suporte e atendimento pós-venda ao Comprador;</li>
            <li>O cumprimento de garantias e promessas realizadas na página de venda;</li>
            <li>A conformidade com a legislação aplicável, incluindo CDC e LGPD.</li>
          </ul>

          <h2>7. Limitação de Responsabilidade da VitraPay</h2>
          <p>A VitraPay atua exclusivamente como <strong>intermediadora tecnológica</strong> do pagamento. Não nos responsabilizamos por:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Conteúdo, qualidade ou resultados prometidos pelo Produtor;</li>
            <li>Disputas comerciais entre Comprador e Produtor;</li>
            <li>Indisponibilidade do produto por responsabilidade do Produtor.</li>
          </ul>

          <h2>8. Proteção de Dados</h2>
          <p>Os dados pessoais do Comprador são tratados em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Coletamos apenas os dados necessários para o processamento do pagamento e entrega do produto. Para mais detalhes, consulte nossa <Link to="/privacy" className="text-primary hover:underline">Política de Privacidade</Link>.</p>

          <h2>9. Segurança</h2>
          <p>Todas as transações realizadas na VitraPay são protegidas por:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Criptografia SSL/TLS em todas as comunicações;</li>
            <li>Tokenização de dados de pagamento;</li>
            <li>Monitoramento antifraude em tempo real;</li>
            <li>Conformidade com padrões internacionais de segurança.</li>
          </ul>

          <h2>10. Cupons de Desconto</h2>
          <p>Cupons de desconto são de responsabilidade exclusiva do Produtor. Cada cupom possui regras próprias de validade, quantidade de usos e valor de desconto. Cupons expirados ou esgotados não poderão ser utilizados.</p>

          <h2>11. Parcelamento</h2>
          <p>O parcelamento via cartão de crédito pode conter acréscimos conforme a política da operadora do cartão. O valor das parcelas e eventuais juros são informados antes da finalização da compra.</p>

          <h2>12. Legislação Aplicável</h2>
          <p>Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer controvérsias decorrentes desta relação de compra.</p>

          <h2>13. Contato</h2>
          <p>Para dúvidas sobre o pagamento ou a plataforma, entre em contato através dos canais oficiais da VitraPay. Para questões relacionadas ao conteúdo do produto, entre em contato diretamente com o Produtor.</p>
        </div>
      </main>
    </div>
  );
}
