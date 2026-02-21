/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminContrato from './pages/AdminContrato';
import AdminCora from './pages/AdminCora';
import AdminCursosEAD from './pages/AdminCursosEAD';
import AdminFinanceiro from './pages/AdminFinanceiro';
import AdminNetwork from './pages/AdminNetwork';
import AdminPagamentos from './pages/AdminPagamentos';
import AdminPagamentosTed from './pages/AdminPagamentosTed';
import Bonus from './pages/Bonus';
import Dashboard from './pages/Dashboard';
import Extrato from './pages/Extrato';
import FAQ from './pages/FAQ';
import IncomeReport from './pages/IncomeReport';
import LojaCursos from './pages/LojaCursos';
import Marketing from './pages/Marketing';
import MeusCursos from './pages/MeusCursos';
import minhascobranAs from './pages/MinhasCobranças';
import MySite from './pages/MySite';
import Network from './pages/Network';
import PagamentoTed from './pages/PagamentoTed';
import PartnerSite from './pages/PartnerSite';
import PayBoletos from './pages/PayBoletos';
import Profile from './pages/Profile';
import Register from './pages/Register';
import Reports from './pages/Reports';
import Store from './pages/Store';
import Withdrawals from './pages/Withdrawals';
import MinhaAreaFinanceira from './pages/MinhaAreaFinanceira';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminContrato": AdminContrato,
    "AdminCora": AdminCora,
    "AdminCursosEAD": AdminCursosEAD,
    "AdminFinanceiro": AdminFinanceiro,
    "AdminNetwork": AdminNetwork,
    "AdminPagamentos": AdminPagamentos,
    "AdminPagamentosTed": AdminPagamentosTed,
    "Bonus": Bonus,
    "Dashboard": Dashboard,
    "Extrato": Extrato,
    "FAQ": FAQ,
    "IncomeReport": IncomeReport,
    "LojaCursos": LojaCursos,
    "Marketing": Marketing,
    "MeusCursos": MeusCursos,
    "MinhasCobranças": minhascobranAs,
    "MySite": MySite,
    "Network": Network,
    "PagamentoTed": PagamentoTed,
    "PartnerSite": PartnerSite,
    "PayBoletos": PayBoletos,
    "Profile": Profile,
    "Register": Register,
    "Reports": Reports,
    "Store": Store,
    "Withdrawals": Withdrawals,
    "MinhaAreaFinanceira": MinhaAreaFinanceira,
}

export const pagesConfig = {
    mainPage: "Register",
    Pages: PAGES,
    Layout: __Layout,
};