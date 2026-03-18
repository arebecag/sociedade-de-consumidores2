import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "./utils";
import { base44 } from "@/api/base44Client";
import { useAuthCustom } from "@/components/AuthContextCustom";
import { AuthProviderCustom } from "@/components/AuthContextCustom";
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
  ArrowDownCircle,
  Trophy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

function LayoutContent({ children, currentPageName }) {
  const { user: authUser, partner: authPartner, logout: authLogout, isAuthenticated } = useAuthCustom();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const publicPages = ["LandingPage", "Register", "PartnerSite", "VerifyEmail", "RegisterCustom", "ForgotPassword"];

  useEffect(() => {
    checkAuth();
  }, [currentPageName, isAuthenticated]);

  const checkAuth = () => {
    if (publicPages.includes(currentPageName)) {
      return;
    }
    
    if (!isAuthenticated()) {
      navigate(createPageUrl("Register"));
    }
  };

  const handleLogout = async () => {
    try {
      await authLogout();
      navigate(createPageUrl("Register"));
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      navigate(createPageUrl("Register"));
    }
  };

  // Public pages without layout
  if (publicPages.includes(currentPageName)) {
    return <>{children}</>;
  }

  const menuItems = [
    { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
    { name: "🏆 Desafio 12+12+12", icon: Trophy, page: "CampanhaDesafio" },
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

    { name: "Minhas Cobranças", icon: FileText, page: "MinhasCobranças" },
    { name: "Área Financeira", icon: DollarSign, page: "MinhaAreaFinanceira" },
    { name: "Extrato", icon: FileText, page: "Extrato" },
  ];

  // Admin-only menu items
  if (authUser?.role === 'admin') {
    menuItems.push({ name: "Admin: Campanhas", icon: Trophy, page: "AdminCampanhas" });
    menuItems.push({ name: "Admin: Auditoria", icon: Users, page: "AdminNetwork" });
    menuItems.push({ name: "Admin: EAD", icon: GraduationCap, page: "AdminCursosEAD" });
    menuItems.push({ name: "Admin: Contrato", icon: FileText, page: "AdminContrato" });
    menuItems.push({ name: "Admin: Pagamentos", icon: CreditCard, page: "AdminPagamentos" });
    menuItems.push({ name: "Admin: TED", icon: CreditCard, page: "AdminPagamentosTed" });
    menuItems.push({ name: "Admin: Financeiro", icon: DollarSign, page: "AdminFinanceiro" });
    menuItems.push({ name: "Admin: Saques", icon: ArrowDownCircle, page: "AdminSaques" });
    menuItems.push({ name: "Admin: Cadastrados", icon: Users, page: "AdminCadastrados" });
    menuItems.push({ name: "Admin: Notas Fiscais", icon: FileText, page: "AdminNotasFiscais" });
    menuItems.push({ name: "Admin: Bling", icon: Globe, page: "AdminBling" });
  }

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center font-black text-white text-base flex-shrink-0">3</div>
          <div>
            <p className="text-white font-black text-sm leading-none">Sociedade de</p>
            <p className="text-orange-500 font-black text-sm leading-none">Consumidores</p>
          </div>
        </div>
      </div>

      {/* User card */}
      {authPartner && (
        <div className="mx-3 mt-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-orange-400 text-sm font-bold">
                {(authPartner.display_name || authPartner.full_name || "?")[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{authPartner.display_name || authPartner.full_name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  authPartner.status === 'ativo' ? 'bg-green-500' :
                  authPartner.status === 'pendente' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <span className={`text-xs font-semibold ${
                  authPartner.status === 'ativo' ? 'text-green-400' :
                  authPartner.status === 'pendente' ? 'text-yellow-400' : 'text-red-400'
                }`}>{authPartner.status?.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto mt-1">
        {menuItems.map((item) => (
          <Link
            key={item.page}
            to={createPageUrl(item.page)}
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
              currentPageName === item.page
                ? "bg-orange-500 text-white"
                : "text-gray-400 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium text-sm">{item.name}</span>
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-zinc-800">
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start text-gray-500 hover:text-white hover:bg-zinc-800 rounded-xl px-3 h-10"
        >
          <LogOut className="w-4 h-4 mr-3" />
          <span className="text-sm font-medium">Sair</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col bg-zinc-950 border-r border-zinc-800">
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-zinc-950 border-b border-zinc-800">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center font-black text-white text-sm">3</div>
            <div>
              <p className="text-white font-black text-sm leading-none">Sociedade de <span className="text-orange-500">Consumidores</span></p>
            </div>
          </div>
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-zinc-950 border-zinc-800">
              <NavContent />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="lg:pl-64 pt-14 lg:pt-0 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8">
          <FinanceiroGuard currentPageName={currentPageName}>
            {children}
          </FinanceiroGuard>
        </div>
      </main>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <AuthProviderCustom>
      <LayoutContent children={children} currentPageName={currentPageName} />
    </AuthProviderCustom>
  );
}