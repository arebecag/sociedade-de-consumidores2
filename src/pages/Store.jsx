import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShoppingCart, AlertTriangle, Download, CreditCard, FileText, Package } from "lucide-react";
import { toast } from "sonner";

const categories = {
  tele_consulta: "Tele Consulta",
  curso_online: "Curso Online",
  faculdade_ead: "Faculdade EAD",
  ebook: "E-book",
  software: "Software",
  outros: "Outros"
};

export default function Store() {
  const [partner, setPartner] = useState(null);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("bonus");
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("products");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const partners = await base44.entities.Partner.filter({ created_by: user.email });
      
      if (partners.length > 0) {
        setPartner(partners[0]);
        
        const userPurchases = await base44.entities.Purchase.filter({ partner_id: partners[0].id });
        setPurchases(userPurchases);
      }
      
      const allProducts = await base44.entities.Product.filter({ active: true });
      setProducts(allProducts);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedProduct || !partner) return;
    
    setProcessing(true);
    try {
      const isFirstPurchase = !partner.first_purchase_done;
      const bonusAvailable = partner.bonus_for_purchases || 0;
      const productPrice = selectedProduct.price;
      
      let paidWithBonus = 0;
      let paidWithBoleto = 0;
      let actualPaymentMethod = paymentMethod;

      if (paymentMethod === "bonus") {
        if (bonusAvailable >= productPrice) {
          paidWithBonus = productPrice;
        } else {
          paidWithBonus = bonusAvailable;
          paidWithBoleto = productPrice - bonusAvailable;
          actualPaymentMethod = "misto";
        }
      } else if (paymentMethod === "boleto") {
        paidWithBoleto = productPrice;
      }

      // Create purchase
      const purchase = await base44.entities.Purchase.create({
        partner_id: partner.id,
        partner_name: partner.full_name,
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        amount: productPrice,
        paid_with_bonus: paidWithBonus,
        paid_with_boleto: paidWithBoleto,
        payment_method: actualPaymentMethod,
        status: paidWithBoleto > 0 ? "pending" : "paid",
        is_first_purchase: isFirstPurchase,
        download_available: paidWithBoleto === 0
      });

      // Update partner bonus and status
      const updates = {
        bonus_for_purchases: bonusAvailable - paidWithBonus,
        total_spent_purchases: (partner.total_spent_purchases || 0) + paidWithBonus
      };

      if (isFirstPurchase && productPrice >= 125) {
        updates.first_purchase_done = true;
        updates.pending_reasons = (partner.pending_reasons || []).filter(r => r !== "Falta da primeira compra");
        
        if (updates.pending_reasons.length === 0 || (updates.pending_reasons.length === 1 && updates.pending_reasons[0] === "Falta de informações no cadastro")) {
          // Check if profile is complete
          if (partner.cpf && partner.address?.cep) {
            updates.status = "ativo";
            updates.pending_reasons = [];
          }
        }
      }

      await base44.entities.Partner.update(partner.id, updates);

      // Generate bonus for referrers
      if (paidWithBoleto === 0 || actualPaymentMethod === "misto") {
        await generateBonusForPurchase(purchase.id, productPrice, partner);
      }

      toast.success("Compra realizada com sucesso!");
      setPurchaseDialogOpen(false);
      setSelectedProduct(null);
      loadData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao processar compra");
    } finally {
      setProcessing(false);
    }
  };

  const generateBonusForPurchase = async (purchaseId, amount, buyer) => {
    try {
      // Get referrer (direct)
      if (buyer.referrer_id) {
        const referrers = await base44.entities.Partner.filter({ id: buyer.referrer_id });
        if (referrers.length > 0) {
          const directReferrer = referrers[0];
          
          // Direct bonus (15%)
          const directBonus = amount * 0.15;
          const directBonusWithdrawal = directBonus * 0.5;
          const directBonusPurchases = directBonus * 0.5;

          await base44.entities.BonusTransaction.create({
            partner_id: directReferrer.id,
            partner_name: directReferrer.full_name,
            source_partner_id: buyer.id,
            source_partner_name: buyer.full_name,
            purchase_id: purchaseId,
            type: "direct",
            percentage: 15,
            total_amount: directBonus,
            amount_for_withdrawal: directBonusWithdrawal,
            amount_for_purchases: directBonusPurchases,
            status: directReferrer.status === "ativo" ? "credited" : "blocked"
          });

          if (directReferrer.status === "ativo") {
            await base44.entities.Partner.update(directReferrer.id, {
              total_bonus_generated: (directReferrer.total_bonus_generated || 0) + directBonus,
              bonus_for_withdrawal: (directReferrer.bonus_for_withdrawal || 0) + directBonusWithdrawal,
              bonus_for_purchases: (directReferrer.bonus_for_purchases || 0) + directBonusPurchases
            });
          }

          // Indirect bonus (30% split among indirect referrers)
          if (directReferrer.referrer_id) {
            const indirectReferrers = await base44.entities.Partner.filter({ id: directReferrer.referrer_id });
            if (indirectReferrers.length > 0) {
              const indirectReferrer = indirectReferrers[0];
              const indirectBonus = amount * 0.30;
              const indirectBonusWithdrawal = indirectBonus * 0.5;
              const indirectBonusPurchases = indirectBonus * 0.5;

              await base44.entities.BonusTransaction.create({
                partner_id: indirectReferrer.id,
                partner_name: indirectReferrer.full_name,
                source_partner_id: buyer.id,
                source_partner_name: buyer.full_name,
                purchase_id: purchaseId,
                type: "indirect",
                percentage: 30,
                total_amount: indirectBonus,
                amount_for_withdrawal: indirectBonusWithdrawal,
                amount_for_purchases: indirectBonusPurchases,
                status: indirectReferrer.status === "ativo" ? "credited" : "blocked"
              });

              if (indirectReferrer.status === "ativo") {
                await base44.entities.Partner.update(indirectReferrer.id, {
                  total_bonus_generated: (indirectReferrer.total_bonus_generated || 0) + indirectBonus,
                  bonus_for_withdrawal: (indirectReferrer.bonus_for_withdrawal || 0) + indirectBonusWithdrawal,
                  bonus_for_purchases: (indirectReferrer.bonus_for_purchases || 0) + indirectBonusPurchases
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error generating bonus:", error);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
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
        
        {partner && (
          <div className="flex gap-4">
            <Card className="bg-zinc-950 border-orange-500/20 px-4 py-2">
              <p className="text-gray-400 text-xs">Bônus para Compras</p>
              <p className="text-orange-500 font-bold">{formatCurrency(partner.bonus_for_purchases)}</p>
            </Card>
          </div>
        )}
      </div>

      {/* Warning Alert */}
      <Alert className="bg-yellow-500/10 border-yellow-500/30">
        <AlertTriangle className="w-4 h-4 text-yellow-500" />
        <AlertDescription className="text-yellow-200">
          <strong>ATENÇÃO:</strong> Nunca faça compras exageradas em nossa plataforma, use nosso sistema de geração de bônus.
        </AlertDescription>
      </Alert>

      {/* First Purchase Alert */}
      {partner && !partner.first_purchase_done && (
        <Alert className="bg-orange-500/10 border-orange-500/30">
          <ShoppingCart className="w-4 h-4 text-orange-500" />
          <AlertDescription className="text-orange-200">
            <strong>Primeira compra obrigatória:</strong> Para ativar sua conta, faça uma compra mínima de R$ 125,00.
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
            Minhas Compras
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
              {products.map((product) => (
                <Card key={product.id} className="bg-zinc-950 border-orange-500/20 hover:border-orange-500/50 transition-colors overflow-hidden">
                  {product.image_url && (
                    <div className="aspect-video bg-zinc-900">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-white">{product.name}</CardTitle>
                      <Badge className="bg-orange-500/20 text-orange-500">
                        {categories[product.category] || product.category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-400 text-sm line-clamp-2">{product.description}</p>
                    <p className="text-2xl font-bold text-orange-500 mt-4">
                      {formatCurrency(product.price)}
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button
                      onClick={() => {
                        setSelectedProduct(product);
                        setPurchaseDialogOpen(true);
                      }}
                      className="w-full bg-orange-500 hover:bg-orange-600"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Comprar
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="purchases" className="mt-6">
          {purchases.length === 0 ? (
            <Card className="bg-zinc-950 border-orange-500/20">
              <CardContent className="p-12 text-center">
                <ShoppingCart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Você ainda não fez nenhuma compra.</p>
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
                        <p className="text-gray-400 text-sm">
                          {new Date(purchase.created_date).toLocaleDateString('pt-BR')}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <Badge className={
                            purchase.status === 'paid' ? 'bg-green-500/20 text-green-500' :
                            purchase.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                            'bg-red-500/20 text-red-500'
                          }>
                            {purchase.status === 'paid' ? 'Pago' : purchase.status === 'pending' ? 'Pendente' : 'Cancelado'}
                          </Badge>
                          {purchase.is_first_purchase && (
                            <Badge className="bg-orange-500/20 text-orange-500">
                              1ª Compra
                            </Badge>
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
                        {purchase.download_available && (
                          <Button size="sm" className="bg-green-600 hover:bg-green-700">
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

      {/* Purchase Dialog */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent className="bg-zinc-950 border-orange-500/20">
          <DialogHeader>
            <DialogTitle className="text-white">Finalizar Compra</DialogTitle>
          </DialogHeader>
          
          {selectedProduct && (
            <div className="space-y-6">
              <div className="p-4 bg-zinc-900 rounded-lg">
                <h3 className="text-white font-semibold">{selectedProduct.name}</h3>
                <p className="text-2xl font-bold text-orange-500 mt-2">
                  {formatCurrency(selectedProduct.price)}
                </p>
              </div>

              <div className="space-y-4">
                <Label className="text-white">Forma de Pagamento</Label>
                
                <div className="space-y-2">
                  <div
                    onClick={() => setPaymentMethod("bonus")}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      paymentMethod === "bonus" 
                        ? "border-orange-500 bg-orange-500/10" 
                        : "border-zinc-700 bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CreditCard className={paymentMethod === "bonus" ? "text-orange-500" : "text-gray-400"} />
                        <div>
                          <p className="text-white font-medium">Pagar com Bônus</p>
                          <p className="text-gray-400 text-sm">
                            Disponível: {formatCurrency(partner?.bonus_for_purchases || 0)}
                          </p>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        paymentMethod === "bonus" ? "border-orange-500 bg-orange-500" : "border-zinc-600"
                      }`} />
                    </div>
                    {(partner?.bonus_for_purchases || 0) < selectedProduct.price && (
                      <p className="text-yellow-500 text-xs mt-2">
                        * A diferença de {formatCurrency(selectedProduct.price - (partner?.bonus_for_purchases || 0))} será cobrada via boleto
                      </p>
                    )}
                  </div>

                  <div
                    onClick={() => setPaymentMethod("boleto")}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      paymentMethod === "boleto" 
                        ? "border-orange-500 bg-orange-500/10" 
                        : "border-zinc-700 bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className={paymentMethod === "boleto" ? "text-orange-500" : "text-gray-400"} />
                        <div>
                          <p className="text-white font-medium">Pagar com Boleto</p>
                          <p className="text-gray-400 text-sm">Gerar boleto para pagamento</p>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        paymentMethod === "boleto" ? "border-orange-500 bg-orange-500" : "border-zinc-600"
                      }`} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handlePurchase}
              disabled={processing}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ShoppingCart className="w-4 h-4 mr-2" />
              )}
              {processing ? "Processando..." : "Confirmar Compra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}