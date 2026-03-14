import { Link } from "react-router-dom";
import { Zap, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsOfUse() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary glow-primary">
              <Zap className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
            </div>
            <span className="text-xl font-bold tracking-tight">Aether</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
          </Button>
        </div>
      </header>

      <main className="container max-w-3xl py-12 md:py-20 space-y-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground">Última atualização: 14 de março de 2026</p>

        <div className="prose prose-sm prose-invert max-w-none space-y-6 text-muted-foreground [&_h2]:text-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_strong]:text-foreground">

          <h2>1. Aceitação dos Termos</h2>
          <p>Ao acessar ou utilizar a plataforma Aether ("Plataforma"), você concorda com estes Termos de Uso. Caso não concorde com qualquer disposição, não utilize a Plataforma.</p>

          <h2>2. Definições</h2>
          <p><strong>Plataforma:</strong> Sistema de intermediação de pagamentos e distribuição de produtos digitais operado pela Aether.</p>
          <p><strong>Produtor:</strong> Pessoa física ou jurídica que cria e disponibiliza produtos digitais na Plataforma.</p>
          <p><strong>Afiliado:</strong> Usuário que promove produtos de Produtores em troca de comissão.</p>
          <p><strong>Comprador:</strong> Usuário que adquire produtos digitais através da Plataforma.</p>

          <h2>3. Natureza do Serviço — Intermediação</h2>
          <p>A Aether atua exclusivamente como <strong>intermediadora de pagamentos e distribuidora tecnológica</strong>. A Plataforma não é responsável pelo conteúdo, qualidade, legalidade, veracidade ou adequação dos produtos digitais ofertados pelos Produtores.</p>
          <p>Nos termos do artigo 730 e seguintes do Código Civil Brasileiro e da Lei nº 12.965/2014 (Marco Civil da Internet), a Aether:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Não produz, edita ou supervisiona o conteúdo dos produtos digitais;</li>
            <li>Não garante resultados financeiros ou de qualquer outra natureza aos Compradores;</li>
            <li>Não se responsabiliza por disputas comerciais entre Produtores, Afiliados e Compradores;</li>
            <li>Atua como facilitadora tecnológica do processamento de pagamentos.</li>
          </ul>

          <h2>4. Responsabilidades do Produtor</h2>
          <p>O Produtor é o único e exclusivo responsável por:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>O conteúdo, qualidade e entrega dos produtos digitais;</li>
            <li>O cumprimento do Código de Defesa do Consumidor (Lei nº 8.078/90);</li>
            <li>A veracidade das informações e promessas de venda;</li>
            <li>O atendimento ao comprador e suporte pós-venda;</li>
            <li>O cumprimento de obrigações fiscais e tributárias;</li>
            <li>A conformidade com a LGPD (Lei nº 13.709/2018) quanto aos dados de seus clientes.</li>
          </ul>

          <h2>5. Responsabilidades do Comprador</h2>
          <p>O Comprador reconhece que:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>A decisão de compra é de sua inteira responsabilidade;</li>
            <li>Deve verificar as informações do produto antes da aquisição;</li>
            <li>O direito de arrependimento de 7 dias (art. 49, CDC) aplica-se conforme a legislação vigente;</li>
            <li>Reclamações sobre o conteúdo devem ser direcionadas ao Produtor.</li>
          </ul>

          <h2>6. Pagamentos e Taxas</h2>
          <p>A Plataforma cobra taxas de intermediação sobre as transações realizadas. As taxas vigentes são exibidas na área do Produtor e podem ser alteradas mediante aviso prévio de 30 dias.</p>
          <p>Os prazos de repasse seguem as condições de cada método de pagamento (Pix, cartão de crédito, boleto bancário).</p>

          <h2>7. Política de Reembolso</h2>
          <p>Reembolsos são processados conforme o Código de Defesa do Consumidor. O Produtor pode estabelecer políticas de garantia estendida. A Aether atua como intermediadora no processamento do reembolso, mas a responsabilidade pela política é do Produtor.</p>

          <h2>8. Propriedade Intelectual</h2>
          <p>Todo o conteúdo dos produtos digitais pertence aos respectivos Produtores. A marca, logotipo e tecnologia da Plataforma são de propriedade exclusiva da Aether.</p>

          <h2>9. Suspensão e Encerramento</h2>
          <p>A Aether reserva-se o direito de suspender ou encerrar contas que violem estes Termos, pratiquem fraudes, ofereçam conteúdo ilegal ou prejudiquem a reputação da Plataforma.</p>

          <h2>10. Limitação de Responsabilidade</h2>
          <p>A Aether não será responsável por danos diretos, indiretos, incidentais ou consequentes decorrentes do uso da Plataforma ou da aquisição de produtos digitais. A responsabilidade máxima da Aether limita-se ao valor das taxas de intermediação cobradas nos últimos 12 meses.</p>

          <h2>11. Legislação Aplicável</h2>
          <p>Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer controvérsias.</p>

          <h2>12. Alterações</h2>
          <p>A Aether poderá alterar estes Termos a qualquer momento, notificando os usuários com antecedência mínima de 30 dias. O uso continuado da Plataforma após as alterações constitui aceitação dos novos termos.</p>
        </div>
      </main>
    </div>
  );
}
