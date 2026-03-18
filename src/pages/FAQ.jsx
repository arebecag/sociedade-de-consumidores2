import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedPage, AnimatedItem, PageHeader } from "@/components/PageWrapper";
import { HelpCircle, ChevronDown, MessageCircle } from "lucide-react";

const faqItems = [
  { question: "É pirâmide?", answer: "Não, o sistema de pirâmide é ilegal, vai contra o sistema financeiro do Brasil. Nossa plataforma é registrada e atua legalmente seguindo as normas e regulamentos do país com venda de produtos e serviços emitindo notas fiscais." },
  { question: "Posso comprar qualquer produto ou serviço usando meus bônus?", answer: "Sim, basta enviar o boleto dentro de seu escritório virtual." },
  { question: "É possível comprar produtos que não tenham boleto?", answer: "Sim, é possível, basta enviar o código QR do produto a ser comprado respeitando sempre a data limite do vencimento." },
  { question: "O pagamento dos boletos ou código QR é feito no mesmo dia?", answer: "Nem sempre, por isto você precisa enviar com o prazo de até 7 dias antes do vencimento." },
  { question: "Como funciona o sistema de pagamento dos boletos ou código QR?", answer: "Temos uma equipe treinada para efetuar estes pagamentos, todos os boletos são checados antes do pagamento." },
  { question: "Como posso ter a garantia que o boleto foi pago?", answer: "Você poderá baixar o recibo do pagamento dentro do seu escritório virtual." },
  { question: "Quando recebo meus bônus?", answer: "Os bônus são creditados automaticamente toda segunda-feira das 00:00 às 06:00, direto na sua conta." },
  { question: "Qual o valor mínimo para saque?", answer: "O valor mínimo para depósito é R$ 30,00. Os pagamentos são automáticos toda segunda-feira." },
];

function FAQItem({ item, index }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.05] hover:border-orange-500/30 transition-all group"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
              <span className="text-orange-400 font-bold text-xs">{String(index + 1).padStart(2, '0')}</span>
            </div>
            <span className="text-white font-medium text-sm group-hover:text-orange-300 transition-colors">{item.question}</span>
          </div>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          </motion.div>
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <p className="text-zinc-400 text-sm mt-3 pl-10 leading-relaxed">{item.answer}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </motion.div>
  );
}

export default function FAQ() {
  return (
    <AnimatedPage>
      <PageHeader title="Dúvidas Frequentes" subtitle="Encontre respostas para as principais perguntas" />

      <AnimatedItem>
        <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 flex items-center gap-3">
          <MessageCircle className="w-5 h-5 text-orange-400 flex-shrink-0" />
          <p className="text-zinc-400 text-sm">Não encontrou sua resposta? Fale com o suporte: <a href="https://wa.me/5511951453200" target="_blank" className="text-orange-400 hover:text-orange-300 font-semibold underline transition-colors">(11) 95145-3200</a></p>
        </div>
      </AnimatedItem>

      <AnimatedItem>
        <motion.div variants={{ show: { transition: { staggerChildren: 0.06 } } }} initial="hidden" animate="show" className="space-y-3">
          {faqItems.map((item, i) => <FAQItem key={i} item={item} index={i} />)}
        </motion.div>
      </AnimatedItem>
    </AnimatedPage>
  );
}