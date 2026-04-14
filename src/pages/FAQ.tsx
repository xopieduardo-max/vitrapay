import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqItems = [
  { q: "O que é a VitraPay?", a: "A VitraPay é uma plataforma completa de vendas de produtos digitais. Você pode vender cursos, e-books, mentorias e muito mais com checkout otimizado, área de membros, programa de afiliados e financeiro integrado." },
  { q: "Quais as taxas cobradas pela VitraPay?", a: "Para Pix, a taxa é zero para o comprador e o recebimento é instantâneo (D+0). Para cartão de crédito, a taxa inicial é de 3,99% + R$ 2,49 com recebimento em D+30, ou 4,99% + R$ 2,49 com antecipação D+2." },
  { q: "Como funciona o saque?", a: "Você pode solicitar saque a partir de R$ 10,00. O valor é enviado direto para sua chave Pix cadastrada. Saques são processados rapidamente pela nossa equipe." },
  { q: "Posso ter afiliados vendendo meus produtos?", a: "Sim! A VitraPay tem um programa de afiliados completo. Você define a comissão de cada produto e os afiliados recebem um link exclusivo para divulgar." },
  { q: "A plataforma tem área de membros?", a: "Sim! Você pode organizar conteúdo em módulos e aulas, adicionar vídeos, acompanhar o progresso dos alunos e oferecer uma experiência profissional de aprendizado." },
  { q: "Preciso pagar para criar minha conta?", a: "Não! A criação de conta é 100% gratuita. Você só paga taxas sobre as vendas realizadas. Sem mensalidade, sem taxa de adesão." },
  { q: "Comprei um produto na VitraPay e preciso de ajuda, como proceder?", a: "HELP_LINK" },
];

export default function FAQ() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl py-16 md:py-24 px-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>

        <div className="text-center space-y-4 mb-12">
          <span className="text-xs font-medium uppercase tracking-widest text-primary">
            Dúvidas frequentes
          </span>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            Perguntas <span className="text-primary">frequentes</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Encontre respostas para as principais dúvidas sobre a VitraPay.
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqItems.map((item, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="rounded-2xl border border-border/50 bg-card/50 px-6 data-[state=open]:border-primary/30 transition-colors"
            >
              <AccordionTrigger className="text-left text-[15px] font-semibold hover:no-underline py-5">
                <span className="flex items-start gap-3">
                  <span className="text-primary font-bold tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {item.q}
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                {item.a === "HELP_LINK" ? (
                  <span>
                    Se você comprou um produto através da VitraPay, a responsabilidade pelo conteúdo e suporte é do produtor. Para dúvidas sobre pagamento ou reembolso, acesse nossa{" "}
                    <Link to="/help" className="text-primary underline underline-offset-4 hover:text-primary/80">
                      Central de Ajuda
                    </Link>.
                  </span>
                ) : (
                  item.a
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
