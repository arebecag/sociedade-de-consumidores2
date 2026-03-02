import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import NavigationTracker from "@/lib/NavigationTracker";
import { pagesConfig } from "./pages.config";

import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate
} from "react-router-dom";

import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";

const { Pages, Layout, mainPage } = pagesConfig;

const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;


// =====================================================
// LAYOUT WRAPPER
// =====================================================
const LayoutWrapper = ({ children, currentPageName }) =>
  Layout ? (
    <Layout currentPageName={currentPageName}>
      {children}
    </Layout>
  ) : (
    <>{children}</>
  );


// =====================================================
// PROTECTED ROUTE (SOMENTE /app)
// =====================================================
function ProtectedRoute({ children }) {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}


// =====================================================
// ROTAS PUBLICAS (SITE)
// =====================================================
const PublicRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Pages.Landing />} />
      <Route path="/login" element={<Pages.Login />} />
      <Route path="/register" element={<Pages.Register />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


// =====================================================
// ROTAS PRIVADAS (APP)
// =====================================================
const AppRoutes = () => {
  return (
    <ProtectedRoute>
      <Routes>

        {/* página principal do sistema */}
        <Route
          index
          element={
            <LayoutWrapper currentPageName={mainPageKey}>
              <MainPage />
            </LayoutWrapper>
          }
        />

        {/* demais páginas */}
        {Object.entries(Pages).map(([path, Page]) => (
          <Route
            key={path}
            path={path}
            element={
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            }
          />
        ))}

        <Route path="*" element={<PageNotFound />} />

      </Routes>
    </ProtectedRoute>
  );
};


// =====================================================
// APP ROOT
// =====================================================
function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>

          <NavigationTracker />

          {/* separação REAL entre site e sistema */}
          <Routes>
            {/* SITE PUBLICO */}
            <Route path="/*" element={<PublicRoutes />} />

            {/* SISTEMA */}
            <Route path="/app/*" element={<AppRoutes />} />
          </Routes>

        </Router>

        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;