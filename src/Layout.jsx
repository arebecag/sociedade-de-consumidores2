import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "./utils";
import { base44 } from "@/api/base44Client";
import { useAuthCustom } from "@/components/AuthContextCustom";
import { AuthProviderCustom } from "@/components/AuthContextCustom";
import FinanceiroGuard from "@/components/FinanceiroGuard";
import {
  LayoutDashboard, User, ShoppingBag, Users, FileText, Receipt,
  LogOut, Menu, Award, Globe, CreditCard, HelpCircle, Megaphone,
  GraduationCap, DollarSign, ArrowDownCircle, Trophy, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const menuItems = [
  { name: "Dashboard",        icon: LayoutDashboard, page: "Dashboard" },
  { name: "Desafio 12+12+12", icon: Trophy,          page: "CampanhaDesafio" },
  { name: "Meu Site",         icon: Globe,           page: "MySite" },
  { name: "Meu Perfil",       icon: User,            page: "Profile" },
  { name: "Loja 3x3",         icon: ShoppingBag,     page: "Store" },
  { name: "Pagar Boletos",    icon: Receipt,         page: "PayBoletos" },
  { name: "Meus Clientes",    icon: Users,           page: "Network" },
  { name: "Meus Bônus",       icon: Award,           page: "Bonus" },
  { name: "Marketing",        icon: Megaphone,       page: "Marketing" },
  { name: "Cursos EAD",       icon: GraduationCap,   page: "LojaCursos" },
  { name: "Meus Cursos",      icon: GraduationCap,   page: "MeusCursos" },
  { name: "Relatórios",       icon: FileText,        page: "Reports" },
  { name: "Receita Federal",  icon: FileText,        page: "IncomeReport" },
  { name: "Dúvidas",          icon: HelpCircle,      page: "FAQ" },
  { name: "Minhas Cobranças", icon: FileText,        page: "MinhasCobranças" },
  { name: "Área Financeira",  icon: DollarSign,      page: "MinhaAreaFinanceira" },
  { name: "Extrato",          icon: FileText,        page: "Extrato" },
];

const adminMenuItems = [
  { name: "Campanhas",    icon: Trophy,          page: "AdminCampanhas" },
  { name: "Auditoria",    icon: Users,           page: "AdminNetwork" },
  { name: "EAD",          icon: GraduationCap,   page: "AdminCursosEAD" },
  { name: "Contrato",     icon: FileText,        page: "AdminContrato" },
  { name: "Pagamentos",   icon: CreditCard,      page: "AdminPagamentos" },
  { name: "TED",          icon: CreditCard,      page: "AdminPagamentosTed" },
  { name: "Financeiro",   icon: DollarSign,      page: "AdminFinanceiro" },
  { name: "Saques",       icon: ArrowDownCircle, page: "AdminSaques" },
  { name: "Cadastrados",  icon: Users,           page: "AdminCadastrados" },
  { name: "Notas Fiscais",icon: FileText,        page: "AdminNotasFiscais" },
  { name: "Bling",        icon: Globe,           page: "AdminBling" },
];

function NavItem({ item, currentPageName, onClick }) {
  const isActive = currentPageName === item.page;
  return (
    <Link
      to={createPageUrl(item.page)}
      onClick={onClick}
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
        isActive
          ? "bg-orange-500 text-white"
          : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
      }`}
    >
      <item.icon className={`w-[15px] h-[15px] flex-shrink-0 ${isActive ? "text-white" : "text-zinc-600 group-hover:text-zinc-300"}`} />
      <span className="truncate">{item.name}</span>
    </Link>
  );
}

function SidebarContent({ currentPageName, authUser, authPartner, onLinkClick, onLogout }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-[60px] border-b border-white/[0.04] flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center font-black text-white text-sm flex-shrink-0">3</div>
        <div className="leading-none">
          <p className="text-white font-bold text-[13px]">Sociedade de</p>
          <p className="text-orange-500 font-bold text-[13px]">Consumidores</p>
        </div>
      </div>

      {/* User card */}
      {authPartner && (
        <div className="mx-3 mt-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center flex-shrink-0">
              <span className="text-orange-400 text-sm font-bold">
                {(authPartner.display_name || authPartner.full_name || "?")[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-zinc-200 text-xs font-semibold truncate">{authPartner.display_name || authPartner.full_name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  authPartner.status === 'ativo' ? 'bg-green-500' :
                  authPartner.status === 'pendente' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <span className={`text-[10px] font-bold tracking-wide ${
                  authPartner.status === 'ativo' ? 'text-green-400' :
                  authPartner.status === 'pendente' ? 'text-yellow-400' : 'text-red-400'
                }`}>{authPartner.status?.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5 min-h-0">
        {menuItems.map(item => (
          <NavItem key={item.page} item={item} currentPageName={currentPageName} onClick={onLinkClick} />
        ))}

        {authUser?.role === 'admin' && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-700">Admin</p>
            </div>
            {adminMenuItems.map(item => (
              <NavItem key={item.page} item={{ ...item, name: item.name }} currentPageName={currentPageName} onClick={onLinkClick} />
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="flex-shrink-0 px-2 py-3 border-t border-white/[0.04]">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04] transition-all"
        >
          <LogOut className="w-[15px] h-[15px] flex-shrink-0" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
}

function LayoutContent({ children, currentPageName }) {
  const { user: authUser, partner: authPartner, logout: authLogout, isAuthenticated } = useAuthCustom();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const publicPages = ["LandingPage", "Register", "PartnerSite", "VerifyEmail", "RegisterCustom", "ForgotPassword"];

  useEffect(() => {
    if (!publicPages.includes(currentPageName) && !isAuthenticated()) {
      navigate(createPageUrl("Register"));
    }
  }, [currentPageName, isAuthenticated]);

  const handleLogout = async () => {
    try { await authLogout(); } catch {}
    navigate(createPageUrl("Register"));
  };

  if (publicPages.includes(currentPageName)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-[220px] lg:flex-col bg-[#0d0d0d] border-r border-white/[0.04] z-30">
        <SidebarContent
          currentPageName={currentPageName}
          authUser={authUser}
          authPartner={authPartner}
          onLinkClick={() => {}}
          onLogout={handleLogout}
        />
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-50 h-14 bg-[#0d0d0d] border-b border-white/[0.04] flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center font-black text-white text-xs">3</div>
          <span className="text-white font-bold text-sm">Sociedade de <span className="text-orange-500">Consumidores</span></span>
        </div>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <button className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-all">
              <Menu className="w-5 h-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[220px] p-0 bg-[#0d0d0d] border-white/[0.04]">
            <SidebarContent
              currentPageName={currentPageName}
              authUser={authUser}
              authPartner={authPartner}
              onLinkClick={() => setIsOpen(false)}
              onLogout={handleLogout}
            />
          </SheetContent>
        </Sheet>
      </header>

      {/* Main */}
      <main className="lg:pl-[220px] pt-14 lg:pt-0 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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