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
  GraduationCap, DollarSign, ArrowDownCircle, Trophy
} from "lucide-react";
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
  { name: "Campanhas",     icon: Trophy,          page: "AdminCampanhas" },
  { name: "Auditoria",     icon: Users,           page: "AdminNetwork" },
  { name: "EAD",           icon: GraduationCap,   page: "AdminCursosEAD" },
  { name: "Contrato",      icon: FileText,        page: "AdminContrato" },
  { name: "Pagamentos",    icon: CreditCard,      page: "AdminPagamentos" },
  { name: "TED",           icon: CreditCard,      page: "AdminPagamentosTed" },
  { name: "Financeiro",    icon: DollarSign,      page: "AdminFinanceiro" },
  { name: "Saques",        icon: ArrowDownCircle, page: "AdminSaques" },
  { name: "Cadastrados",   icon: Users,           page: "AdminCadastrados" },
  { name: "Notas Fiscais", icon: FileText,        page: "AdminNotasFiscais" },
  { name: "Bling",         icon: Globe,           page: "AdminBling" },
];

function NavItem({ item, currentPageName, onClick }) {
  const isActive = currentPageName === item.page;
  return (
    <Link
      to={createPageUrl(item.page)}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
        isActive
          ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
          : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06]"
      }`}
    >
      <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : "text-zinc-600"}`} />
      <span className="truncate leading-none">{item.name}</span>
    </Link>
  );
}

function SidebarContent({ currentPageName, authUser, authPartner, onLinkClick, onLogout }) {
  return (
    <div className="flex flex-col h-full bg-card">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/[0.05]">
        <img
          src="https://media.base44.com/images/public/697d0116fccbb3128aabd5bf/84fd68149_AZz8L_P0CuwhojYm0yGlnQ-AZz8L_P0axgZJ703tpUGAQ1.png"
          alt="SC 3X3"
          className="w-10 h-10 object-contain flex-shrink-0"
        />
        <div className="leading-none">
          <p className="text-white font-bold text-xs">Sociedade de</p>
          <p className="text-orange-500 font-bold text-xs">Consumidores</p>
        </div>
      </div>

      {/* User chip */}
      {authPartner && (
        <div className="mx-3 mt-3 mb-1 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-orange-400 text-sm font-bold">
                {(authPartner.display_name || authPartner.full_name || "?")[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-zinc-200 text-xs font-semibold truncate">
                {authPartner.display_name || authPartner.full_name}
              </p>
              <span className={`text-[10px] font-bold ${
                authPartner.status === "ativo" ? "text-green-400" :
                authPartner.status === "pendente" ? "text-yellow-400" : "text-red-400"
              }`}>
                {authPartner.status?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {menuItems.map(item => (
          <NavItem key={item.page} item={item} currentPageName={currentPageName} onClick={onLinkClick} />
        ))}

        {authUser?.role === "admin" && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-700">Admin</p>
            </div>
            {adminMenuItems.map(item => (
              <NavItem key={item.page} item={item} currentPageName={currentPageName} onClick={onLinkClick} />
            ))}
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="px-2 py-3 border-t border-white/[0.05]">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-all duration-150"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
}

function LayoutContent({ children, currentPageName }) {
  const { user: authUser, partner: authPartner, logout: authLogout, isAuthenticated } = useAuthCustom();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const publicPages = ["LandingPage", "Register", "PartnerSite", "VerifyEmail", "RegisterCustom", "ForgotPassword"];

  useEffect(() => {
    if (!publicPages.includes(currentPageName) && !isAuthenticated()) {
      navigate(createPageUrl("Register"));
    }
  }, [currentPageName]);

  const handleLogout = async () => {
    try { await authLogout(); } catch {}
    navigate(createPageUrl("Register"));
  };

  if (publicPages.includes(currentPageName)) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-[220px] flex-shrink-0 border-r border-white/[0.04] h-screen sticky top-0">
        <SidebarContent
          currentPageName={currentPageName}
          authUser={authUser}
          authPartner={authPartner}
          onLinkClick={() => {}}
          onLogout={handleLogout}
        />
      </aside>

      {/* Content column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex-shrink-0 h-14 bg-card border-b border-border flex items-center justify-between px-4 z-40">
          <div className="flex items-center gap-2">
            <img
              src="https://media.base44.com/images/public/697d0116fccbb3128aabd5bf/84fd68149_AZz8L_P0CuwhojYm0yGlnQ-AZz8L_P0axgZJ703tpUGAQ1.png"
              alt="SC 3X3"
              className="w-9 h-9 object-contain flex-shrink-0"
            />
            <span className="text-white font-bold text-sm">
              Sociedade de <span className="text-orange-500">Consumidores</span>
            </span>
          </div>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors">
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[220px] p-0 bg-card border-white/[0.05]">
              <SidebarContent
                currentPageName={currentPageName}
                authUser={authUser}
                authPartner={authPartner}
                onLinkClick={() => setMobileOpen(false)}
                onLogout={handleLogout}
              />
            </SheetContent>
          </Sheet>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            <FinanceiroGuard currentPageName={currentPageName}>
              {children}
            </FinanceiroGuard>
          </div>
        </main>
      </div>
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