import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { usePartner } from "@/components/usePartner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedPage, AnimatedItem, PageHeader, LoadingSpinner, EmptyState } from "@/components/PageWrapper";
import { Loader2, ShoppingCart, AlertTriangle, Download, CreditCard, FileText, Package, CheckCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const categories = { tele_consulta: "Tele Consulta", curso_online: "Curso Online", ebook: "E-book", software: "Software", outros: "Outros" };
const fmtR = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const catColors = {
  tele_consulta: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  curso_online: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  ebook: "bg-green-500/10 text-green-400 border-green-500/20",
  software: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  outros: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export default function Store() {
  const { partner, loading: partnerLoading } = usePartner();
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("bonus");
  const [processing, setProcessing] = useState(false);
  const [boletoUrl, setBoletoUrl] = useState(null);
  const [activeTab, setActiveTab] = useState("products");

  useEffect(() => {
    if (partner) loadData(partner);
    else if (!partnerLoading) setLoading(false);
  }, [partner, partnerLoading]);

  const loadData = async (p) => {
    try {
      const [userPurchases, allProducts] = await Promise.all([
        base44.entities.Purchase.filter({ partner_id: p.id }),
        base44.entities.Product.filter({ active: true })
      ]);
      setPurchases(userPurchases);
      setProducts(allProducts);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const addToCart = (product) => {
    if (product.category === 'tele_consulta') { toast.info("Tele Consulta estará disponível em breve!"); return; }
    setCart(prev => {
      const ex = prev.find(i => i.product.id === product.id);
      if (ex) return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product, qty: 1 }];
    });
    toast.success(`${product.name} adicionado!`);
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.product.id !== id));
  const cartTotal = cart.reduce((s, i) => s + i.product.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const handleCheckout = async () => {
    if (!partner || cart.length === 0) return;
    setProcessing(true); setBoletoUrl(null);
    try {
      const isFirstPurchase = !partner.first_purchase_done;
      const bonusAvailable = partner.bonus_for_purchases || 0;
      let paidWithBonus = 0, paidWithBoleto = 0, actualPaymentMethod = paymentMethod;
      if (paymentMethod === "bonus") {
        if (bonusAvailable >= cartTotal) { paidWithBonus = cartTotal; }
        else { paidWithBonus = bonusAvailable; paidWithBoleto = cartTotal - bonusAvailable; actualPaymentMethod = "misto"; }
      } else { paidWithBoleto = cartTotal; }

      const createdPurchases = [];
      for (const item of cart) {
        const itemTotal = item.product.price * item.qty;
        const ratio = cartTotal > 0 ? itemTotal / cartTotal : 0;
        const itemBonus = Math.round(paidWithBonus * ratio * 100) / 100;
        const p = await base44.entities.Purchase.create({
          partner_id: partner.id, partner_name: partner.full_name,
          product_id: item.product.id, product_name: item.product.name,
          amount: itemTotal, paid_with_bonus: itemBonus, paid_with_boleto: itemTotal - itemBonus,
          payment_method: actualPaymentMethod, status: paidWithBoleto > 0 ? "pending" : "paid",
          is_first_purchase: isFirstPurchase && createdPurchases.length === 0,
          download_available: paidWithBoleto === 0
        });
        createdPurchases.push(p);
      }

      const updates = { bonus_for_purchases: bonusAvailable - paidWithBonus, total_spent_purchases: (partner.total_spent_purchases || 0) + paidWithBonus };
      if (paidWithBoleto === 0 && isFirstPurchase && cartTotal >= 125) {
        updates.first_purchase_done = true;
        updates.pending_reasons = (partner.pending_reasons || []).filter(r => r !== "Falta da primeira compra");
        if (partner.cpf && partner.address?.cep) { updates.status = "ativo"; updates.pending_reasons = []; }
      }
      await base44.entities.Partner.update(partner.id, updates);

      if (paidWithBoleto === 0) {
        for (const p of createdPurchases) {
          await base44.functions.invoke('distribuirComissoes', { purchaseId: p.id, amount: p.amount, buyerPartnerId: partner.id });
        }
      }

      if (paidWithBoleto > 0) {
        const due = new Date(); due.setDate(due.getDate() + 3);
        const res = await base44.functions.invoke('gerarBoletoParaUsuario', {
          userId: partner.id, valor: paidWithBoleto,
          descricao: `Compra: ${cart.map(i => i.product.name).join(", ")}`,
          dataVencimento: due.toISOString().split("T")[0]
        });
        const boleto = res.data?.boleto;
        const invoiceUrl = boleto?.invoiceUrl || boleto?.bankSlipUrl;
        if (invoiceUrl) setBoletoUrl(invoiceUrl);
        else toast.warning("Compra registrada! Acesse 'Minhas Cobranças' para ver o boleto.");
      } else {
        toast.success("Compra realizada com sucesso! 🎉");
        setCheckoutOpen(false); setCart([]); loadData(partner);
      }
    } catch (e) { toast.error("Erro ao processar compra: " + e.message); }
    finally { setProcessing(false); }
  };

  const handleCloseCheckout = () => {
    if (processing) return;
    setCheckoutOpen(false); setBoletoUrl(null);
    if (boletoUrl) { setCart([]); loadData(partner); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <AnimatedPage>
      <PageHeader
        title="Loja 3X3 SC"
        subtitle="Produtos Digitais"
        action={
          <div className="flex items-center gap-3">
            {partner && (
              <div className="px-4 py-2 rounded-xl bg-zinc-900 border border-white/[0.05]">
                <p className="text-zinc-500 text-xs">Bônus para Trocas</p>
                <p className="text-orange-400 font-bold text-sm">{fmtR(partner.bonus_for_purchases)}</p>
              </div>
            )}
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setCartOpen(true)}
              className="relative flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 transition-colors rounded-xl text-white font-semibold text-sm">
              <ShoppingCart className="w-4 h-4" /> Carrinho
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">{cartCount}</span>
              )}
            </motion.button>
          </div>
        }
      />

      {/* Alerts */}
      <AnimatedItem>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: AlertTriangle, color: "text-yellow-400 bg-yellow-500/5 border-yellow-500/20", text: "Nunca faça compras exageradas. Use nosso sistema de geração de bônus." },
            { icon: CheckCircle, color: "text-green-400 bg-green-500/5 border-green-500/20", text: "Garantia Absoluta! Se não estiver satisfeito, devolvemos seu dinheiro." },
            { icon: Package, color: "text-blue-400 bg-blue-500/5 border-blue-500/20", text: "Coloque seus produtos GRÁTIS em nossa loja. Suporte: (11) 95145-3200" },
          ].map(({ icon: Icon, color, text }, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${color}`}>
              <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-zinc-300 text-xs">{text}</p>
            </div>
          ))}
        </div>
      </AnimatedItem>

      {partner && !partner.first_purchase_done && (
        <AnimatedItem>
          <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 flex items-center gap-3">
            <ShoppingCart className="w-5 h-5 text-orange-400 flex-shrink-0" />
            <p className="text-zinc-300 text-sm"><strong className="text-orange-300">Primeira troca obrigatória:</strong> Para ativar sua conta, faça uma troca mínima de R$ 125,00.</p>
          </div>
        </AnimatedItem>
      )}

      <AnimatedItem>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-zinc-900 border border-white/[0.05] mb-6">
            <TabsTrigger value="products" className="data-[state=active]:bg-orange-500 gap-2"><Package className="w-4 h-4" />Produtos</TabsTrigger>
            <TabsTrigger value="purchases" className="data-[state=active]:bg-orange-500 gap-2"><ShoppingCart className="w-4 h-4" />Minhas Trocas</TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            {products.length === 0 ? <EmptyState icon={Package} message="Nenhum produto disponível no momento." /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map(product => {
                  const inCart = cart.find(i => i.product.id === product.id);
                  return (
                    <motion.div key={product.id} whileHover={{ y: -2 }}
                      className="rounded-2xl bg-zinc-900/60 border border-white/[0.05] hover:border-orange-500/30 transition-all overflow-hidden flex flex-col">
                      {product.image_url ? (
                        <div className="aspect-video overflow-hidden">
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="aspect-video bg-zinc-800 flex items-center justify-center">
                          <Package className="w-12 h-12 text-zinc-600" />
                        </div>
                      )}
                      <div className="p-4 flex flex-col flex-1">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="text-white font-semibold text-sm leading-tight">{product.name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border shrink-0 ${catColors[product.category] || catColors.outros}`}>
                            {categories[product.category] || product.category}
                          </span>
                        </div>
                        <p className="text-zinc-500 text-xs line-clamp-2 flex-1 mb-3">{product.description}</p>
                        <p className="text-orange-400 font-black text-2xl mb-3">{fmtR(product.price)}</p>
                        {product.category === 'tele_consulta' ? (
                          <button disabled className="w-full py-2.5 rounded-xl bg-zinc-800 text-zinc-500 text-sm font-medium cursor-not-allowed">🔒 Em Breve</button>
                        ) : inCart ? (
                          <div className="w-full flex items-center justify-between bg-orange-500/10 border border-orange-500/30 rounded-xl px-3 py-2">
                            <span className="text-orange-400 text-sm font-semibold">No carrinho ({inCart.qty})</span>
                            <button onClick={() => removeFromCart(product.id)} className="text-red-400 hover:text-red-300 transition-colors p-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <motion.button whileTap={{ scale: 0.98 }} onClick={() => addToCart(product)}
                            className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                            <Plus className="w-4 h-4" /> Adicionar
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="purchases">
            {purchases.length === 0 ? <EmptyState icon={ShoppingCart} message="Você ainda não fez nenhuma troca." /> : (
              <motion.div variants={{ show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show" className="space-y-3">
                {purchases.map(p => (
                  <motion.div key={p.id} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                    className="p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.05] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-white font-semibold text-sm">{p.product_name}</h3>
                      <p className="text-zinc-600 text-xs mt-0.5">{new Date(p.created_date).toLocaleDateString('pt-BR')}</p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${p.status === 'paid' ? 'bg-green-500/10 text-green-400 border-green-500/20' : p.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                          {p.status === 'paid' ? 'Pago' : p.status === 'pending' ? 'Pendente' : 'Cancelado'}
                        </span>
                        {p.is_first_purchase && <span className="px-2 py-0.5 rounded-full text-xs font-bold border bg-orange-500/10 text-orange-400 border-orange-500/20">1ª Troca</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-white font-bold">{fmtR(p.amount)}</p>
                        <p className="text-zinc-600 text-xs">{p.paid_with_bonus > 0 && `Bônus: ${fmtR(p.paid_with_bonus)}`}{p.paid_with_boleto > 0 && ` | Boleto: ${fmtR(p.paid_with_boleto)}`}</p>
                      </div>
                      {p.download_available && p.product_id && (
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 rounded-xl gap-1"
                          onClick={async () => {
                            const prods = await base44.entities.Product.filter({ id: p.product_id });
                            if (prods.length > 0 && prods[0].download_url) window.open(prods[0].download_url, '_blank');
                            else toast.error('Link não encontrado');
                          }}>
                          <Download className="w-3 h-3" /> Download
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </TabsContent>
        </Tabs>
      </AnimatedItem>

      {/* Cart Dialog */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-orange-400" />Carrinho ({cartCount})</DialogTitle>
          </DialogHeader>
          {cart.length === 0 ? (
            <div className="text-center py-10">
              <ShoppingCart className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">Seu carrinho está vazio.</p>
              <Button className="mt-4 bg-orange-500 hover:bg-orange-600 rounded-xl" onClick={() => setCartOpen(false)}>Ver Produtos</Button>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {cart.map(({ product, qty }) => (
                  <div key={product.id} className="flex items-center justify-between bg-zinc-900 rounded-xl p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{product.name}</p>
                      <p className="text-orange-400 text-sm font-bold">{fmtR(product.price * qty)}</p>
                    </div>
                    <button onClick={() => removeFromCart(product.id)} className="text-red-400 hover:text-red-300 ml-2 p-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <div className="border-t border-zinc-800 pt-3 flex justify-between items-center">
                <span className="text-zinc-400 text-sm">Total</span>
                <span className="text-white font-bold text-xl">{fmtR(cartTotal)}</span>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" className="border-zinc-700 text-zinc-300 rounded-xl" onClick={() => setCartOpen(false)}>Continuar</Button>
                <Button className="bg-orange-500 hover:bg-orange-600 rounded-xl" onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}>Finalizar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={handleCloseCheckout}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">{boletoUrl ? "✅ Boleto Gerado!" : "Finalizar Compra"}</DialogTitle>
          </DialogHeader>
          {boletoUrl ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-white font-semibold">Compra registrada com sucesso!</p>
              <Button className="w-full bg-green-600 hover:bg-green-700 rounded-xl" onClick={() => window.open(boletoUrl, "_blank")}><FileText className="w-4 h-4 mr-2" />Abrir Boleto</Button>
              <p className="text-zinc-500 text-xs">Também disponível em "Minhas Cobranças"</p>
              <Button variant="outline" className="w-full border-zinc-700 text-zinc-300 rounded-xl" onClick={() => { setCheckoutOpen(false); setBoletoUrl(null); setCart([]); loadData(partner); }}>Fechar</Button>
            </div>
          ) : processing ? (
            <div className="flex flex-col items-center py-12 gap-4">
              <div className="w-12 h-12 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
              <p className="text-white font-medium">Processando sua compra...</p>
              <p className="text-zinc-500 text-sm">Por favor, aguarde. Não feche esta tela.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-40 overflow-y-auto mb-2">
                {cart.map(({ product, qty }) => (
                  <div key={product.id} className="flex justify-between text-sm">
                    <span className="text-zinc-400 truncate">{product.name}</span>
                    <span className="text-white font-medium ml-2 shrink-0">{fmtR(product.price * qty)}</span>
                  </div>
                ))}
                <div className="border-t border-zinc-800 pt-2 flex justify-between font-bold">
                  <span className="text-white">Total</span>
                  <span className="text-orange-400">{fmtR(cartTotal)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Forma de Pagamento</p>
                {[
                  { id: "bonus", icon: CreditCard, label: "Trocar com Bônus", sub: `Disponível: ${fmtR(partner?.bonus_for_purchases || 0)}` },
                  { id: "boleto", icon: FileText, label: "Pagar com Boleto", sub: "Gerar boleto para pagamento" },
                ].map(({ id, icon: Icon, label, sub }) => (
                  <div key={id} onClick={() => setPaymentMethod(id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${paymentMethod === id ? "border-orange-500 bg-orange-500/8" : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${paymentMethod === id ? "text-orange-400" : "text-zinc-500"}`} />
                        <div>
                          <p className="text-white text-sm font-medium">{label}</p>
                          <p className="text-zinc-500 text-xs">{sub}</p>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 transition-all ${paymentMethod === id ? "border-orange-500 bg-orange-500" : "border-zinc-600"}`} />
                    </div>
                    {id === "bonus" && (partner?.bonus_for_purchases || 0) < cartTotal && (
                      <p className="text-yellow-400 text-xs mt-2 pl-7">* A diferença de {fmtR(cartTotal - (partner?.bonus_for_purchases || 0))} será cobrada via boleto</p>
                    )}
                  </div>
                ))}
              </div>
              <DialogFooter className="gap-2 mt-2">
                <Button variant="outline" className="border-zinc-700 text-zinc-300 rounded-xl" onClick={handleCloseCheckout}>Voltar</Button>
                <Button onClick={handleCheckout} className="bg-orange-500 hover:bg-orange-600 rounded-xl gap-2">
                  <ShoppingCart className="w-4 h-4" />Confirmar Compra
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}