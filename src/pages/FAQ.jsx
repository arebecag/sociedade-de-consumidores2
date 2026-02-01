import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

const faqItems = [
  {
    question: "É pirâmide?",
    answer: "Não, o sistema de pirâmide é ilegal, vai contra o sistema financeiro do Brasil. Nossa plataforma é registrada e atua legalmente seguindo as normas e regulamentos do país com venda de produtos e serviços emitindo notas fiscais."
  },
  {
    question: "Posso comprar qualquer produto ou serviço usando meus bônus?",
    answer: "Sim, basta enviar o boleto dentro de seu escritório virtual."
  },
  {
    question: "É possível comprar produtos que não tenham boleto?",
    answer: "Sim, é possível, basta enviar o código QR do produto a ser comprado respeitando sempre a data limite do vencimento."
  },
  {
    question: "O pagamento dos boletos ou código QR é feito no mesmo dia?",
    answer: "Nem sempre, por isto você precisa enviar com o prazo de até 7 dias antes do vencimento."
  },
  {
    question: "Como funciona o sistema de pagamento dos boletos ou código QR?",
    answer: "Temos uma equipe treinada para efetuar estes pagamentos, todos os boletos são checados antes do pagamento."
  },
  {
    question: "Como posso ter a garantia que o boleto foi pago?",
    answer: "Você poderá baixar o recibo do pagamento dentro do seu escritório virtual."
  }
];

export default function FAQ() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Dúvidas Frequentes</h1>
        <p className="text-gray-400">Encontre respostas para as principais perguntas</p>
      </div>

      <Card className="bg-zinc-950 border-orange-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-orange-500" />
            Perguntas e Respostas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="space-y-2">
            {faqItems.map((item, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="border border-zinc-800 rounded-lg px-4 bg-zinc-900"
              >
                <AccordionTrigger className="text-white hover:text-orange-500 hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-400">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}