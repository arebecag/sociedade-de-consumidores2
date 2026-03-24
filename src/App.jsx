import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import NavigationTracker from "@/lib/NavigationTracker";
import { pagesConfig } from "./pages.config";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import AdminNotasFiscais from "@/pages/AdminNotasFiscais";
import CampanhaDesafio from "@/pages/CampanhaDesafio";
import AdminCampanhas from "@/pages/AdminCampanhas";
import AdminBling from "@/pages/AdminBling";

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) =>
  Layout ? <Layout currentPageName={currentPageName}>{children}</Layout> : <>{children}</>;

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<LayoutWrapper currentPageName={mainPageKey}><MainPage /></LayoutWrapper>} />
    {Object.entries(Pages).map(([path, Page]) => (
      <Route key={path} path={`/${path}`} element={<LayoutWrapper currentPageName={path}><Page /></LayoutWrapper>} />
    ))}
    <Route path="/AdminNotasFiscais" element={<LayoutWrapper currentPageName="AdminNotasFiscais"><AdminNotasFiscais /></LayoutWrapper>} />
    <Route path="/CampanhaDesafio" element={<LayoutWrapper currentPageName="CampanhaDesafio"><CampanhaDesafio /></LayoutWrapper>} />
    <Route path="/AdminCampanhas" element={<LayoutWrapper currentPageName="AdminCampanhas"><AdminCampanhas /></LayoutWrapper>} />
    <Route path="/AdminBling" element={<LayoutWrapper currentPageName="AdminBling"><AdminBling /></LayoutWrapper>} />
    <Route path="*" element={<PageNotFound />} />
  </Routes>
);

export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <NavigationTracker />
        <AppRoutes />
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
