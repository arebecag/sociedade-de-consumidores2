import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "./utils";
import { base44 } from "@/api/base44Client";
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
  Megaphone
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
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      
      const partners = await base44.entities.Partner.filter({ created_by: userData.email });
      if (partners.length > 0) {
        setPartner(partners[0]);
      }
    } catch (error) {
      // User not logged in
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
    { name: "Meu Perfil", icon: User, page: "Profile" },
    { name: "Loja 3X3 SC", icon: ShoppingBag, page: "Store" },
    { name: "Meus Clientes", icon: Users, page: "Network" },
    { name: "Meus Bônus", icon: Award, page: "Bonus" },
    { name: "Pagar Boletos", icon: Receipt, page: "PayBoletos" },
    { name: "Relatórios", icon: FileText, page: "Reports" },
    { name: "Meu Site", icon: Globe, page: "MySite" },
    { name: "Marketing", icon: Megaphone, page: "Marketing" },
    { name: "Saques", icon: CreditCard, page: "Withdrawals" },
    { name: "Receita Federal", icon: FileText, page: "IncomeReport" },
    { name: "Dúvidas", icon: HelpCircle, page: "FAQ" },
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-blue-700">
        <h1 className="text-xl font-bold text-white">Sociedade de</h1>
        <h1 className="text-xl font-bold text-white">Consumidores</h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => (
          <Link
            key={item.page}
            to={createPageUrl(item.page)}
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              currentPageName === item.page
                ? "bg-white text-blue-600"
                : "text-blue-100 hover:bg-blue-700 hover:text-white"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.name}</span>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-blue-700">
        {partner && (
          <div className="mb-4 p-3 bg-blue-700 rounded-lg">
            <p className="text-sm text-blue-200">Status</p>
            <p className={`font-semibold ${
              partner.status === 'ativo' ? 'text-green-300' :
              partner.status === 'pendente' ? 'text-yellow-300' : 'text-red-300'
            }`}>
              {partner.status?.toUpperCase()}
            </p>
          </div>
        )}
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start text-blue-100 hover:text-white hover:bg-blue-700"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Sair
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col bg-blue-600 border-r border-blue-700">
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-blue-600 border-b border-blue-700">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-lg font-bold text-white">Sociedade de</h1>
            <h1 className="text-sm font-bold text-white">Consumidores</h1>
          </div>
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-blue-700">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-blue-600 border-blue-700">
              <NavContent />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="lg:pl-64 pt-20 lg:pt-0 min-h-screen bg-gray-50">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}