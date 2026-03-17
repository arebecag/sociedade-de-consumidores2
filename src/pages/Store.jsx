import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { usePartner } from "@/components/usePartner";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ShoppingCart, AlertTriangle, Download, CreditCard, FileText, Package, CheckCircle, Plus, Minus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

const categories = {
  tele_consulta: "Tele Consulta",
  curso_online: "Curso Online",
  ebook: "E-book",
  software: "Software",
  outros: "Outros"
};

export default function Store() {
  const { partner, loading: partnerLoading } = usePartner();
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]); // [{product, qty}]
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
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { product, qty: 1 }];
    });
    toast.success(`${product.name} adicionado ao carrinho!`);
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  const handleCheckout = async () => {
    if (!partner || cart.length === 0) return;

    setProcessing(true);
    setBoletoUrl(null);
    try {
      const isFirstPurchase = !partner.first_purchase_done;
      const bonusAvailable = partner.bonus_for_purchases || 0;

      let paidWithBonus = 0;
      let paidWithBoleto = 0;
      let actualPaymentMethod = paymentMethod;

      if (paymentMethod === "bonus") {
        if (bonusAvailable >= cartTotal) {
          paidWithBonus = cartTotal;
        } else {
          paidWithBonus = bonusAvailable;
          paidWithBoleto = cartTotal - bonusAvailable;
          actualPaymentMethod = "misto";
        }
      } else {
        paidWithBoleto = cartTotal;
      }

      // Create purchases for each item in cart
      const createdPurchases = [];
      for (const item of cart) {
        const itemTotal = item.product.price * item.qty;
        const itemBonusRatio = cartTotal > 0 ? itemTotal / cartTotal : 0;
        const itemBonus = Math.round(paidWithBonus * itemBonusRatio * 100) / 100;
        const itemBoleto = itemTotal - itemBonus;

        const purchase = await base44.entities.Purchase.create({
          partner_id: partner.id,
          partner_name: partner.full_name,
          product_id: item.product.id,
          product_name: item.product.name,
          amount: itemTotal,
          paid_with_bonus: itemBonus,
          paid_with_boleto: itemBoleto,
          payment_method: actualPaymentMethod,
          status: paidWithBoleto > 0 ? "pending" : "paid",
          is_first_purchase: isFirstPurchase && createdPurchases.length === 0,
          download_available: paidWithBoleto === 0
        });
        createdPurchases.push(purchase);
      }

      // Update partner bonus
      const updates = {
        bonus_for_purchases: bonusAvailable - paidWithBonus,
        total_spent_purchases: (partner.total_spent_purchases || 0) + paidWithBonus
      };

      if (paidWithBoleto === 0 && isFirstPurchase && cartTotal >= 125) {
        updates.first_purchase_done = true;
        updates.pending_reasons = (partner.pending_reasons || []).filter(r => r !== "Falta da primeira compra");
        if (partner.cpf && partner.address?.cep) {
          updates.status = "ativo";
          updates.pending_reasons = [];
        }
      }

      await base44.entities.Partner.update(partner.id, updates);

      // Distribuir comissões se pagou com bônus
      if (paidWithBoleto === 0) {
        for (const p of createdPurchases) {
          await distribuirComissoes(p.id, p.amount, partner);
        }
      }

      // Gerar boleto se necessário
      if (paidWithBoleto > 0) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 3);
        const dueDateStr = dueDate.toISOString().split("T")[0];

        const productNames = cart.map(i => i.product.name).join(", ");
        const boletoResp = await base44.functions.invoke('gerarBoletoParaUsuario', {
          userId: partner.id,
          valor: paidWithBoleto,
          descricao: `Compra: ${productNames}`,
          dataVencimento: dueDateStr
        });

        const boleto = boletoResp.data?.boleto;
        const invoiceUrl = boleto?.invoiceUrl || boleto?.bankSlipUrl;

        if (invoiceUrl) {
          setBoletoUrl(invoiceUrl);
        } else {
          toast.warning("Compra registrada! Acesse 'Minhas Cobranças' para ver o boleto.");
        }
      } else {
        toast.success("Compra realizada com sucesso! 🎉");
        setCheckoutOpen(false);
        setCart([]);
        loadData(partner);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao processar compra: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const distribuirComissoes = async (purchaseId, amount, buyer) => {
    try {
      await base44.functions.invoke('distribuirComissoes', {
        purchaseId,
        amount,
        buyerPartnerId: buyer.id
      });
    } catch (error) {
      console.error("Erro ao distribuir comissões:", error);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const handleCloseCheckout = () => {
    if (!processing) {
      setCheckoutOpen(false);
      setBoletoUrl(null);
      if (boletoUrl) {
        setCart([]);
        loadData(partner);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Loja 3X3 SC</h1>
          <p className="text-gray-400">Produtos Digitais</p>
        </div>

        <div className="flex gap-3 items-center">
          {partner && (
            <Card className="bg-zinc-950 border-orange-500/20 px-4 py-2">
              <p className="text-gray-400 text-xs">Bônus para Trocas</p>
              <p className="text-orange-500 font-bold">{formatCurrency(partner.bonus_for_purchases)}</p>
            </Card>
          )}

          {/* Botão do Carrinho */}
          <Button
            onClick={() => setCartOpen(true)}
            className="relative bg-orange-500 hover:bg-orange-600"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            Carrinho
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Alertas */}
      <Alert className="bg-yellow-500/10 border-yellow-500/30">
        <AlertTriangle className="w-4 h-4 text-yellow-500" />
        <AlertDescription className="text-yellow-200">
          <strong>ATENÇÃO:</strong> Nunca faça compras exageradas em nossa plataforma, use nosso sistema de geração de bônus.
        </AlertDescription>
      </Alert>

      <Alert className="bg-green-500/10 border-green-500/30">
        <CheckCircle className="w-4 h-4 text-green-500" />
        <AlertDescription className="text-green-200">
          <strong>GARANTIA ABSOLUTA!</strong> Se não estiver satisfeito, devolvemos o seu dinheiro sem perguntas.
        </AlertDescription>
      </Alert>

      <Alert className="bg-blue-500/10 border-blue-500/30">
        <Package className="w-4 h-4 text-blue-400" />
        <AlertDescription className="text-blue-200">
          <div className="space-y-2">
            <p className="font-bold text-blue-100">GANHE MAIS!</p>
            <p className="text-sm">Você tem produtos físicos, digitais ou serviços para vender?</p>
            <p className="font-semibold">Coloque GRÁTIS seus produtos à venda em nossa loja.</p>
            <p className="text-sm mt-2">
              📞 Consulte o SUPORTE: <a href="https://wa.me/5511951453200" target="_blank" className="text-blue-300 hover:text-blue-200 underline font-semibold">(11) 95145-3200</a>
            </p>
          </div>
        </AlertDescription>
      </Alert>

      {partner && !partner.first_purchase_done && (
        <Alert className="bg-orange-500/10 border-orange-500/30">
          <ShoppingCart className="w-4 h-4 text-orange-500" />
          <AlertDescription className="text-orange-200">
            <strong>Primeira troca obrigatória:</strong> Para ativar sua conta, faça uma troca mínima de R$ 125,00.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-900 border border-orange-500/20">
          <TabsTrigger value="products" className="data-[state=active]:bg-orange-500">
            <Package className="w-4 h-4 mr-2" />
            Produtos
          </TabsTrigger>
          <TabsTrigger value="purchases" className="data-[state=active]:bg-orange-500">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Minhas Trocas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-6">
          {products.length === 0 ? (
            <Card className="bg-zinc-950 border-orange-500/20">
              <CardContent className="p-12 text-center">
                <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Nenhum produto disponível no momento.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => {
                const inCart = cart.find(i => i.product.id === product.id);
                return (
                  <Card key={product.id} className="bg-zinc-950 border-orange-500/20 hover:border-orange-500/50 transition-colors overflow-hidden flex flex-col">
                    {product.image_url && (
                      <div className="aspect-video bg-zinc-900">
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-white text-base">{product.name}</CardTitle>
                        <Badge className="bg-orange-500/20 text-orange-500 shrink-0">
                          {categories[product.category] || product.category}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <p className="text-gray-400 text-sm line-clamp-2">{product.description}</p>
                      <p className="text-2xl font-bold text-orange-500 mt-4">{formatCurrency(product.price)}</p>
                    </CardContent>
                    <CardFooter>
                      {inCart ? (
                        <div className="w-full flex items-center justify-between bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-2">
                          <span className="text-orange-400 text-sm font-medium">No carrinho ({inCart.qty})</span>
                          <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 h-7 px-2" onClick={() => removeFromCart(product.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button onClick={() => addToCart(product)} className="w-full bg-orange-500 hover:bg-orange-600">
                          <Plus className="w-4 h-4 mr-2" />
                          Adicionar ao Carrinho
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="purchases" className="mt-6">
          {purchases.length === 0 ? (
            <Card className="bg-zinc-950 border-orange-500/20">
              <CardContent className="p-12 text-center">
                <ShoppingCart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Você ainda não fez nenhuma troca.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {purchases.map((purchase) => (
                <Card key={purchase.id} className="bg-zinc-950 border-orange-500/20">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <h3 className="text-white font-semibold">{purchase.product_name}</h3>
                        <p className="text-gray-400 text-sm">{new Date(purchase.created_date).toLocaleDateString('pt-BR')}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge className={
                            purchase.status === 'paid' ? 'bg-green-500/20 text-green-500' :
                            purchase.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                            'bg-red-500/20 text-red-500'
                          }>
                            {purchase.status === 'paid' ? 'Pago' : purchase.status === 'pending' ? 'Pendente' : 'Cancelado'}
                          </Badge>
                          {purchase.is_first_purchase && (
                            <Badge className="bg-orange-500/20 text-orange-500">1ª Troca</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-white font-bold">{formatCurrency(purchase.amount)}</p>
                          <p className="text-gray-400 text-xs">
                            {purchase.paid_with_bonus > 0 && `Bônus: ${formatCurrency(purchase.paid_with_bonus)}`}
                            {purchase.paid_with_boleto > 0 && ` | Boleto: ${formatCurrency(purchase.paid_with_boleto)}`}
                          </p>
                        </div>
                        {purchase.download_available && purchase.product_id && (
                          <Button size="sm" className="bg-green-600 hover:bg-green-700"
                            onClick={async () => {
                              const prods = await base44.entities.Product.filter({ id: purchase.product_id });
                              if (prods.length > 0 && prods[0].download_url) {
                                window.open(prods[0].download_url, '_blank');
                              } else {
                                toast.error('Link de download não encontrado');
                              }
                            }}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: Carrinho */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="bg-zinc-950 border-orange-500/20 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-orange-500" />
              Carrinho ({cartCount} {cartCount === 1 ? 'item' : 'itens'})
            </DialogTitle>
          </DialogHeader>

          {cart.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Seu carrinho está vazio.</p>
              <Button className="mt-4 bg-orange-500 hover:bg-orange-600" onClick={() => setCartOpen(false)}>
                Ver Produtos
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {cart.map(({ product, qty }) => (
                  <div key={product.id} className="flex items-center justify-between bg-zinc-900 rounded-lg p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{product.name}</p>
                      <p className="text-orange-500 text-sm font-bold">{formatCurrency(product.price * qty)}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 ml-2" onClick={() => removeFromCart(product.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="border-t border-zinc-800 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total</span>
                  <span className="text-white font-bold text-xl">{formatCurrency(cartTotal)}</span>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setCartOpen(false)}>
                  Continuar Comprando
                </Button>
                <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}>
                  Finalizar Compra
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Checkout */}
      <Dialog open={checkoutOpen} onOpenChange={handleCloseCheckout}>
        <DialogContent className="bg-zinc-950 border-orange-500/20 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">
              {boletoUrl ? "✅ Boleto Gerado!" : "Finalizar Compra"}
            </DialogTitle>
          </DialogHeader>

          {/* Estado: Boleto gerado com sucesso */}
          {boletoUrl ? (
            <div className="space-y-4 text-center py-4">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <p className="text-white font-semibold">Compra registrada com sucesso!</p>
              <p className="text-gray-400 text-sm">Seu boleto foi gerado. Clique abaixo para abrir e pagar.</p>
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={() => window.open(boletoUrl, "_blank")}>
                <FileText className="w-4 h-4 mr-2" />
                Abrir Boleto para Pagamento
              </Button>
              <p className="text-gray-500 text-xs">Você também pode acessar o boleto em "Minhas Cobranças"</p>
              <Button variant="outline" className="w-full" onClick={() => { setCheckoutOpen(false); setBoletoUrl(null); setCart([]); loadData(partner); }}>
                Fechar
              </Button>
            </div>
          ) : (
            <>
              {/* Estado: Processando */}
              {processing ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
                  <p className="text-white font-medium">Processando sua compra...</p>
                  <p className="text-gray-400 text-sm">Por favor, aguarde. Não feche esta tela.</p>
                </div>
              ) : (
                <>
                  {/* Resumo do carrinho */}
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {cart.map(({ product, qty }) => (
                      <div key={product.id} className="flex justify-between text-sm">
                        <span className="text-gray-300 truncate">{product.name}</span>
                        <span className="text-white font-medium ml-2 shrink-0">{formatCurrency(product.price * qty)}</span>
                      </div>
                    ))}
                    <div className="border-t border-zinc-800 pt-2 flex justify-between font-bold">
                      <span className="text-white">Total</span>
                      <span className="text-orange-500">{formatCurrency(cartTotal)}</span>
                    </div>
                  </div>

                  {/* Forma de pagamento */}
                  <div className="space-y-2 mt-2">
                    <p className="text-white text-sm font-medium">Forma de Pagamento</p>

                    <div onClick={() => setPaymentMethod("bonus")}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${paymentMethod === "bonus" ? "border-orange-500 bg-orange-500/10" : "border-zinc-700 bg-zinc-900"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CreditCard className={paymentMethod === "bonus" ? "text-orange-500" : "text-gray-400"} />
                          <div>
                            <p className="text-white font-medium text-sm">Trocar com Bônus</p>
                            <p className="text-gray-400 text-xs">Disponível: {formatCurrency(partner?.bonus_for_purchases || 0)}</p>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 ${paymentMethod === "bonus" ? "border-orange-500 bg-orange-500" : "border-zinc-600"}`} />
                      </div>
                      {(partner?.bonus_for_purchases || 0) < cartTotal && (
                        <p className="text-yellow-500 text-xs mt-2">
                          * A diferença de {formatCurrency(cartTotal - (partner?.bonus_for_purchases || 0))} será cobrada via boleto
                        </p>
                      )}
                    </div>

                    <div onClick={() => setPaymentMethod("boleto")}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${paymentMethod === "boleto" ? "border-orange-500 bg-orange-500/10" : "border-zinc-700 bg-zinc-900"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className={paymentMethod === "boleto" ? "text-orange-500" : "text-gray-400"} />
                          <div>
                            <p className="text-white font-medium text-sm">Pagar com Boleto</p>
                            <p className="text-gray-400 text-xs">Gerar boleto para pagamento</p>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 ${paymentMethod === "boleto" ? "border-orange-500 bg-orange-500" : "border-zinc-600"}`} />
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={handleCloseCheckout}>
                      Voltar ao Carrinho
                    </Button>
                    <Button onClick={handleCheckout} className="bg-orange-500 hover:bg-orange-600">
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Confirmar Compra
                    </Button>
                  </DialogFooter>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}