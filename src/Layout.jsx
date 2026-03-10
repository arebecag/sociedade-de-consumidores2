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
  ArrowDownCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

function LayoutContent({ children, currentPageName }) {
  const { user: authUser, partner: authPartner, logout: authLogout, isAuthenticated } = useAuthCustom();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const publicPages = ["LandingPage", "Register", "PartnerSite", "VerifyEmail", "RegisterCustom"];

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
    }
  };

  // Public pages without layout
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
    menuItems.push({ name: "Admin: TED", icon: CreditCard, page: "AdminPagamentosTed" });
    menuItems.push({ name: "Admin: Financeiro", icon: DollarSign, page: "AdminFinanceiro" });
    menuItems.push({ name: "Admin: Saques", icon: ArrowDownCircle, page: "AdminSaques" });
    menuItems.push({ name: "Admin: Cadastrados", icon: Users, page: "AdminCadastrados" });
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
        {authPartner && (
          <div className="mb-4 p-3 bg-orange-500/10 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Conta</p>
            <p className="text-white text-sm font-medium truncate">{authPartner.display_name || authPartner.full_name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                authPartner.status === 'ativo' ? 'bg-green-500' :
                authPartner.status === 'pendente' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <p className={`text-sm font-semibold ${
                authPartner.status === 'ativo' ? 'text-green-500' :
                authPartner.status === 'pendente' ? 'text-yellow-500' : 'text-red-500'
              }`}>
                {authPartner.status?.toUpperCase()}
              </p>
            </div>
            {authPartner.status === 'pendente' && authPartner.pending_reasons?.length > 0 && (
              <p className="text-yellow-600 text-xs mt-1 leading-tight">
                {authPartner.pending_reasons[0]}
              </p>
            )}
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

export default function Layout({ children, currentPageName }) {
  return (
    <AuthProviderCustom>
      <LayoutContent children={children} currentPageName={currentPageName} />
    </AuthProviderCustom>
  );
}