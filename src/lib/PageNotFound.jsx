import { useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  const { data: authData, isFetched } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      try {
        const user = await base44.auth.me();
        return { user, isAuthenticated: true };
      } catch {
        return { user: null, isAuthenticated: false };
      }
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-7xl font-light text-slate-300">404</h1>
            <div className="h-0.5 w-16 bg-slate-200 mx-auto"></div>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-medium text-slate-800">Página não encontrada</h2>
            <p className="text-slate-600 leading-relaxed">A página <span className="font-medium text-slate-700">"{pageName}"</span> não foi encontrada.</p>
          </div>
          {isFetched && authData.isAuthenticated && authData.user?.role === "admin" && (
            <div className="mt-8 p-4 bg-slate-100 rounded-lg border border-slate-200">
              <div className="text-left space-y-1">
                <p className="text-sm font-medium text-slate-700">Nota do admin</p>
                <p className="text-sm text-slate-600 leading-relaxed">Verifique se a rota ainda não foi migrada para a nova API própria.</p>
              </div>
            </div>
          )}
          <div className="pt-6">
            <button onClick={() => (window.location.href = "/")} className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors duration-200">
              Voltar ao início
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
