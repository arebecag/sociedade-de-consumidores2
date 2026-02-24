import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "./utils";
import { base44 } from "@/api/base44Client";
import FinanceiroGuard from "@/components/FinanceiroGuard";
import {
  LayoutDashboard,
  User,
  ShoppingBag,
  Users,
  FileText,
  Receipt,
  LogOut,
  Menu,
  X,
  Award,
  Globe,
  CreditCard,
  HelpCircle,
  Megaphone,
  GraduationCap,
  DollarSign,
  ArrowDownCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [partner, setPartner] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadUserData();
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const publicPages = ["LandingPage", "Register", "PartnerSite", "LojaCursos", "FAQ"];
    if (publicPages.includes(currentPageName)) {
      return;
    }
    
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        base44.auth.redirectToLogin(createPageUrl("Dashboard"));
      }
    } catch (error) {
      console.error("Auth check error:", error);
    }
  };

  const createNetworkRelations = async (newPartnerId, newPartnerName, referrerId, referrerName) => {
    try {
      await base44.entities.NetworkRelation.create({
        referrer_id: referrerId,
        referrer_name: referrerName,
        referred_id: newPartnerId,
        referred_name: newPartnerName,
        relation_type: "direct",
        is_spillover: false,
        level: 1
      });
      console.log("[Partner] Relação direta criada com sucesso");
    } catch (e) {
      console.error("[Partner] Erro ao criar relação direta:", e);
    }

    try {
      const referrerRelations = await base44.entities.NetworkRelation.filter({
        referred_id: referrerId,
        relation_type: "direct"
      });
      if (referrerRelations.length > 0) {
        await base44.entities.NetworkRelation.create({
          referrer_id: referrerRelations[0].referrer_id,
          referrer_name: referrerRelations[0].referrer_name,
          referred_id: newPartnerId,
          referred_name: newPartnerName,
          relation_type: "indirect",
          is_spillover: false,
          level: 2
        });
        console.log("[Partner] Relação indireta criada com sucesso");
      }
    } catch (e) {
      console.error("[Partner] Erro ao criar relação indireta:", e);
    }
  };

  const loadUserData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      // Verificar Partner existente primeiro
      let existingPartners = [];
      try {
        existingPartners = await base44.entities.Partner.filter({ created_by: userData.email });
      } catch (e) {
        console.error("[Partner] Erro ao buscar partner existente:", e);
      }

      // Limpar qualquer pendingPartnerData residual (a criação agora é feita no Register)
      const pendingData = localStorage.getItem("pendingPartnerData");
      if (pendingData) {
        localStorage.removeItem("pendingPartnerData");
        console.log("[Layout] pendingPartnerData residual removido");
      }

      // Self-healing: se não tem Partner mas tem dados no localStorage de sessão anterior
      if (existingPartners.length > 0) {
        setPartner(existingPartners[0]);
      } else {
        console.warn("[Partner] Usuário logado sem Partner:", userData.email);
      }
    } catch (error) {
      // User not logged in — silencioso
    }
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  // Public pages without layout
  const publicPages = ["LandingPage", "Register", "PartnerSite"];
  if (publicPages.includes(currentPageName)) {
    return <>{children}</>;
  }

  const menuItems = [
    { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
    { name: "Meu Site", icon: Globe, page: "MySite" },
    { name: "Meu Perfil", icon: User, page: "Profile" },
    { name: "Loja 3x3", icon: ShoppingBag, page: "Store" },
    { name: "Pagar Boletos", icon: Receipt, page: "PayBoletos" },
    { name: "Meus Clientes", icon: Users, page: "Network" },
    { name: "Meus Bônus", icon: Award, page: "Bonus" },
    { name: "Marketing", icon: Megaphone, page: "Marketing" },
    { name: "Cursos EAD", icon: GraduationCap, page: "LojaCursos" },
    { name: "Meus Cursos", icon: GraduationCap, page: "MeusCursos" },
    { name: "Relatórios", icon: FileText, page: "Reports" },
    { name: "Receita Federal", icon: FileText, page: "IncomeReport" },
    { name: "Dúvidas", icon: HelpCircle, page: "FAQ" },
    { name: "Pagamento TED", icon: CreditCard, page: "PagamentoTed" },
    { name: "Minhas Cobranças", icon: FileText, page: "MinhasCobranças" },
    { name: "Área Financeira", icon: DollarSign, page: "MinhaAreaFinanceira" },
    { name: "Extrato", icon: FileText, page: "Extrato" },
  ];

  // Admin-only menu items
  if (user?.role === 'admin') {
    menuItems.push({ name: "Admin: Auditoria", icon: Users, page: "AdminNetwork" });
    menuItems.push({ name: "Admin: EAD", icon: GraduationCap, page: "AdminCursosEAD" });
    menuItems.push({ name: "Admin: Contrato", icon: FileText, page: "AdminContrato" });
    menuItems.push({ name: "Admin: Pagamentos", icon: CreditCard, page: "AdminPagamentos" });
    menuItems.push({ name: "Admin: Cobranças Cora", icon: Receipt, page: "AdminCora" });
    menuItems.push({ name: "Admin: TED", icon: CreditCard, page: "AdminPagamentosTed" });
    menuItems.push({ name: "Admin: Financeiro", icon: DollarSign, page: "AdminFinanceiro" });
    menuItems.push({ name: "Admin: Saques", icon: ArrowDownCircle, page: "AdminSaques" });
  }

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-orange-500/20">
        <h1 className="text-xl font-bold text-orange-500">Sociedade de</h1>
        <h1 className="text-xl font-bold text-white">Consumidores</h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <Link
            key={item.page}
            to={createPageUrl(item.page)}
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              currentPageName === item.page
                ? "bg-orange-500 text-white"
                : "text-gray-300 hover:bg-orange-500/10 hover:text-orange-500"
            }`}
          >
            <item.icon className="w-5 h-5 flex-shrink-0 min-w-[20px]" />
            <span className="font-semibold text-base">{item.name}</span>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-orange-500/20">
        {partner && (
          <div className="mb-4 p-3 bg-orange-500/10 rounded-lg">
            <p className="text-sm text-gray-400">Status</p>
            <p className={`font-semibold ${
              partner.status === 'ativo' ? 'text-green-500' :
              partner.status === 'pendente' ? 'text-yellow-500' : 'text-red-500'
            }`}>
              {partner.status?.toUpperCase()}
            </p>
          </div>
        )}
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start text-gray-400 hover:text-orange-500 hover:bg-orange-500/10"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Sair
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col bg-zinc-950 border-r border-orange-500/20">
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-zinc-950 border-b border-orange-500/20">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-lg font-bold text-orange-500">Sociedade de</h1>
            <h1 className="text-sm font-bold text-white">Consumidores</h1>
          </div>
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-orange-500">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-zinc-950 border-orange-500/20">
              <NavContent />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
          <main className="lg:pl-64 pt-20 lg:pt-0 min-h-screen">
            <div className="p-4 lg:p-8">
              <FinanceiroGuard currentPageName={currentPageName}>
                {children}
              </FinanceiroGuard>
            </div>
          </main>
    </div>
  );
}