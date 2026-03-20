import { Link } from "react-router-dom";
import { Zap, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPolicy() {
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
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground">Última atualização: 14 de março de 2026</p>

        <div className="prose prose-sm prose-invert max-w-none space-y-6 text-muted-foreground [&_h2]:text-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_strong]:text-foreground">

          <h2>1. Introdução</h2>
          <p>A VitraPay ("nós", "nosso") está comprometida com a proteção dos dados pessoais dos seus usuários, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD) e demais normas aplicáveis.</p>

          <h2>2. Dados Coletados</h2>
          <p>Coletamos as seguintes categorias de dados:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Dados de cadastro:</strong> nome, e-mail, CPF/CNPJ (para Produtores);</li>
            <li><strong>Dados de transação:</strong> valores, métodos de pagamento, histórico de compras;</li>
            <li><strong>Dados de navegação:</strong> endereço IP, tipo de navegador, páginas visitadas;</li>
            <li><strong>Dados de uso:</strong> interações com a Plataforma, preferências, configurações.</li>
          </ul>

          <h2>3. Finalidade do Tratamento</h2>
          <p>Seus dados são tratados para as seguintes finalidades:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Prestação do serviço de intermediação de pagamentos;</li>
            <li>Processamento de transações financeiras;</li>
            <li>Comunicações sobre a conta e transações;</li>
            <li>Prevenção a fraudes e segurança da Plataforma;</li>
            <li>Cumprimento de obrigações legais e regulatórias;</li>
            <li>Melhoria dos serviços e experiência do usuário.</li>
          </ul>

          <h2>4. Base Legal (Art. 7º, LGPD)</h2>
          <p>O tratamento dos dados pessoais fundamenta-se nas seguintes bases legais:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Execução de contrato:</strong> para prestação dos serviços contratados;</li>
            <li><strong>Consentimento:</strong> para comunicações de marketing (quando aplicável);</li>
            <li><strong>Obrigação legal:</strong> para cumprimento de normas fiscais e regulatórias;</li>
            <li><strong>Legítimo interesse:</strong> para prevenção a fraudes e melhoria dos serviços.</li>
          </ul>

          <h2>5. Compartilhamento de Dados</h2>
          <p>Compartilhamos dados pessoais apenas com:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Processadores de pagamento:</strong> para efetivação das transações;</li>
            <li><strong>Produtores:</strong> dados do Comprador necessários para entrega do produto;</li>
            <li><strong>Autoridades competentes:</strong> quando exigido por lei ou ordem judicial.</li>
          </ul>
          <p><strong>Não vendemos, alugamos ou compartilhamos dados pessoais com terceiros para fins de marketing.</strong></p>

          <h2>6. Armazenamento e Segurança</h2>
          <p>Os dados são armazenados em servidores seguros com criptografia em trânsito (TLS/SSL) e em repouso. Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, destruição, perda ou alteração.</p>

          <h2>7. Retenção de Dados</h2>
          <p>Mantemos seus dados pelo período necessário para cumprir as finalidades descritas, ou conforme exigido por obrigações legais. Dados de transações financeiras são mantidos pelo prazo legal mínimo de 5 anos (Código Tributário Nacional).</p>

          <h2>8. Direitos do Titular (Art. 18, LGPD)</h2>
          <p>Você tem direito a:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Confirmação da existência de tratamento;</li>
            <li>Acesso aos seus dados pessoais;</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários;</li>
            <li>Portabilidade dos dados;</li>
            <li>Eliminação dos dados tratados com consentimento;</li>
            <li>Revogação do consentimento.</li>
          </ul>

          <h2>9. Cookies</h2>
          <p>Utilizamos cookies essenciais para o funcionamento da Plataforma e cookies analíticos para entender o uso dos serviços. Você pode gerenciar cookies através das configurações do seu navegador.</p>

          <h2>10. Papel de Intermediador</h2>
          <p>A VitraPay atua como <strong>operadora de dados</strong> nas transações entre Produtores e Compradores. O Produtor é o <strong>controlador dos dados</strong> dos seus clientes e responsável pelo tratamento adequado conforme a LGPD.</p>

          <h2>11. Encarregado de Proteção de Dados (DPO)</h2>
          <p>Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento de dados pessoais, entre em contato com nosso Encarregado de Proteção de Dados através do e-mail disponível na seção de contato da Plataforma.</p>

          <h2>12. Alterações</h2>
          <p>Esta Política poderá ser atualizada periodicamente. Notificaremos os usuários sobre alterações significativas através da Plataforma ou por e-mail.</p>
        </div>
      </main>
    </div>
  );
}
