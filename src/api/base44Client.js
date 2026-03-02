import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

console.log("Inicializando base44 com:", { appId, functionsVersion });

export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  requiresAuth: false // páginas públicas
});

// Opcional: expor globalmente para debug (remover em produção)
if (typeof window !== 'undefined') {
  window.base44 = base44;
  console.log("base44 disponível globalmente como window.base44");
}